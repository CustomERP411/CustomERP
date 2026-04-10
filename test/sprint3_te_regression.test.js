// Sprint 3 TE regression/contract checks.
// Run with:
//   node test/sprint3_te_regression.test.js
//   node test/sprint3_te_regression.test.js --run-regression
//   node test/sprint3_te_regression.test.js --run-regression --run-api-surface

/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const state = {
  requiredPassed: 0,
  requiredFailed: 0,
  probes: [],
};

function readText(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertContains(content, needle, message) {
  assert.ok(content.includes(needle), message || `Expected content to include: ${needle}`);
}

function runRequired(name, fn) {
  try {
    fn();
    state.requiredPassed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    state.requiredFailed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function runProbe(name, isReady, blockedReason) {
  if (isReady) {
    state.probes.push({ name, status: 'ready' });
    console.log(`✓ ${name}`);
    return;
  }
  state.probes.push({ name, status: 'blocked', reason: blockedReason });
  console.log(`- ${name} [BLOCKED] ${blockedReason}`);
}

function runNodeScript(scriptRelativePath) {
  const scriptPath = path.join(ROOT, scriptRelativePath);
  assert.ok(fs.existsSync(scriptPath), `Script not found: ${scriptRelativePath}`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${scriptRelativePath} exited with code ${result.status}`);
  }
}

function runStaticContracts() {
  const projectRoutes = readText('platform/backend/src/routes/projectRoutes.js');
  const projectController = readText('platform/backend/src/controllers/projectController.js');
  const erpGenerationService = readText('platform/backend/src/services/erpGenerationService.js');
  const gatewayMain = readText('platform/ai-gateway/src/main.py');
  const clarificationPanel = readText('platform/frontend/src/components/project/ClarificationQuestions.tsx');
  const projectDetailPage = readText('platform/frontend/src/pages/ProjectDetailPage.tsx');
  const projectServiceTs = readText('platform/frontend/src/services/projectService.ts');
  const multiAgentService = readText('platform/ai-gateway/src/services/multi_agent_service.py');
  const sdfService = readText('platform/ai-gateway/src/services/sdf_service.py');

  runRequired('Project routes expose iterative clarify loop endpoints', () => {
    assertContains(projectRoutes, "router.post('/:id/analyze'", 'Missing analyze route');
    assertContains(projectRoutes, "router.post('/:id/clarify'", 'Missing clarify route');
  });

  runRequired('Project routes expose questionnaire + SDF endpoints', () => {
    assertContains(projectRoutes, "router.get('/:id/default-questions'", 'Missing default question read route');
    assertContains(projectRoutes, "router.post('/:id/default-questions/answers'", 'Missing default question answer route');
    assertContains(projectRoutes, "router.get('/:id/sdf/latest'", 'Missing latest SDF route');
    assertContains(projectRoutes, "router.post('/:id/sdf/save'", 'Missing save SDF route');
    assertContains(projectRoutes, "router.post('/:id/sdf/ai-edit'", 'Missing AI edit SDF route');
  });

  runRequired('Project routes expose standard + standalone generation endpoints', () => {
    assertContains(projectRoutes, "router.post('/:id/generate'", 'Missing ERP zip generation route');
    assertContains(projectRoutes, "router.post('/:id/generate/standalone'", 'Missing standalone ERP generation route');
  });

  runRequired('Analyze flow enforces mandatory questionnaire completion', () => {
    assertContains(projectController, 'Mandatory module questions are incomplete');
    assertContains(projectController, 'missing_required_question_ids');
    assertContains(projectController, 'missing_required_question_keys');
  });

  runRequired('Clarification flow persists round/cycle and returns tracking fields', () => {
    assertContains(projectController, 'const priorCycleCount = await clarificationService.getCycleCount(project.id);');
    assertContains(projectController, 'const currentCycle = priorCycleCount + 1;');
    assertContains(projectController, 'sdf_complete: sdf?.sdf_complete || false');
    assertContains(projectController, 'token_usage: sdf?.token_usage || null');
  });

  runRequired('Standalone packaging supports explicit platform validation', () => {
    assertContains(erpGenerationService, 'const supportedPlatforms = Object.keys(StandalonePackager.PLATFORMS);');
    assertContains(erpGenerationService, "Unsupported platform '${platform}'");
    assertContains(erpGenerationService, 'StandalonePackager.buildStandaloneBundle');
  });

  runRequired('AI gateway exposes analyze/clarify/finalize/edit endpoints', () => {
    assertContains(gatewayMain, '@app.post("/ai/analyze"');
    assertContains(gatewayMain, '@app.post("/ai/clarify"');
    assertContains(gatewayMain, '@app.post("/ai/finalize"');
    assertContains(gatewayMain, '@app.post("/ai/edit"');
  });

  runRequired('Multi-agent pipeline includes clarification aggregation + sdf_complete', () => {
    assertContains(multiAgentService, 'def _aggregate_clarifications(');
    assertContains(multiAgentService, 'sdf_complete=');
    assertContains(sdfService, 'data["sdf_complete"] = result.sdf_complete');
  });

  runRequired('Frontend clarifying UI has explicit finalize actions', () => {
    assertContains(clarificationPanel, 'Generate Final SDF');
    assertContains(clarificationPanel, 'Skip remaining and finalize');
    assertContains(clarificationPanel, 'Round {clarifyRound}');
  });

  runRequired('Frontend analyze action is gated by required default answers', () => {
    assertContains(projectDetailPage, 'defaultCompletion?.is_complete === true');
    assertContains(projectDetailPage, 'const canAnalyze = useMemo(');
  });

  runRequired('Frontend service maps Sprint 3 generation endpoints', () => {
    assertContains(projectServiceTs, '/projects/${id}/analyze');
    assertContains(projectServiceTs, '/projects/${id}/clarify');
    assertContains(projectServiceTs, '/projects/${id}/generate');
    assertContains(projectServiceTs, '/projects/${id}/generate/standalone?platform=');
  });
}

function runBlockedProbes() {
  const projectRoutes = readText('platform/backend/src/routes/projectRoutes.js');
  const projectModel = readText('platform/backend/src/models/Project.js');
  const authRoutes = readText('platform/backend/src/routes/authRoutes.js');
  const projectDetailPage = readText('platform/frontend/src/pages/ProjectDetailPage.tsx');

  const hasChatBuildMode =
    projectRoutes.includes('/chat-mode') ||
    projectRoutes.includes('/build-mode') ||
    projectDetailPage.toLowerCase().includes('switch to build');
  runProbe(
    'Dedicated chat mode -> build mode workflow',
    hasChatBuildMode,
    'No explicit chat/build mode state machine or endpoint yet.'
  );

  const hasApproveRejectRevise =
    projectRoutes.includes('/sdf/review') ||
    projectRoutes.includes('/sdf/approve') ||
    projectRoutes.includes('/sdf/reject') ||
    projectRoutes.includes('/sdf/revise');
  runProbe(
    'Formal SDF review/approve/reject/revise backend endpoints',
    hasApproveRejectRevise,
    'Current baseline supports save + ai-edit, but no formal review actions.'
  );

  const hasProjectSoftDelete =
    projectModel.includes('deleted_at') ||
    projectModel.includes('is_deleted') ||
    !projectModel.includes('DELETE FROM projects');
  runProbe(
    'Project soft-delete with list filtering',
    hasProjectSoftDelete,
    'Project model currently uses hard DELETE SQL.'
  );

  const hasAccountDeleteEndpoint =
    authRoutes.includes("router.delete('/account'") ||
    authRoutes.includes("router.delete('/me'") ||
    authRoutes.includes('deleteAccount');
  runProbe(
    'Account delete (soft-delete) endpoint',
    hasAccountDeleteEndpoint,
    'Auth routes currently expose register/login/me/logout only.'
  );
}

function maybeRunRegressionPack(args) {
  if (!args.includes('--run-regression')) {
    return;
  }

  console.log('\nRunning core regression scripts...');
  const scripts = [
    'test/invoice_bricks.unit.test.js',
    'test/hr_bricks.unit.test.js',
    'test/module_generation.integration.test.js',
  ];

  for (const scriptPath of scripts) {
    runRequired(`Regression script passes: ${scriptPath}`, () => {
      runNodeScript(scriptPath);
    });
  }

  if (args.includes('--run-api-surface')) {
    runRequired('Regression script passes: platform/backend/tests/api_invoice_hr_routes.test.js', () => {
      runNodeScript('platform/backend/tests/api_invoice_hr_routes.test.js');
    });
  }
}

function printSummary() {
  const blocked = state.probes.filter((item) => item.status === 'blocked');

  console.log('\nSprint 3 TE contract summary');
  console.log(`Required checks: ${state.requiredPassed} passed, ${state.requiredFailed} failed.`);
  console.log(`Blocked probes: ${blocked.length}`);
  if (blocked.length > 0) {
    for (const item of blocked) {
      console.log(`  - ${item.name}: ${item.reason}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);

  console.log('Sprint 3 TE regression checks\n');
  runStaticContracts();
  runBlockedProbes();
  maybeRunRegressionPack(args);
  printSummary();

  if (state.requiredFailed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
