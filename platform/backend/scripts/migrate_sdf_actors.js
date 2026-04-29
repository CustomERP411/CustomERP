#!/usr/bin/env node
/**
 * migrate_sdf_actors
 *
 * Plan B follow-up #3 — one-shot migration that walks the persisted `sdfs`
 * table, applies `applyActorMigration` to every row, and saves a new
 * version when the row actually changed. Idempotent at every layer.
 *
 * Defaults are SAFE — running the script with no flags performs a dry run
 * and prints what would change. Pass `--commit` to actually persist new
 * SDF versions.
 *
 * Usage:
 *   node platform/backend/scripts/migrate_sdf_actors.js [options]
 *
 * Options:
 *   --dry-run            (default) Walk every SDF and report drift; do not
 *                        write anything to the database.
 *   --commit             Persist a new SDF version for every row whose
 *                        migrated body differs from the stored body.
 *   --project=<id>       Only process SDFs belonging to the given project.
 *                        May be passed multiple times.
 *   --log=<path>         Path to the audit log (default: migrate_sdf_actors.log
 *                        in the current working directory).
 *   --quiet              Suppress per-row console output.
 *   -h, --help           Print usage and exit.
 *
 * Notes:
 *   - Each migrated SDF is saved via `SDF.create`, which creates a NEW
 *     version and leaves the prior version intact. There is no destructive
 *     update path — rolling back simply means returning to the prior
 *     version.
 *   - A single audit entry is appended per processed row, including the
 *     diff length so operators can spot anomalies (e.g. a very large diff
 *     might indicate the registry expanded since the last sweep).
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_NAME = 'migrate_sdf_actors';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    commit: false,
    projects: [],
    log: path.resolve(process.cwd(), `${SCRIPT_NAME}.log`),
    quiet: false,
    help: false,
  };
  for (const raw of argv.slice(2)) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--commit') {
      out.commit = true;
      out.dryRun = false;
      continue;
    }
    if (raw === '--dry-run') {
      out.dryRun = true;
      out.commit = false;
      continue;
    }
    if (raw === '--quiet') {
      out.quiet = true;
      continue;
    }
    if (raw.startsWith('--project=')) {
      const value = raw.slice('--project='.length).trim();
      if (value) out.projects.push(value);
      continue;
    }
    if (raw.startsWith('--log=')) {
      const value = raw.slice('--log='.length).trim();
      if (value) out.log = path.resolve(value);
      continue;
    }
  }
  return out;
}

function printHelp() {
  const help = `Usage: node platform/backend/scripts/migrate_sdf_actors.js [options]

  --dry-run            (default) Walk every SDF and report drift; no writes.
  --commit             Persist a new SDF version per drift row.
  --project=<id>       Restrict to one project. Repeatable.
  --log=<path>         Audit-log path (default: migrate_sdf_actors.log).
  --quiet              Suppress per-row stdout.
  -h, --help           Show this help.
`;
  process.stdout.write(help);
}

/**
 * Pure runner — accepts a `db` interface (`{ query, queryProjects }`) and
 * an SDF model (`{ create }`). Returns a summary `{ total, changed, errors }`.
 *
 * Exposed for unit testing — the CLI entry point wires the real db + SDF
 * model to this function.
 */
async function runMigration({
  db,
  SDF,
  applyActorMigration,
  options,
  logger,
}) {
  const summary = { total: 0, changed: 0, errors: 0, persisted: 0 };
  const projects = await loadProjectIds(db, options.projects || []);

  for (const projectId of projects) {
    const rows = await loadProjectSdfRows(db, projectId);
    for (const row of rows) {
      summary.total += 1;
      try {
        const before = row.sdf_json;
        const after = applyActorMigration(before);
        const beforeJson = JSON.stringify(before);
        const afterJson = JSON.stringify(after);
        if (beforeJson === afterJson) {
          logger.row(`unchanged project=${projectId} version=${row.version}`);
          continue;
        }
        summary.changed += 1;
        const sizeDelta = afterJson.length - beforeJson.length;
        logger.row(`drift project=${projectId} version=${row.version} delta=${sizeDelta}`);
        if (options.commit) {
          await SDF.create(projectId, after);
          summary.persisted += 1;
          logger.row(`saved  project=${projectId} new_version_after=${row.version}`);
        }
      } catch (err) {
        summary.errors += 1;
        logger.row(`error  project=${projectId} version=${row.version} err="${err && err.message}"`);
      }
    }
  }
  return summary;
}

async function loadProjectIds(db, only) {
  if (Array.isArray(only) && only.length > 0) {
    return only.slice();
  }
  const result = await db.query(
    `SELECT DISTINCT project_id FROM sdfs ORDER BY project_id`
  );
  return result.rows.map((r) => r.project_id).filter(Boolean);
}

async function loadProjectSdfRows(db, projectId) {
  const result = await db.query(
    `SELECT sdf_id, project_id, version, sdf_json, created_at
     FROM sdfs
     WHERE project_id = $1
     ORDER BY version ASC`,
    [projectId]
  );
  return result.rows || [];
}

function buildLogger(logPath, quiet) {
  let writer = null;
  try {
    writer = fs.createWriteStream(logPath, { flags: 'a' });
    writer.write(`\n# ${new Date().toISOString()} — ${SCRIPT_NAME} run\n`);
  } catch (_e) {
    writer = null;
  }
  return {
    row(line) {
      const stamped = `[${new Date().toISOString()}] ${line}`;
      if (!quiet) process.stdout.write(`${stamped}\n`);
      if (writer) writer.write(`${stamped}\n`);
    },
    end() {
      if (writer) writer.end();
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return 0;
  }
  const db = require('../src/config/database');
  const SDF = require('../src/models/SDF');
  const { applyActorMigration } = require('../src/services/sdfActorMigration');
  const logger = buildLogger(opts.log, opts.quiet);
  logger.row(`${opts.dryRun ? 'DRY-RUN' : 'COMMIT'} mode; projects=${opts.projects.length || 'ALL'}`);
  let exitCode = 0;
  try {
    const summary = await runMigration({
      db,
      SDF,
      applyActorMigration,
      options: opts,
      logger,
    });
    logger.row(`done total=${summary.total} drift=${summary.changed} persisted=${summary.persisted} errors=${summary.errors}`);
    if (summary.errors > 0) exitCode = 1;
  } catch (err) {
    logger.row(`fatal err="${err && err.message}"`);
    exitCode = 2;
  } finally {
    logger.end();
    if (db && db.pool && typeof db.pool.end === 'function') {
      try { await db.pool.end(); } catch (_e) { /* ignore */ }
    }
  }
  return exitCode;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (err) => {
    process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(2);
  });
}

module.exports = {
  parseArgs,
  runMigration,
  loadProjectIds,
  loadProjectSdfRows,
  buildLogger,
};
