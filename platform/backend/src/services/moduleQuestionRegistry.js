const hrV1Pack = require('../defaultQuestions/packs/hr.v1');
const inventoryV1Pack = require('../defaultQuestions/packs/inventory.v1');
const invoiceV1Pack = require('../defaultQuestions/packs/invoice.v1');

const PACKS_BY_MODULE = {
  inventory: [inventoryV1Pack],
  invoice: [invoiceV1Pack],
  hr: [hrV1Pack],
};

const ACTIVE_VERSION_BY_MODULE = {
  inventory: 'inventory.v1',
  invoice: 'invoice.v1-temp',
  hr: 'hr.v1-temp',
};

function listSupportedModules() {
  return Object.keys(PACKS_BY_MODULE);
}

function normalizeModuleList(modules) {
  const supported = new Set(listSupportedModules());
  const requested = Array.isArray(modules) ? modules : [];
  const normalized = requested
    .map((moduleKey) => String(moduleKey || '').trim().toLowerCase())
    .filter((moduleKey) => supported.has(moduleKey));

  const unique = [];
  const seen = new Set();
  for (const moduleKey of normalized) {
    if (seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    unique.push(moduleKey);
  }

  return unique;
}

function getActivePack(moduleKey) {
  const packs = PACKS_BY_MODULE[moduleKey] || [];
  const activeVersion = ACTIVE_VERSION_BY_MODULE[moduleKey];
  const active = packs.find((pack) => pack.version === activeVersion);
  if (!active) {
    throw new Error(`No active question pack configured for module "${moduleKey}"`);
  }
  return active;
}

function normalizeQuestion(moduleKey, pack, question, orderOffset) {
  return {
    id: `${pack.version}::${question.key}`,
    key: question.key,
    module: moduleKey,
    version: pack.version,
    template_type: pack.template_type,
    prompt: question.prompt,
    type: question.type || 'text',
    required: question.required !== false,
    allow_custom: question.allow_custom === true,
    options: Array.isArray(question.options) ? question.options : undefined,
    condition: question.condition || undefined,
    section: question.section || 'General',
    order_index: typeof question.order_index === 'number' ? question.order_index + orderOffset : orderOffset,
    sdf_mapping: question.sdf_mapping || { target: `constraints.${moduleKey}.${question.key}` },
  };
}

function getQuestionTemplatePayload(modules) {
  const moduleList = normalizeModuleList(modules);
  const requestedModules = moduleList.length ? moduleList : ['inventory', 'invoice', 'hr'];

  const modulesPayload = {};
  const questions = [];
  let orderOffset = 0;

  for (const moduleKey of requestedModules) {
    const pack = getActivePack(moduleKey);
    const packQuestions = Array.isArray(pack.getQuestions()) ? pack.getQuestions() : [];

    const normalizedQuestions = packQuestions.map((question, index) =>
      normalizeQuestion(moduleKey, pack, question, orderOffset + index)
    );

    modulesPayload[moduleKey] = {
      version: pack.version,
      template_type: pack.template_type,
      total_questions: normalizedQuestions.length,
      source_path: pack.source_path || null,
    };

    questions.push(...normalizedQuestions);
    orderOffset += normalizedQuestions.length;
  }

  return {
    template_versions: modulesPayload,
    questions,
  };
}

module.exports = {
  listSupportedModules,
  normalizeModuleList,
  getQuestionTemplatePayload,
};
