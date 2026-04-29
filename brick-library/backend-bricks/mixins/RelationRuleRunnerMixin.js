/**
 * RelationRuleRunnerMixin
 *
 * Plan B follow-up #2 — runtime mixin that interprets entity.relations[]
 * primitives (invariant, derived_field, status_propagation) at request time.
 *
 * The mixin is auto-attached by the assembler (mixinResolver) when an entity
 * declares a non-empty `relations[]` array. The per-entity config flows in as
 *   mixinConfig.RelationRuleRunnerMixin = {
 *     relations:    [...entity.relations],
 *     moduleToggles: { 'modules.invoice.stock_link.enabled': true, ... },
 *     workDays:     [1,2,3,4,5],
 *   }
 *
 * SDF-time validation (Plan A) already enforced shape; this mixin assumes
 * shapes are valid.  Unknown rule/formula/action names are warned + skipped
 * so the runner never crashes a request because of a typo.
 *
 * The mixin contributes class methods (parser + library + dispatch) and
 * lifecycle hooks (BEFORE_*_VALIDATION, AFTER_*_LOGGING, BEFORE_DELETE_VALIDATION).
 *
 * `permission_scope` relations are NOT consumed here — they are read by the
 * RBAC seed + middleware (Plan B follow-up #5).  This runner skips them.
 */

const { buildParserSource } = require('./relationRuleParser');
const {
  buildLibrarySource,
  INVARIANT_NAMES,
  FORMULA_NAMES,
  ACTION_NAMES,
} = require('./relationRuleLibrary');

// ---------------------------------------------------------------------------
// Hook bodies (small; all real logic lives in class methods).
// ---------------------------------------------------------------------------

const HOOK_BEFORE_CREATE = `
  await this._relRunBeforePersist('create', data, context, null);
`;

const HOOK_BEFORE_UPDATE = `
  try {
    this._relPrevState = await this.repository.findById(this.slug, id);
  } catch (_e) {
    this._relPrevState = null;
  }
  await this._relRunBeforePersist('update', data, context, this._relPrevState);
`;

const HOOK_AFTER_CREATE = `
  try {
    await this._relRunAfterPersist('create', data, result, null);
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[RelationRuleRunner] after-create propagation failed: ' + (err && err.message));
    }
  }
`;

const HOOK_AFTER_UPDATE = `
  try {
    await this._relRunAfterPersist('update', data, result, this._relPrevState || null);
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[RelationRuleRunner] after-update propagation failed: ' + (err && err.message));
    }
  } finally {
    this._relPrevState = null;
  }
`;

const HOOK_BEFORE_DELETE = `
  try {
    this._relPrevState = await this.repository.findById(this.slug, id);
  } catch (_e) {
    this._relPrevState = null;
  }
`;

// ---------------------------------------------------------------------------
// Dispatch + orchestrator methods (class-method shorthand strings).
// ---------------------------------------------------------------------------

