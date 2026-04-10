// Sprint 3 TE objective runner (progressreport lines 131-138).
// Usage examples:
//   node test/sprint3_te_objectives.e2e.test.js --objectives=131
//   node test/sprint3_te_objectives.e2e.test.js --objectives=131,133,134,135,138 --save-zips
//   node test/sprint3_te_objectives.e2e.test.js --objectives=136,137
//
// This script requires backend services to be running for API objectives:
// - Backend API: http://localhost:3000
// - AI Gateway: http://localhost:8000

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'test-results', 'sprint3-te');
const DEFECT_LOG_TEMPLATE_PATH = path.join(ROOT, 'docs', 'sprint3_te_defect_log.md');

const DEFAULT_OBJECTIVES = ['131', '132', '133', '134', '135', '138'];
const DEFAULT_PLATFORMS = ['windows-x64', 'macos-x64', 'linux-x64'];
const DEFAULT_MAX_ROUNDS = 3;

function parseArgs(argv) {
  const flags = new Set();
  const values = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const token = raw.slice(2);
    const eq = token.indexOf('=');
    if (eq === -1) {
      flags.add(token);
      continue;
    }
    values[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return { flags, values };
}

function parseCsv(input, fallback) {
  if (!input || typeof input !== 'string') return [...fallback];
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safeName(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function extractErrorMessage(data) {
  if (!data) return 'Unknown error';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    return JSON.stringify(data);
  }
  return String(data);
}

async function httpJson({
  baseUrl,
  route,
  method = 'GET',
  token,
  body,
  timeoutMs = 120000,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function httpBinary({
  baseUrl,
  route,
  method = 'POST',
  token,
  timeoutMs = 300000,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers,
      signal: controller.signal,
    });

    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      data: bytes,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureOk(response, context) {
  if (response.ok) return response;
  const msg = extractErrorMessage(response.data);
  throw new Error(`${context} failed (${response.status}): ${msg}`);
}

function chooseAnswer(question, fallbackText) {
  const type = String(question?.type || 'text');
  const options = Array.isArray(question?.options) ? question.options : [];

  if (type === 'yes_no') return 'yes';
  if (type === 'choice') return options.length ? String(options[0]) : 'yes';
  if (type === 'multi_choice') return options.length ? [String(options[0])] : ['Mon'];
  return fallbackText;
}

async function registerOrLogin({
  baseUrl,
  email,
  password,
  name,
}) {
  const registerRes = await httpJson({
    baseUrl,
    route: '/api/auth/register',
    method: 'POST',
    body: { name, email, password },
  });

  if (registerRes.ok && registerRes.data?.token) {
    return registerRes.data.token;
  }

  const alreadyExists = registerRes.status === 400 &&
    /already exists|already registered|exists/i.test(extractErrorMessage(registerRes.data));

  if (!alreadyExists) {
    ensureOk(registerRes, 'Register');
  }

  const loginRes = await httpJson({
    baseUrl,
    route: '/api/auth/login',
    method: 'POST',
    body: { email, password },
  });
  ensureOk(loginRes, 'Login');
  if (!loginRes.data?.token) {
    throw new Error('Login succeeded but token is missing');
  }
  return loginRes.data.token;
}

async function createProject({ baseUrl, token, name }) {
  const res = await httpJson({
    baseUrl,
    route: '/api/projects',
    method: 'POST',
    token,
    body: { name },
  });
  ensureOk(res, 'Create project');
  if (!res.data?.id) {
    throw new Error('Create project returned no project id');
  }
  return res.data;
}

async function listProjects({ baseUrl, token }) {
  const res = await httpJson({
    baseUrl,
    route: '/api/projects',
    method: 'GET',
    token,
  });
  ensureOk(res, 'List projects');
  return Array.isArray(res.data?.projects) ? res.data.projects : [];
}

async function getDefaultQuestions({ baseUrl, token, projectId, modules }) {
  const query = encodeURIComponent(modules.join(','));
  const res = await httpJson({
    baseUrl,
    route: `/api/projects/${projectId}/default-questions?modules=${query}`,
    method: 'GET',
    token,
  });
  ensureOk(res, 'Get default questions');
  return res.data;
}

async function saveDefaultAnswers({ baseUrl, token, projectId, modules, questions }) {
  const visibleQuestions = (Array.isArray(questions) ? questions : []).filter((q) => q.visible !== false);
  const answers = visibleQuestions.map((q) => ({
    question_id: q.id,
    answer: chooseAnswer(q, `Auto answer for ${q.key || q.id}`),
  }));

  const res = await httpJson({
    baseUrl,
    route: `/api/projects/${projectId}/default-questions/answers`,
    method: 'POST',
    token,
    body: { modules, answers },
  });
  ensureOk(res, 'Save default answers');
  return res.data;
}

async function analyzeProject({
  baseUrl,
  token,
  projectId,
  modules,
  mandatoryAnswers,
  prefilledSdf,
  description,
}) {
  const res = await httpJson({
    baseUrl,
    route: `/api/projects/${projectId}/analyze`,
    method: 'POST',
    token,
    body: {
      description,
      modules,
      default_question_answers: mandatoryAnswers,
      prefilled_sdf: prefilledSdf,
    },
    timeoutMs: 180000,
  });
  ensureOk(res, 'Analyze project');
  return res.data;
}

async function clarifyProject({
  baseUrl,
  token,
  projectId,
  partialSdf,
  description,
  questions,
}) {
  const answers = (Array.isArray(questions) ? questions : []).map((q, idx) => ({
    question_id: String(q?.id || `q-${idx + 1}`),
    answer: chooseAnswer(q || {}, `Clarification answer ${idx + 1}`),
  }));

  const res = await httpJson({
    baseUrl,
    route: `/api/projects/${projectId}/clarify`,
    method: 'POST',
    token,
    body: {
      partial_sdf: partialSdf,
      answers,
      description,
    },
    timeoutMs: 180000,
  });
  ensureOk(res, 'Clarify project');
  return res.data;
}

function buildScenarioDescription(label, modules) {
  return [
    `Sprint 3 TE ${label} validation for ${modules.join(', ')} modules.`,
    'The company needs complete ERP setup with clear entities, routes, and workflows.',
    'Please produce a valid and complete SDF with practical fields, relations, and business rules.',
    'Ensure clarifying questions are generated when information is missing and set sdf_complete correctly.',
  ].join(' ');
}

async function runIterativeScenario({
  baseUrl,
  token,
  label,
  modules,
  maxRounds,
}) {
  const created = await createProject({
    baseUrl,
    token,
    name: `TE-${safeName(label)}-${Date.now()}`,
  });

  let questionnaire = await getDefaultQuestions({
    baseUrl,
    token,
    projectId: created.id,
    modules,
  });

  // Save answers repeatedly in case conditional questions appear after first pass.
  for (let i = 0; i < 4; i++) {
    const completion = questionnaire.prefill_validation || questionnaire.completion;
    if (completion?.is_complete) break;
    questionnaire = await saveDefaultAnswers({
      baseUrl,
      token,
      projectId: created.id,
      modules,
      questions: questionnaire.questions,
    });
  }

  const completion = questionnaire.prefill_validation || questionnaire.completion;
  if (!completion?.is_complete) {
    throw new Error(`Mandatory default questions are still incomplete for project ${created.id}`);
  }

  const description = buildScenarioDescription(label, modules);
  let response = await analyzeProject({
    baseUrl,
    token,
    projectId: created.id,
    modules,
    mandatoryAnswers: questionnaire.mandatory_answers || {},
    prefilledSdf: questionnaire.prefilled_sdf || undefined,
    description,
  });

  let rounds = 1;
  let questions = Array.isArray(response.questions) ? response.questions : [];
  let latestSdf = response.sdf;
  let latestComplete = Boolean(response.sdf_complete || latestSdf?.sdf_complete);

  while (questions.length > 0 && rounds < maxRounds) {
    response = await clarifyProject({
      baseUrl,
      token,
      projectId: created.id,
      partialSdf: latestSdf,
      description,
      questions,
    });
    rounds += 1;
    questions = Array.isArray(response.questions) ? response.questions : [];
    latestSdf = response.sdf;
    latestComplete = Boolean(response.sdf_complete || latestSdf?.sdf_complete);
  }

  return {
    projectId: created.id,
    modules,
    roundsExecuted: rounds,
    unresolvedQuestionCount: questions.length,
    sdfComplete: latestComplete,
    latestSdf,
  };
}

async function objective131(context) {
  const single = await runIterativeScenario({
    ...context,
    label: 'single-module',
    modules: context.singleModules,
    maxRounds: context.maxRounds,
  });

  const multi = await runIterativeScenario({
    ...context,
    label: 'multi-module',
    modules: context.multiModules,
    maxRounds: context.maxRounds,
  });

  context.runtime.singleProjectId = single.projectId;
  context.runtime.multiProjectId = multi.projectId;
  context.runtime.multiLatestSdf = multi.latestSdf;

  return {
    status: 'pass',
    details: {
      single,
      multi,
    },
  };
}

async function ensureMultiProjectForGeneration(context) {
  if (context.runtime.multiProjectId) {
    return context.runtime.multiProjectId;
  }
  const multi = await runIterativeScenario({
    ...context,
    label: 'multi-for-generation',
    modules: context.multiModules,
    maxRounds: context.maxRounds,
  });
  context.runtime.multiProjectId = multi.projectId;
  context.runtime.multiLatestSdf = multi.latestSdf;
  return multi.projectId;
}

async function objective132() {
  const projectRoutes = readText('platform/backend/src/routes/projectRoutes.js');
  const projectDetailPage = readText('platform/frontend/src/pages/ProjectDetailPage.tsx');

  const hasDedicatedChatBuildMode =
    projectRoutes.includes('/chat-mode') ||
    projectRoutes.includes('/build-mode') ||
    projectDetailPage.toLowerCase().includes('switch to build');

  if (hasDedicatedChatBuildMode) {
    return {
      status: 'pass',
      details: {
        message: 'Dedicated chat/build mode markers detected.',
      },
    };
  }

  return {
    status: 'blocked',
    details: {
      message: 'Dedicated chat mode -> build mode workflow is not explicitly implemented yet.',
      fallback_checked: [
        'mandatory default-question gating',
        'explicit finalize action in clarification UI',
      ],
    },
  };
}

async function objective133(context) {
  const projectId = await ensureMultiProjectForGeneration(context);
  const platforms = context.platforms;

  const zipRunId = nowStamp();
  const zipOutDir = path.join(REPORT_DIR, zipRunId, 'zips');
  if (context.saveZips) ensureDir(zipOutDir);

  const artifacts = {};

  // Standard ERP zip.
  const standardRes = await httpBinary({
    baseUrl: context.baseUrl,
    route: `/api/projects/${projectId}/generate`,
    method: 'POST',
    token: context.token,
    timeoutMs: 600000,
  });
  ensureOk(standardRes, 'Generate standard ERP zip');
  if (standardRes.data.length < 4 || standardRes.data.toString('utf8', 0, 2) !== 'PK') {
    throw new Error('Standard ERP zip response is not a valid ZIP stream');
  }
  if (context.saveZips) {
    const stdPath = path.join(zipOutDir, `standard-${projectId}.zip`);
    fs.writeFileSync(stdPath, standardRes.data);
    artifacts.standard_zip = path.relative(ROOT, stdPath);
  } else {
    artifacts.standard_zip_bytes = standardRes.data.length;
  }

  // Standalone zips for requested platforms.
  artifacts.standalone = {};
  for (const platform of platforms) {
    const route = `/api/projects/${projectId}/generate/standalone?platform=${encodeURIComponent(platform)}`;
    const res = await httpBinary({
      baseUrl: context.baseUrl,
      route,
      method: 'POST',
      token: context.token,
      timeoutMs: 900000,
    });
    ensureOk(res, `Generate standalone zip (${platform})`);
    if (res.data.length < 4 || res.data.toString('utf8', 0, 2) !== 'PK') {
      throw new Error(`Standalone zip for ${platform} is not a valid ZIP stream`);
    }

    if (context.saveZips) {
      const outPath = path.join(zipOutDir, `standalone-${platform}-${projectId}.zip`);
      fs.writeFileSync(outPath, res.data);
      artifacts.standalone[platform] = path.relative(ROOT, outPath);
    } else {
      artifacts.standalone[platform] = { bytes: res.data.length };
    }
  }

  return {
    status: 'pass',
    details: {
      projectId,
      artifacts,
    },
  };
}

async function objective134(context) {
  const projectId = await ensureMultiProjectForGeneration(context);

  const latestRes = await httpJson({
    baseUrl: context.baseUrl,
    route: `/api/projects/${projectId}/sdf/latest`,
    method: 'GET',
    token: context.token,
  });
  ensureOk(latestRes, 'Get latest SDF');

  const latestSdf = latestRes.data?.sdf;
  if (!latestSdf || typeof latestSdf !== 'object') {
    throw new Error('No latest SDF available for review workflow test');
  }

  const editedSdf = JSON.parse(JSON.stringify(latestSdf));
  editedSdf.review_meta = {
    ...(editedSdf.review_meta || {}),
    reviewed_by: 'TE',
    reviewed_at: new Date().toISOString(),
    note: 'Sprint 3 review smoke test',
  };

  const saveRes = await httpJson({
    baseUrl: context.baseUrl,
    route: `/api/projects/${projectId}/sdf/save`,
    method: 'POST',
    token: context.token,
    body: { sdf: editedSdf },
  });
  ensureOk(saveRes, 'Save reviewed SDF');

  const aiEditRes = await httpJson({
    baseUrl: context.baseUrl,
    route: `/api/projects/${projectId}/sdf/ai-edit`,
    method: 'POST',
    token: context.token,
    body: {
      instructions:
        'Keep existing schema and modules. Add a short top-level review_note string saying "Reviewed by TE". Return valid SDF JSON.',
    },
    timeoutMs: 180000,
  });

  if (!aiEditRes.ok) {
    const errText = extractErrorMessage(aiEditRes.data).toLowerCase();
    const blockedByAiInfra =
      aiEditRes.status === 503 ||
      errText.includes('ai service is not configured') ||
      errText.includes('connect') ||
      errText.includes('refused') ||
      errText.includes('timeout');

    if (blockedByAiInfra) {
      return {
        status: 'blocked',
        details: {
          projectId,
          save_sdf_version: saveRes.data?.sdf_version || null,
          blocked_reason: extractErrorMessage(aiEditRes.data),
          message: 'Save/revise baseline is testable; AI revise step blocked by gateway/AI availability.',
        },
      };
    }

    throw new Error(`AI edit failed (${aiEditRes.status}): ${extractErrorMessage(aiEditRes.data)}`);
  }

  return {
    status: 'pass',
    details: {
      projectId,
      save_sdf_version: saveRes.data?.sdf_version || null,
      ai_edit_sdf_version: aiEditRes.data?.sdf_version || null,
    },
  };
}

async function objective135(context) {
  const tempProject = await createProject({
    baseUrl: context.baseUrl,
    token: context.token,
    name: `TE-delete-check-${Date.now()}`,
  });

  const delRes = await httpJson({
    baseUrl: context.baseUrl,
    route: `/api/projects/${tempProject.id}`,
    method: 'DELETE',
    token: context.token,
  });
  ensureOk(delRes, 'Delete project');

  const projects = await listProjects({
    baseUrl: context.baseUrl,
    token: context.token,
  });
  const isInList = projects.some((p) => p.id === tempProject.id);
  if (isInList) {
    throw new Error('Deleted project still appears in project list');
  }

  const projectModel = readText('platform/backend/src/models/Project.js');
  const authRoutes = readText('platform/backend/src/routes/authRoutes.js');

  const blockers = [];
  if (projectModel.includes('DELETE FROM projects')) {
    blockers.push('Project soft-delete is not implemented (hard DELETE SQL is used).');
  }

  const hasAccountDeleteEndpoint =
    authRoutes.includes("router.delete('/account'") ||
    authRoutes.includes("router.delete('/me'") ||
    authRoutes.includes('deleteAccount');
  if (!hasAccountDeleteEndpoint) {
    blockers.push('Account soft-delete endpoint is not implemented in auth routes.');
  }

  if (blockers.length) {
    return {
      status: 'blocked',
      details: {
        runtime_delete_and_filter_check: 'pass',
        blockers,
      },
    };
  }

  return {
    status: 'pass',
    details: {
      runtime_delete_and_filter_check: 'pass',
      model_route_check: 'pass',
    },
  };
}

function runNodeScript(relativePath, args = []) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script not found: ${relativePath}`);
  }

  const run = spawnSync(process.execPath, [fullPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (run.status !== 0) {
    throw new Error(`${relativePath} exited with code ${run.status}`);
  }
}

async function objective136() {
  const scripts = [
    ['test/verify_features_ea.js', []],
    ['test/invoice_bricks.unit.test.js', []],
    ['test/hr_bricks.unit.test.js', []],
    ['test/module_generation.integration.test.js', []],
  ];

  for (const [script, args] of scripts) {
    runNodeScript(script, args);
  }

  return {
    status: 'pass',
    details: {
      scripts: scripts.map(([script]) => script),
    },
  };
}

async function objective137(context) {
  const runs = [
    ['test/sprint3_te_regression.test.js', []],
    ['test/sprint3_te_regression.test.js', ['--run-regression']],
  ];

  if (context.includeApiSurfaceInPack) {
    runs.push(['test/sprint3_te_regression.test.js', ['--run-regression', '--run-api-surface']]);
  }

  for (const [script, args] of runs) {
    runNodeScript(script, args);
  }

  return {
    status: 'pass',
    details: {
      runs: runs.map(([script, args]) => `${script} ${args.join(' ')}`.trim()),
    },
  };
}

async function objective138(context) {
  const hasTemplate = fs.existsSync(DEFECT_LOG_TEMPLATE_PATH);
  if (!hasTemplate) {
    return {
      status: 'fail',
      details: {
        message: `Defect log template missing: ${path.relative(ROOT, DEFECT_LOG_TEMPLATE_PATH)}`,
      },
    };
  }

  return {
    status: 'pass',
    details: {
      message: 'Run report generated. Log defects and retest evidence in the template file.',
      defect_log_template: path.relative(ROOT, DEFECT_LOG_TEMPLATE_PATH),
      report_directory: path.relative(ROOT, REPORT_DIR),
      retest_hint:
        'Re-run failed objectives only, e.g. --objectives=133,134 and attach new report to the same defect IDs.',
      retest_of: context.retestOf || null,
    },
  };
}

function printHelp() {
  const lines = [
    'Sprint 3 TE objective runner',
    '',
    'Required for API objectives: backend + AI gateway running locally.',
    '',
    'Options:',
    '  --objectives=131,132,133,134,135,138   Objective IDs to run',
    '  --backend-url=http://localhost:3000     Backend base URL',
    '  --email=<email>                         Login/register email',
    '  --password=<password>                   Login/register password',
    '  --name=<display-name>                   User display name',
    '  --single-modules=invoice                Modules for objective 131 single test',
    '  --multi-modules=inventory,invoice,hr    Modules for objective 131 multi test',
    '  --max-rounds=3                          Max clarify rounds per scenario',
    '  --platforms=windows-x64,macos-x64,linux-x64   Objective 133 standalone matrix',
    '  --save-zips                             Save generated ZIP artifacts under test-results',
    '  --include-api-surface-in-pack           Objective 137 also runs --run-api-surface',
    '  --retest-of=<defect-id or run-id>       Tag report with retest reference',
    '  --help                                  Show this help',
  ];
  console.log(lines.join('\n'));
}

function createRunContext(args) {
  const startedAt = new Date().toISOString();
  const stamp = nowStamp();
  const backendUrl = (args.values['backend-url'] || 'http://localhost:3000').replace(/\/+$/, '');
  const email = args.values.email || `te.sprint3.${Date.now()}@example.com`;
  const password = args.values.password || 'Test123!';
  const name = args.values.name || 'TE Sprint 3';
  const objectives = parseCsv(args.values.objectives, DEFAULT_OBJECTIVES);
  const singleModules = parseCsv(args.values['single-modules'], ['invoice']);
  const multiModules = parseCsv(args.values['multi-modules'], ['inventory', 'invoice', 'hr']);
  const platforms = parseCsv(args.values.platforms, DEFAULT_PLATFORMS);
  const maxRounds = Number(args.values['max-rounds'] || DEFAULT_MAX_ROUNDS);

  return {
    startedAt,
    stamp,
    baseUrl: backendUrl,
    email,
    password,
    name,
    objectives,
    singleModules,
    multiModules,
    platforms,
    maxRounds: Number.isFinite(maxRounds) && maxRounds > 0 ? maxRounds : DEFAULT_MAX_ROUNDS,
    saveZips: args.flags.has('save-zips'),
    includeApiSurfaceInPack: args.flags.has('include-api-surface-in-pack'),
    retestOf: args.values['retest-of'] || null,
    token: null,
    runtime: {},
  };
}

function initReport(context) {
  return {
    started_at: context.startedAt,
    base_url: context.baseUrl,
    objectives_requested: context.objectives,
    params: {
      single_modules: context.singleModules,
      multi_modules: context.multiModules,
      max_rounds: context.maxRounds,
      platforms: context.platforms,
      save_zips: context.saveZips,
      include_api_surface_in_pack: context.includeApiSurfaceInPack,
      retest_of: context.retestOf,
    },
    objectives: [],
    summary: {
      pass: 0,
      fail: 0,
      blocked: 0,
      skipped: 0,
    },
  };
}

function pushResult(report, id, title, outcome) {
  const status = outcome?.status || 'fail';
  report.objectives.push({
    id,
    title,
    status,
    details: outcome?.details || {},
    completed_at: new Date().toISOString(),
  });
  if (status === 'pass') report.summary.pass += 1;
  else if (status === 'blocked') report.summary.blocked += 1;
  else if (status === 'skipped') report.summary.skipped += 1;
  else report.summary.fail += 1;
}

async function runObjective(report, context, id, title, fn) {
  console.log(`\n[${id}] ${title}`);
  try {
    const outcome = await fn();
    pushResult(report, id, title, outcome);
    console.log(`Result: ${outcome.status.toUpperCase()}`);
  } catch (err) {
    pushResult(report, id, title, {
      status: 'fail',
      details: {
        error: err.message,
      },
    });
    console.log('Result: FAIL');
    console.log(`Error: ${err.message}`);
  }
}

async function ensureApiAccess(context) {
  const health = await httpJson({
    baseUrl: context.baseUrl,
    route: '/health',
    method: 'GET',
    timeoutMs: 15000,
  });
  ensureOk(health, 'Backend health check');

  context.token = await registerOrLogin({
    baseUrl: context.baseUrl,
    email: context.email,
    password: context.password,
    name: context.name,
  });
}

function saveReport(report, stamp) {
  ensureDir(REPORT_DIR);
  const reportPath = path.join(REPORT_DIR, `sprint3_te_objectives_${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

function printSummary(report, reportPath) {
  console.log('\n=== Sprint 3 TE Objective Summary ===');
  for (const row of report.objectives) {
    console.log(`[${row.id}] ${row.status.toUpperCase()} - ${row.title}`);
  }
  console.log(
    `Pass: ${report.summary.pass}, Fail: ${report.summary.fail}, Blocked: ${report.summary.blocked}, Skipped: ${report.summary.skipped}`
  );
  console.log(`Report: ${path.relative(ROOT, reportPath)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has('help')) {
    printHelp();
    return;
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node.js 18+.');
  }

  const context = createRunContext(args);
  const report = initReport(context);

  const apiObjectives = new Set(['131', '133', '134', '135']);
  const needsApi = context.objectives.some((id) => apiObjectives.has(id));
  if (needsApi) {
    await ensureApiAccess(context);
  }

  const objectiveMap = {
    '131': {
      title: 'Iterative clarifying-question loop E2E (single + multi-module)',
      run: () => objective131(context),
    },
    '132': {
      title: 'AI chat mode -> build mode transition flow',
      run: () => objective132(context),
    },
    '133': {
      title: 'One-click executable packaging (Windows/macOS/Linux)',
      run: () => objective133(context),
    },
    '134': {
      title: 'SDF review/approve/reject/revise workflow E2E',
      run: () => objective134(context),
    },
    '135': {
      title: 'Project/account soft-delete behavior and list filtering',
      run: () => objective135(context),
    },
    '136': {
      title: 'Module-capability regression scenarios (Sprint 2 hold checks)',
      run: () => objective136(context),
    },
    '137': {
      title: 'Continuous regression pack for review+approval flows',
      run: () => objective137(context),
    },
    '138': {
      title: 'Defect logging and retest tracking loop',
      run: () => objective138(context),
    },
  };

  for (const id of context.objectives) {
    const entry = objectiveMap[id];
    if (!entry) {
      pushResult(report, id, 'Unknown objective', {
        status: 'skipped',
        details: { message: `Objective ${id} is not recognized by this runner.` },
      });
      continue;
    }
    await runObjective(report, context, id, entry.title, entry.run);
  }

  report.finished_at = new Date().toISOString();
  const reportPath = saveReport(report, context.stamp);
  printSummary(report, reportPath);

  if (report.summary.fail > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}
