/**
 * sdfActorMigration (backend re-export)
 *
 * Plan B follow-up #3 — the canonical implementation lives in
 * `platform/assembler/assembler/sdfActorMigration.js` so both the assembler
 * and the backend consume the same code. This file exists only to give the
 * backend a stable `services/` import path.
 */

const {
  applyActorMigration,
  applyActorMigrationToEntities,
  SYSTEM_USERS_ENTITY,
  ACCESS_CONTROL_WHEN,
} = require('../../../assembler/assembler/sdfActorMigration');

const { ACTOR_REGISTRY } = require('../../../assembler/assembler/actorRegistry');

module.exports = {
  applyActorMigration,
  applyActorMigrationToEntities,
  ACTOR_REGISTRY,
  SYSTEM_USERS_ENTITY,
  ACCESS_CONTROL_WHEN,
};
