/**
 * UC-7.7 Download ERP — controller-layer unit tests
 *
 * Covers TC-UC7.7-003 through TC-UC7.7-007.
 * SUT: platform/backend/src/controllers/projectGenerateController.js
 *
 * generateErpZip / generateStandaloneErpZip orchestrate:
 *   1) Load + own-scope the project.
 *   2) Fetch the latest SDF; reject when missing or invalid.
 *   3) Ask erpGenerationService to assemble a temp dir.
 *   4) Flip project status to 'Generated' BEFORE streaming.
 *   5) Stream the zip back to the client.
 *   6) Cleanup the temp dir in `finally` (success or failure).
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/services/erpGenerationService',
  () => ({
    generateProjectDir: jest.fn(),
    generateStandaloneDir: jest.fn(),
    streamZipFromDir: jest.fn(),
    rmDirRecursive: jest.fn(),
    getPaths: jest.fn(),
  }),
);
jest.mock('../../../../platform/backend/src/models/SDF', () => ({
  create: jest.fn(),
  findLatestByProject: jest.fn(),
}));

const projectService = require(
  '../../../../platform/backend/src/services/projectService',
);
const erpGenerationService = require(
  '../../../../platform/backend/src/services/erpGenerationService',
);
const SDF = require('../../../../platform/backend/src/models/SDF');
const controller = require(
  '../../../../platform/backend/src/controllers/projectGenerateController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.headersSent = false;
  return res;
}

function mockReq({ platform } = {}) {
  return {
    user: { userId: 'u-1' },
    params: { id: 'p-1' },
    query: platform ? { platform } : {},
    setTimeout: jest.fn(),
  };
}

const VALID_SDF = {
  project_name: 'Acme ERP',
  entities: [{ slug: 'products', fields: [{ name: 'name', type: 'string' }] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme',
    status: 'Ready',
    language: 'en',
  });
  projectService.updateProject.mockResolvedValue({ id: 'p-1', status: 'Generated' });
  erpGenerationService.rmDirRecursive.mockResolvedValue(undefined);
});

describe('UC-7.7 / projectGenerateController.generateStandaloneErpZip', () => {
  // TC-UC7.7-003
  test('TC-UC7.7-003 — returns 400 when the platform query parameter is missing', async () => {
    const req = mockReq();
    const res = mockRes();

    await controller.generateStandaloneErpZip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/platform/i);
    expect(body.supported).toEqual(
      expect.arrayContaining(['macos-arm64', 'macos-x64', 'linux-x64', 'windows-x64']),
    );
    expect(erpGenerationService.generateStandaloneDir).not.toHaveBeenCalled();
  });
});

describe('UC-7.7 / projectGenerateController.generateErpZip', () => {
  // TC-UC7.7-004
  test('TC-UC7.7-004 — returns 400 when the project has no SDF yet', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce(null);

    const req = mockReq();
    const res = mockRes();

    await controller.generateErpZip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No SDF found. Analyze and save an SDF first.',
    });
    expect(erpGenerationService.generateProjectDir).not.toHaveBeenCalled();
  });

  // TC-UC7.7-005
  test('TC-UC7.7-005 — returns 400 when the latest SDF fails the generator validator', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce({
      sdf_json: { entities: [{ slug: 's', fields: [] }] },
    });

    const req = mockReq();
    const res = mockRes();

    await controller.generateErpZip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(
      /Latest SDF is invalid: SDF\.project_name is required/,
    );
    expect(erpGenerationService.generateProjectDir).not.toHaveBeenCalled();
  });

  // TC-UC7.7-006
  test("TC-UC7.7-006 — updates project status to 'Generated' BEFORE streaming the zip", async () => {
    SDF.findLatestByProject.mockResolvedValueOnce({ sdf_json: VALID_SDF });
    erpGenerationService.generateProjectDir.mockResolvedValue({
      outputDir: '/tmp/out',
      genId: 'g-1',
    });
    erpGenerationService.streamZipFromDir.mockResolvedValue(undefined);

    // Track order of calls across the two collaborators.
    const order = [];
    projectService.updateProject.mockImplementation(async () => {
      order.push('updateProject');
      return { id: 'p-1', status: 'Generated' };
    });
    erpGenerationService.streamZipFromDir.mockImplementation(async () => {
      order.push('streamZipFromDir');
    });

    const req = mockReq();
    const res = mockRes();

    await controller.generateErpZip(req, res);

    expect(order).toEqual(['updateProject', 'streamZipFromDir']);
    expect(projectService.updateProject).toHaveBeenCalledWith(
      'p-1',
      'u-1',
      expect.objectContaining({ status: 'Generated' }),
    );
  });

  // TC-UC7.7-007
  test('TC-UC7.7-007 — cleans up the generated temp directory in `finally`', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce({ sdf_json: VALID_SDF });
    erpGenerationService.generateProjectDir.mockResolvedValue({
      outputDir: '/tmp/out-42',
      genId: 'g-42',
    });
    erpGenerationService.streamZipFromDir.mockResolvedValue(undefined);

    const req = mockReq();
    const res = mockRes();

    await controller.generateErpZip(req, res);

    expect(erpGenerationService.rmDirRecursive).toHaveBeenCalledTimes(1);
    expect(erpGenerationService.rmDirRecursive).toHaveBeenCalledWith('/tmp/out-42');
  });
});
