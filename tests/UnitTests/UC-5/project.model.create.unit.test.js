/**
 * UC-5 Create Project — model-layer unit tests
 *
 * Covers TC-UC5-013.
 * SUT: platform/backend/src/models/Project.js (create)
 *
 * Business rules at the model layer:
 *   - INSERT always pins status to 'Draft' (never taken from input).
 *   - `language` is normalized via authService.normalizeLanguage before
 *     being persisted.
 *   - The returned object is the transformed (API-shape) row.
 */

jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

const db = require('../../../platform/backend/src/config/database');
const Project = require('../../../platform/backend/src/models/Project');

describe('UC-5 / Project.create', () => {
  // TC-UC5-013
  test("INSERTs with status 'Draft' and a normalized language, then returns the transformed row", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          project_id: 'p-1',
          name: 'X',
          owner_user_id: 'u-1',
          description: null,
          status: 'Draft',
          mode: null, // will be coerced to 'chat' by the transformer
          language: 'tr',
          created_at: new Date('2026-04-01T00:00:00Z'),
          updated_at: new Date('2026-04-01T00:00:00Z'),
        },
      ],
    });

    const project = await Project.create({
      name: 'X',
      userId: 'u-1',
      language: 'tr-TR',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toMatch(/INSERT\s+INTO\s+projects/i);
    expect(sql).toMatch(/VALUES\s*\(\s*\$1\s*,\s*\$2\s*,\s*\$3\s*,\s*'Draft'\s*,\s*\$4\s*\)/i);
    expect(sql).toMatch(/RETURNING\s+\*/i);

    // Parameters: [name, userId, description, lang]
    // The 4th parameter must be the normalized language — 'tr' not 'tr-TR'.
    expect(params).toEqual(['X', 'u-1', null, 'tr']);

    // Returned object is the transformer output.
    expect(project).toMatchObject({
      id: 'p-1',
      name: 'X',
      status: 'Draft',
      mode: 'chat',
      language: 'tr',
    });
  });
});
