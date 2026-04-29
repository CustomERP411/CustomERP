/**
 * sdfActorMigration (backend re-export)
 *
 * Plan B follow-up #3 — the canonical implementation lives in
 * `platform/assembler/assembler/sdfActorMigration.js` so both the assembler
 * and the backend consume the same code. This file exists only to give the
 * backend a stable `services/` import path.
 *
 * Path resolution: locally the assembler sits at `platform/assembler` (a
 * sibling of `platform/backend`), so `../../../assembler/...` resolves
 * correctly. In Docker the backend image only ships `/app/src/` and the
 * assembler is bind-mounted at `/app/assembler/` (see docker-compose.yml /
 * docker-compose.prod.yml), so the same relative path resolves to
 * `/assembler/...` and fails. We mirror the pattern already used by
 * `erpGenerationService.js` and prefer the explicit `ASSEMBLER_PATH` env
 * var, falling back to the local relative layout for non-Docker runs.
 */

const path = require('path');

const assemblerRoot =
  process.env.ASSEMBLER_PATH ||
  path.resolve(__dirname, '../../../assembler');

const {
  applyActorMigration,
  applyActorMigrationToEntities,
  SYSTEM_USERS_ENTITY,
  ACCESS_CONTROL_WHEN,
} = require(path.join(assemblerRoot, 'assembler', 'sdfActorMigration'));

const { ACTOR_REGISTRY } = require(path.join(assemblerRoot, 'assembler', 'actorRegistry'));

module.exports = {
  applyActorMigration,
  applyActorMigrationToEntities,
  ACTOR_REGISTRY,
  SYSTEM_USERS_ENTITY,
  ACCESS_CONTROL_WHEN,
};
