/**
 * sdfActorMigration (assembler-side canonical implementation)
 *
 * Plan B follow-up #3 — idempotent migration that promotes string actor
 * fields (e.g. `leaves.approver_id`, `goods_receipts.received_by`) to
 * proper `reference -> __erp_users` references and emits matching
 * coherence-layer relations.
 *
 * This file lives next to the actor registry inside the assembler so both
 * the assembler-time path (entity builders, ProjectAssembler) and the
 * backend-time path (prefilledSdfService, projectSdfController, the
 * one-shot migration script) consume the same code. The backend-side file
 * `platform/backend/src/services/sdfActorMigration.js` is a thin re-export.
 *
 * Runs at three points:
 *
 *   1. Generation time     — `prefilledSdfService` (wizard path) and
 *                            `_withSystemEntities` (assembler path) call
 *                            it on every SDF before generating.
 *   2. Read time           — `projectSdfController.getLatestSdf` calls it
 *                            on the SDF before returning to the client, so
 *                            stored legacy SDFs surface in the new shape
 *                            even before the persisted row is rewritten.
 *   3. One-shot migration  — `scripts/migrate_sdf_actors.js` runs against
 *                            every persisted SDF and saves new versions
 *                            when changes occur.
 *
 * Idempotent: running on an already-migrated SDF produces an equivalent SDF
 * (no duplicate fields, no duplicate relations).
 *
 * No-op when access control is OFF (`modules.access_control.enabled === false`)
 * unless `force` is set in the options — minimal generated ERPs continue to
 * ship string actor fields exactly as they did before this plan.
 *
 * The function returns a NEW SDF object (deep-cloned) rather than mutating
 * the input.
 */

const { getActorSpecs } = require('./actorRegistry');

const SYSTEM_USERS_ENTITY = '__erp_users';
const ACCESS_CONTROL_WHEN = 'modules.access_control.enabled';

/**
 * Apply the actor migration to an SDF.
 *
 * @param {object} sdf - Parsed SDF object. NOT mutated.
 * @param {object} [options]
 * @param {boolean} [options.force] - Run the migration even when
 *   modules.access_control is disabled. Default false.
 * @returns {object} A new SDF with reference fields + coherence relations
 *   added where appropriate.
 */
function applyActorMigration(sdf, options = {}) {
  if (!sdf || typeof sdf !== 'object') return sdf;

  const force = options.force === true;
  if (!force && !_isAccessControlEnabled(sdf)) {
    return _deepClone(sdf);
  }

  const cloned = _deepClone(sdf);
  if (!Array.isArray(cloned.entities)) {
    cloned.entities = [];
  }

  for (const entity of cloned.entities) {
    if (!entity || typeof entity !== 'object') continue;
    const slug = String(entity.slug || '');
    if (!slug) continue;
    const specs = getActorSpecs(slug);
    if (specs.length === 0) continue;
    _migrateEntity(entity, specs);
  }

  return cloned;
}

/**
 * In-place variant for the assembler entity-builder path. Mutates the
 * `entities` array directly when access control is enabled. Returns the
 * same array. Idempotent.
 */
function applyActorMigrationToEntities(entities, sdf, options = {}) {
  if (!Array.isArray(entities)) return entities;
  const force = options.force === true;
  if (!force && !_isAccessControlEnabled(sdf || {})) return entities;

  for (const entity of entities) {
    if (!entity || typeof entity !== 'object') continue;
    const slug = String(entity.slug || '');
    if (!slug) continue;
    const specs = getActorSpecs(slug);
    if (specs.length === 0) continue;
    _migrateEntity(entity, specs);
  }
  return entities;
}