const DISPATCH_METHODS = `
_relWhenActive(when) {
  if (!when) return true;
  const toggles = (this.mixinConfig
    && this.mixinConfig.RelationRuleRunnerMixin
    && this.mixinConfig.RelationRuleRunnerMixin.moduleToggles) || {};
  if (Object.prototype.hasOwnProperty.call(toggles, when)) {
    return toggles[when] === true;
  }
  // Fall back to walking modules.* on a runtime config when present.
  if (typeof this.modules === 'object' && this.modules) {
    const path = String(when).replace(/^modules\\./, '').split('.');
    let cursor = this.modules;
    for (const seg of path) {
      if (!cursor || typeof cursor !== 'object') return false;
      cursor = cursor[seg];
    }
    return cursor === true;
  }
  return false;
}

_relGetRelations() {
  const cfg = (this.mixinConfig && this.mixinConfig.RelationRuleRunnerMixin) || {};
  return Array.isArray(cfg.relations) ? cfg.relations : [];
}

_relStatusFieldName(rel) {
  if (rel && rel.on && typeof rel.on.field === 'string' && rel.on.field) return rel.on.field;
  return 'status';
}

_relStatusChanged(rel, data, prevState) {
  const field = this._relStatusFieldName(rel);
  const next = data && Object.prototype.hasOwnProperty.call(data, field) ? data[field] : undefined;
  const prev = prevState ? prevState[field] : undefined;
  if (next === undefined) return null;
  if (String(next) === String(prev || '')) return null;
  return { field, prev: prev === undefined ? null : prev, next };
}

_relMatchesTrigger(trigger, prev, next) {
  if (!trigger) return false;
  if (Object.prototype.hasOwnProperty.call(trigger, 'from')) {
    if (String(prev || '') !== String(trigger.from || '')) return false;
  }
  if (Object.prototype.hasOwnProperty.call(trigger, 'to')) {
    if (String(next || '') !== String(trigger.to || '')) return false;
  }
  return true;
}

async _relRunBeforePersist(op, data, context, prevState) {
  const relations = this._relGetRelations();
  if (relations.length === 0) return;
  for (const rel of relations) {
    if (!rel || !this._relWhenActive(rel.when)) continue;
    if (rel.kind === 'invariant') {
      const parsed = this._relParseRule(rel.rule);
      if (!parsed) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] Could not parse invariant rule: ' + rel.rule);
        }
        continue;
      }
      const handler = this['_relInv_' + parsed.name];
      if (typeof handler !== 'function') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] Unknown invariant: ' + parsed.name);
        }
        continue;
      }
      try {
        await handler.call(this, { rel, parsedRule: parsed, data, prevState, op });
      } catch (err) {
        if (rel.severity === 'warn') {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[RelationRuleRunner] invariant warn: ' + (err && err.message));
          }
          continue;
        }
        throw err;
      }
    } else if (rel.kind === 'derived_field') {
      const parsed = this._relParseRule(rel.formula);
      if (!parsed) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] Could not parse formula: ' + rel.formula);
        }
        continue;
      }
      const handler = this['_relForm_' + parsed.name];
      if (typeof handler !== 'function') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] Unknown formula: ' + parsed.name);
        }
        continue;
      }
      try {
        await handler.call(this, { rel, parsedRule: parsed, data, prevState, op });
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] formula failed: ' + (err && err.message));
        }
      }
    }
    // status_propagation handled in AFTER_*_LOGGING; permission_scope handled by RBAC.
  }
}

async _relRunAfterPersist(op, data, result, prevState) {
  const relations = this._relGetRelations();
  if (relations.length === 0) return;
  const eventState = result || data || {};
  for (const rel of relations) {
    if (!rel || rel.kind !== 'status_propagation') continue;
    if (!this._relWhenActive(rel.when)) continue;
    const change = this._relStatusChanged(rel, eventState, prevState);
    let parsedAction = null;
    if (rel.effect && rel.effect.action) {
      parsedAction = this._relParseRule(rel.effect.action);
      if (!parsedAction) {
        parsedAction = { name: rel.effect.action, args: {}, positional: [] };
      }
    }
    if (change && this._relMatchesTrigger(rel.on, change.prev, change.next) && parsedAction) {
      const handler = this['_relAct_' + parsedAction.name];
      if (typeof handler !== 'function') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[RelationRuleRunner] Unknown forward action: ' + parsedAction.name);
        }
      } else {
        await handler.call(this, { rel, parsedAction, data, result: eventState, prevState, op });
      }
    }
    if (rel.reverse && rel.reverse.on) {
      let parsedReverse = null;
      if (rel.reverse.action) {
        parsedReverse = this._relParseRule(rel.reverse.action) || { name: rel.reverse.action, args: {}, positional: [] };
      }
      const reverseChange = change || this._relStatusChanged({ on: rel.reverse.on }, eventState, prevState);
      if (
        reverseChange
        && this._relMatchesTrigger(rel.reverse.on, reverseChange.prev, reverseChange.next)
        && parsedReverse
      ) {
        const handler = this['_relAct_' + parsedReverse.name];
        if (typeof handler !== 'function') {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[RelationRuleRunner] Unknown reverse action: ' + parsedReverse.name);
          }
        } else {
          await handler.call(this, { rel, parsedAction: parsedReverse, data, result: eventState, prevState, op, reverse: true });
        }
      }
    }
  }
}
`;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function buildMethods() {
  return [
    buildParserSource(),
    buildLibrarySource(),
    DISPATCH_METHODS.trim(),
  ].join('\n\n');
}

module.exports = (config = {}) => {
  // The factory does NOT consume `config` directly — per-entity config is
  // surfaced via this.mixinConfig.RelationRuleRunnerMixin at runtime. We
  // accept it to match the brick contract.
  void config;
  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_VALIDATION: HOOK_BEFORE_CREATE,
      BEFORE_UPDATE_VALIDATION: HOOK_BEFORE_UPDATE,
      AFTER_CREATE_LOGGING: HOOK_AFTER_CREATE,
      AFTER_UPDATE_LOGGING: HOOK_AFTER_UPDATE,
      BEFORE_DELETE_VALIDATION: HOOK_BEFORE_DELETE,
    },
    methods: buildMethods(),
  };
};

// Test-only exports.
module.exports.__buildMethods = buildMethods;
module.exports.__hooks = {
  HOOK_BEFORE_CREATE,
  HOOK_BEFORE_UPDATE,
  HOOK_AFTER_CREATE,
  HOOK_AFTER_UPDATE,
  HOOK_BEFORE_DELETE,
};
module.exports.__libraryNames = {
  INVARIANT_NAMES,
  FORMULA_NAMES,
  ACTION_NAMES,
};
