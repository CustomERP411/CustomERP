/**
 * UC-7.5 / Plan B follow-up #3 — migrate_sdf_actors CLI script unit tests.
 *
 * SUT: platform/backend/scripts/migrate_sdf_actors.js
 *
 * Coverage (3 cases):
 *   1. Dry-run mode: walks rows, reports drift, persists nothing.
 *   2. --commit mode: persists a new SDF version per drift row.
 *   3. --project filter: only processes the specified project IDs.
 */

const {
  parseArgs,
  runMigration,
} = require('../../../../platform/backend/scripts/migrate_sdf_actors');

function buildDb(rowsByProject) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes('DISTINCT project_id')) {
        return {
          rows: Object.keys(rowsByProject).map((id) => ({ project_id: id })),
        };
      }
      if (text.includes('FROM sdfs') && text.includes('WHERE project_id')) {
        const projectId = params && params[0];
        return { rows: rowsByProject[projectId] || [] };
      }
      return { rows: [] };
    },
  };
}

function buildLogger() {
  const lines = [];
  return {
    lines,
    row(line) {
      lines.push(line);
    },
    end() {},
  };
}

function buildSDFModelStub() {
  const persisted = [];
  return {
    persisted,
    async create(projectId, sdfJson) {
      const row = { project_id: projectId, version: persisted.length + 100, sdf_json: sdfJson };
      persisted.push(row);
      return row;
    },
  };
}

function legacySdfRow(version) {
  return {
    sdf_id: `sdf-${version}`,
    project_id: 'p1',
    version,
    sdf_json: {
      modules: { access_control: { enabled: true } },
      entities: [
        {
          slug: 'leaves',
          fields: [
            { name: 'employee_id', type: 'reference', reference_entity: 'employees' },
            { name: 'approver_id', type: 'string' },
          ],
        },
      ],
    },
  };
}

describe('parseArgs', () => {
  test('defaults to dry-run', () => {
    const opts = parseArgs(['node', 'migrate_sdf_actors.js']);
    expect(opts.dryRun).toBe(true);
    expect(opts.commit).toBe(false);
    expect(opts.projects).toEqual([]);
  });

  test('--commit flips to write mode', () => {
    const opts = parseArgs(['node', 'migrate_sdf_actors.js', '--commit']);
    expect(opts.dryRun).toBe(false);
    expect(opts.commit).toBe(true);
  });

  test('--project filters to a single project', () => {
    const opts = parseArgs(['node', 'migrate_sdf_actors.js', '--project=p1', '--project=p2']);
    expect(opts.projects).toEqual(['p1', 'p2']);
  });
});

describe('runMigration', () => {
  test('1. dry-run reports drift but persists nothing', async () => {
    const { applyActorMigration } = require(
      '../../../../platform/assembler/assembler/sdfActorMigration'
    );
    const db = buildDb({ p1: [legacySdfRow(1)] });
    const SDF = buildSDFModelStub();
    const logger = buildLogger();

    const summary = await runMigration({
      db,
      SDF,
      applyActorMigration,
      options: { dryRun: true, commit: false, projects: [] },
      logger,
    });

    expect(summary.total).toBe(1);
    expect(summary.changed).toBe(1);
    expect(summary.persisted).toBe(0);
    expect(SDF.persisted).toHaveLength(0);
    expect(logger.lines.some((l) => l.startsWith('drift '))).toBe(true);
    expect(logger.lines.some((l) => l.startsWith('saved '))).toBe(false);
  });

  test('2. --commit mode persists a new version per drift row', async () => {
    const { applyActorMigration } = require(
      '../../../../platform/assembler/assembler/sdfActorMigration'
    );
    const db = buildDb({ p1: [legacySdfRow(1), legacySdfRow(2)] });
    const SDF = buildSDFModelStub();
    const logger = buildLogger();

    const summary = await runMigration({
      db,
      SDF,
      applyActorMigration,
      options: { dryRun: false, commit: true, projects: [] },
      logger,
    });

    expect(summary.total).toBe(2);
    expect(summary.changed).toBe(2);
    expect(summary.persisted).toBe(2);
    expect(SDF.persisted).toHaveLength(2);
    // New rows include the migrated reference field
    const newRow = SDF.persisted[0];
    const leaves = newRow.sdf_json.entities.find((e) => e.slug === 'leaves');
    expect(leaves.fields.find((f) => f.name === 'approver_id').type).toBe('reference');
  });

  test('3. --project filter restricts to the specified IDs', async () => {
    const { applyActorMigration } = require(
      '../../../../platform/assembler/assembler/sdfActorMigration'
    );
    const db = buildDb({
      p1: [legacySdfRow(1)],
      p2: [legacySdfRow(1)],
      p3: [legacySdfRow(1)],
    });
    const SDF = buildSDFModelStub();
    const logger = buildLogger();

    const summary = await runMigration({
      db,
      SDF,
      applyActorMigration,
      options: { dryRun: false, commit: true, projects: ['p2'] },
      logger,
    });

    expect(summary.total).toBe(1); // only p2 processed
    expect(SDF.persisted).toHaveLength(1);
    expect(SDF.persisted[0].project_id).toBe('p2');
  });

  test('idempotent: running on already-migrated SDF reports unchanged', async () => {
    const { applyActorMigration } = require(
      '../../../../platform/assembler/assembler/sdfActorMigration'
    );
    const migratedRow = {
      sdf_id: 'sdf-1',
      project_id: 'p1',
      version: 1,
      sdf_json: applyActorMigration(legacySdfRow(1).sdf_json),
    };
    const db = buildDb({ p1: [migratedRow] });
    const SDF = buildSDFModelStub();
    const logger = buildLogger();

    const summary = await runMigration({
      db,
      SDF,
      applyActorMigration,
      options: { dryRun: false, commit: true, projects: [] },
      logger,
    });

    expect(summary.total).toBe(1);
    expect(summary.changed).toBe(0);
    expect(SDF.persisted).toHaveLength(0);
    expect(logger.lines.some((l) => l.startsWith('unchanged '))).toBe(true);
  });
});