function _migrateEntity(entity, specs) {
  if (!Array.isArray(entity.fields)) entity.fields = [];
  if (!Array.isArray(entity.relations)) entity.relations = [];

  for (const spec of specs) {
    const ensure = spec.ensure || 'add';
    const existing = entity.fields.find((f) => f && f.name === spec.field);
    // Plan E C3 — every actor field must render as the action-past-tense
    // form ("Approved by", "Posted by", ...). Fall back to the descriptive
    // `purpose` for legacy registry entries that pre-date `label`, and
    // finally to the field name as a last-resort safety net.
    const canonicalLabel = spec.label || spec.purpose || spec.field;

    if (existing) {
      if (existing.type !== 'reference') {
        existing.type = 'reference';
        existing.reference_entity = SYSTEM_USERS_ENTITY;
        if (existing.required === true) {
          // Actor fields default to optional — required: true would block
          // legacy rows that have null values.
          existing.required = false;
        }
        // Plan E C3 — when retyping an existing string field, the original
        // label is almost always a junk auto-formatted column name like
        // "Approver Id". Overwrite it with the canonical action-past-tense
        // form whenever the existing value is missing OR matches the
        // auto-formatted column name. We never clobber a thoughtfully
        // chosen label that differs from the auto form.
        if (_shouldOverwriteLabel(existing.label, spec.field)) {
          existing.label = canonicalLabel;
        }
      } else if (existing.reference_entity !== SYSTEM_USERS_ENTITY) {
        // Already a reference to something else; do not overwrite. Skip
        // emitting a contract — the existing reference is the source of
        // truth.
        continue;
      } else {
        // Already a __erp_users reference, but the label may still be the
        // auto-formatted column name (e.g. AI emitted reference-shape
        // correctly but skipped the label rule). Apply the same overwrite
        // policy so the action-past-tense form lands.
        if (_shouldOverwriteLabel(existing.label, spec.field)) {
          existing.label = canonicalLabel;
        }
      }
    } else {
      void ensure;
      entity.fields.push({
        name: spec.field,
        type: 'reference',
        reference_entity: SYSTEM_USERS_ENTITY,
        required: false,
        label: canonicalLabel,
      });
    }

    _addReferenceContract(entity, spec.field);

    if (spec.permission && spec.scope) {
      _addPermissionScope(entity, spec.permission, spec.scope);
    }
  }
}

// Plan E C3 — helper: an existing label is "safe to overwrite" when it is
// missing/empty OR equals the title-cased version of the field name, which
// indicates the AI/legacy SDF used the auto-formatted fallback rather than
// a thoughtful translation.
function _shouldOverwriteLabel(existingLabel, fieldName) {
  if (existingLabel == null) return true;
  const trimmed = String(existingLabel).trim();
  if (trimmed === '') return true;
  const auto = String(fieldName || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return trimmed.toLowerCase() === auto.toLowerCase();
}

function _addReferenceContract(entity, field) {
  const dup = entity.relations.find((r) => (
    r && r.kind === 'reference_contract' && r.field === field
  ));
  if (dup) return;
  entity.relations.push({
    kind: 'reference_contract',
    field,
    target: SYSTEM_USERS_ENTITY,
    when: ACCESS_CONTROL_WHEN,
  });
}

function _addPermissionScope(entity, permission, scope) {
  const dup = entity.relations.find((r) => (
    r && r.kind === 'permission_scope'
    && r.permission === permission
    && r.scope === scope
  ));
  if (dup) return;
  entity.relations.push({
    kind: 'permission_scope',
    permission,
    scope,
    when: ACCESS_CONTROL_WHEN,
  });
}

function _isAccessControlEnabled(sdf) {
  // Mirror the assembler's default-on semantics (ProjectAssembler.js:
  //   const accessControlEnabled = acConfig.enabled !== false;
  // ). An SDF without modules.access_control is treated as access-controlled
  // unless it explicitly opts out via { enabled: false }.
  const modules = sdf && sdf.modules;
  const ac = modules && typeof modules === 'object' ? modules.access_control : undefined;
  if (ac === false) return false;
  if (ac && typeof ac === 'object' && ac.enabled === false) return false;
  return true;
}

function _deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  applyActorMigration,
  applyActorMigrationToEntities,
  SYSTEM_USERS_ENTITY,
  ACCESS_CONTROL_WHEN,
};
