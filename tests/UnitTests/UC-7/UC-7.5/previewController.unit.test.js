/**
 * UC-7.5 Preview Generated ERP — controller-layer unit tests
 *
 * Covers TC-UC7.5-002 through TC-UC7.5-005.
 * SUT: platform/backend/src/controllers/previewController.js
 *
 * Scope:
 *   - Preview start refuses projects that do not have a generated SDF.
 *   - Preview start hands the latest SDF and project language to previewManager.
 *   - Preview status returns an iframe token once the preview is running.
 *   - Heartbeat clearly reports when there is no active preview.
 *
 * No concurrent-user generation or preview scenarios are covered here.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
}));

jest.mock('../../../../platform/backend/src/models/SDF', () => ({
  findLatestByProject: jest.fn(),
}));

jest.mock('../../../../platform/backend/src/services/previewManager', () => ({
  startPreview: jest.fn(),
  getPreviewForProject: jest.fn(),
  getQueuePosition: jest.fn(),
  stopAllForProject: jest.fn(),
  touchHeartbeatForProject: jest.fn(),
  ERROR_CODES: {
    NO_SDF: 'NO_SDF',
    NOT_FOUND: 'NOT_FOUND',
    BUILD_FAILED: 'BUILD_FAILED',
  },
}));

jest.mock('../../../../platform/backend/src/utils/previewToken', () => ({
  signIframeToken: jest.fn(),
}));

const projectService = require(
  '../../../../platform/backend/src/services/projectService',
);
const SDF = require('../../../../platform/backend/src/models/SDF');
const previewManager = require(
  '../../../../platform/backend/src/services/previewManager',
);
const { signIframeToken } = require(
  '../../../../platform/backend/src/utils/previewToken',
);
const controller = require(
  '../../../../platform/backend/src/controllers/previewController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return {
    user: { userId: 'u-1' },
    params: { id: 'p-1' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme ERP',
    language: 'tr',
    status: 'Generated',
  });
});

describe('UC-7.5 / previewController.startPreview', () => {
  // TC-UC7.5-002
  test('TC-UC7.5-002 — returns 400 when the project has no generated SDF to preview', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce(null);

    const res = mockRes();
    await controller.startPreview(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No SDF found for this project. Generate one first.',
      code: 'NO_SDF',
    });
    expect(previewManager.startPreview).not.toHaveBeenCalled();
  });

  // TC-UC7.5-003
  test('TC-UC7.5-003 — starts preview with latest SDF and project language', async () => {
    const sdf = {
      project_name: 'Acme ERP',
      entities: [{ slug: 'products', fields: [] }],
    };
    SDF.findLatestByProject.mockResolvedValueOnce({
      sdf_json: JSON.stringify(sdf),
    });
    previewManager.startPreview.mockResolvedValueOnce({
      previewId: 'prev-1',
      status: 'queued',
    });

    const res = mockRes();
    await controller.startPreview(mockReq(), res);

    expect(previewManager.startPreview).toHaveBeenCalledWith('p-1', sdf, {
      language: 'tr',
    });
    expect(res.json).toHaveBeenCalledWith({
      previewId: 'prev-1',
      status: 'queued',
    });
  });
});

describe('UC-7.5 / previewController.getPreviewStatus', () => {
  // TC-UC7.5-004
  test('TC-UC7.5-004 — running preview status includes an iframe token', async () => {
    previewManager.getPreviewForProject.mockReturnValueOnce({
      previewId: 'prev-1',
      status: 'running',
      phase: 'running',
    });
    signIframeToken.mockReturnValueOnce('signed-token');

    const res = mockRes();
    await controller.getPreviewStatus(mockReq(), res);

    expect(signIframeToken).toHaveBeenCalledWith({
      userId: 'u-1',
      previewId: 'prev-1',
    });
    expect(res.json).toHaveBeenCalledWith({
      previewId: 'prev-1',
      status: 'running',
      phase: 'running',
      iframeToken: 'signed-token',
    });
  });
});

describe('UC-7.5 / previewController.heartbeat', () => {
  // TC-UC7.5-005
  test('TC-UC7.5-005 — returns 404 when no active preview exists for heartbeat', async () => {
    previewManager.touchHeartbeatForProject.mockReturnValueOnce(false);

    const res = mockRes();
    await controller.heartbeat(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No active preview',
      code: 'NOT_FOUND',
    });
  });
});
