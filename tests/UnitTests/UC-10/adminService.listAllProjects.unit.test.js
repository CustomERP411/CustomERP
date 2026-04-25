/**
 * UC-10 View All Projects — service-layer unit tests
 *
 * Covers TC-UC10-003, TC-UC10-004, TC-UC10-005.
 * SUT: platform/backend/src/services/adminService.js (listAllProjects)
 *
 * listAllProjects is a pure read that JOINs projects and users and
 * reshapes each row into `{ id, ..., owner: {...} }`. We mock the
 * database module to observe the SQL + exercise the row-transform.
 */

jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../platform/backend/src/config/database');
const adminService = require(
  '../../../platform/backend/src/services/adminService',
);

beforeEach(() => {
  db.query.mockReset();
});

describe('UC-10 / adminService.listAllProjects', () => {
  // TC-UC10-003
  test('TC-UC10-003 — JOINs users and reshapes each row into { id, ..., owner: {...} }', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          project_id: 'p-1',
          name: 'Acme ERP',
          description: 'desc',
          status: 'Ready',
          created_at: '2026-01-02',
          updated_at: '2026-01-03',
          owner_id: 'u-1',
          owner_name: 'Alice',
          owner_email: 'alice@example.com',
        },
      ],
    });

    const out = await adminService.listAllProjects();

    expect(out).toEqual([
      {
        id: 'p-1',
        name: 'Acme ERP',
        description: 'desc',
        status: 'Ready',
        created_at: '2026-01-02',
        updated_at: '2026-01-03',
        owner: {
          id: 'u-1',
          name: 'Alice',
          email: 'alice@example.com',
        },
      },
    ]);
  });

  // TC-UC10-004
  test('TC-UC10-004 — orders rows by p.created_at DESC and sends no parameters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await adminService.listAllProjects();

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/FROM\s+projects\s+p/i);
    expect(sql).toMatch(/LEFT JOIN\s+users\s+u/i);
    expect(sql).toMatch(/ORDER BY\s+p\.created_at\s+DESC/i);
    // No positional parameters are necessary for this query.
    expect(params).toBeUndefined();
  });

  // TC-UC10-005
  test('TC-UC10-005 — rows with a missing owner surface as owner with null fields (no crash)', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          project_id: 'p-orphan',
          name: 'Orphaned',
          description: null,
          status: 'Draft',
          created_at: '2026-04-01',
          updated_at: '2026-04-01',
          owner_id: null,
          owner_name: null,
          owner_email: null,
        },
      ],
    });

    const [proj] = await adminService.listAllProjects();

    expect(proj.owner).toEqual({ id: null, name: null, email: null });
    expect(proj.name).toBe('Orphaned');
  });
});
