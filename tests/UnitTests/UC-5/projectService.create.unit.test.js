/**
 * UC-5 Create Project — service-layer unit tests
 *
 * Covers TC-UC5-007 through TC-UC5-012.
 * SUT: platform/backend/src/services/projectService.js (createProject)
 *
 * Mocks:
 *   - Project  (so no DB is hit)
 *   - authService.findById (controls user lookup outcome). authService
 *     is NOT wholly mocked — the real `normalizeLanguage` /
 *     `DEFAULT_LANGUAGE` are needed because projectService destructures
 *     them at require-time.
 *
 * Key behaviours:
 *   - Missing or whitespace name → Error('Project name is required').
 *   - Name is trimmed before hitting the model.
 *   - Language precedence:  data.language (normalized) > user.preferred_language > DEFAULT_LANGUAGE.
 *   - If the user lookup throws, the service quietly falls back to the default language.
 */

jest.mock('../../../platform/backend/src/models/Project', () => ({
  create: jest.fn(),
  findByUser: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

// Partially mock authService: keep normalizeLanguage / DEFAULT_LANGUAGE
// real (they are pure), stub findById so we control the user lookup.
jest.mock('../../../platform/backend/src/services/authService', () => {
  const actual = jest.requireActual(
    '../../../platform/backend/src/services/authService',
  );
  return Object.assign(Object.create(Object.getPrototypeOf(actual)), actual, {
    findById: jest.fn(),
  });
});

const Project = require('../../../platform/backend/src/models/Project');
const authService = require(
  '../../../platform/backend/src/services/authService',
);
const projectService = require(
  '../../../platform/backend/src/services/projectService',
);

beforeEach(() => {
  Project.create.mockReset();
  authService.findById.mockReset();
});

describe('UC-5 / projectService.createProject', () => {
  // TC-UC5-007
  test('TC-UC5-007 — rejects when data.name is missing', async () => {
    await expect(projectService.createProject('u-1', {})).rejects.toThrow(
      'Project name is required',
    );
    expect(Project.create).not.toHaveBeenCalled();
  });

  // TC-UC5-008
  test('TC-UC5-008 — rejects when data.name is only whitespace', async () => {
    await expect(
      projectService.createProject('u-1', { name: '   ' }),
    ).rejects.toThrow('Project name is required');
    expect(Project.create).not.toHaveBeenCalled();
  });

  // TC-UC5-009
  test('TC-UC5-009 — trims surrounding whitespace from the name before creating', async () => {
    authService.findById.mockResolvedValueOnce({ preferred_language: 'en' });
    Project.create.mockResolvedValueOnce({ id: 'p-1', name: 'My ERP' });

    await projectService.createProject('u-1', { name: '  My ERP  ' });

    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My ERP', userId: 'u-1' }),
    );
  });

  // TC-UC5-010
  test("TC-UC5-010 — inherits the user's preferred_language when data.language is undefined", async () => {
    authService.findById.mockResolvedValueOnce({ preferred_language: 'tr' });
    Project.create.mockResolvedValueOnce({ id: 'p-1' });

    await projectService.createProject('u-1', { name: 'ERP' });

    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'tr' }),
    );
  });

  // TC-UC5-011
  test("TC-UC5-011 — explicit data.language ('tr-TR') wins and is normalized to 'tr'", async () => {
    authService.findById.mockResolvedValueOnce({ preferred_language: 'en' });
    Project.create.mockResolvedValueOnce({ id: 'p-1' });

    await projectService.createProject('u-1', { name: 'ERP', language: 'tr-TR' });

    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'tr' }),
    );
  });

  // TC-UC5-012
  test('TC-UC5-012 — falls back to DEFAULT_LANGUAGE when authService.findById throws', async () => {
    authService.findById.mockRejectedValueOnce(new Error('DB down'));
    Project.create.mockResolvedValueOnce({ id: 'p-1' });

    await expect(
      projectService.createProject('u-1', { name: 'ERP' }),
    ).resolves.toBeTruthy();

    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    );
  });
});
