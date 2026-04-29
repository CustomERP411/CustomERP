const hrV1Pack = require('../defaultQuestions/packs/hr.v1');
const inventoryV1Pack = require('../defaultQuestions/packs/inventory.v1');
const invoiceV1Pack = require('../defaultQuestions/packs/invoice.v1');

// Plan C — wizard wiring. Three new pack versions ship the cross-pack link
// toggles. Old packs stay registered so legacy stored answers still resolve.
const hrV3Pack = require('../defaultQuestions/packs/hr.v3');
const invoiceV3Pack = require('../defaultQuestions/packs/invoice.v3');
const inventoryV4Pack = require('../defaultQuestions/packs/inventory.v4');

// Plan I — invoice.v4 adds the `invoice_payment_methods` multi-choice
// question. v3 stays registered so legacy stored answers still resolve.
const invoiceV4Pack = require('../defaultQuestions/packs/invoice.v4');

const hrV2TrTranslations = require('../defaultQuestions/translations/hr.v2.tr');
const invoiceV2TrTranslations = require('../defaultQuestions/translations/invoice.v2.tr');
const inventoryV3TrTranslations = require('../defaultQuestions/translations/inventory.v3.tr');
const hrV3TrTranslations = require('../defaultQuestions/translations/hr.v3.tr');
const invoiceV3TrTranslations = require('../defaultQuestions/translations/invoice.v3.tr');
const inventoryV4TrTranslations = require('../defaultQuestions/translations/inventory.v4.tr');
const invoiceV4TrTranslations = require('../defaultQuestions/translations/invoice.v4.tr');

const PACKS_BY_MODULE = {
  inventory: [inventoryV1Pack, inventoryV4Pack],
  invoice: [invoiceV1Pack, invoiceV3Pack, invoiceV4Pack],
  hr: [hrV1Pack, hrV3Pack],
};

const ACTIVE_VERSION_BY_MODULE = {
  inventory: 'inventory.v4',
  invoice: 'invoice.v4',
  hr: 'hr.v3',
};

// Translation tables keyed by pack version; each resolves to per-language
// `prompts` and `optionLabels` dictionaries. Adding a new language for an
// existing module is just a matter of registering another table here.
const TRANSLATIONS_BY_VERSION = {
  'hr.v2': { tr: hrV2TrTranslations },
  'invoice.v2': { tr: invoiceV2TrTranslations },
  'inventory.v3': { tr: inventoryV3TrTranslations },
  'hr.v3': { tr: hrV3TrTranslations },
  'invoice.v3': { tr: invoiceV3TrTranslations },
  'inventory.v4': { tr: inventoryV4TrTranslations },
  'invoice.v4': { tr: invoiceV4TrTranslations },
};

const SUPPORTED_QUESTION_LANGUAGES = new Set(['en', 'tr']);

function normalizeQuestionLanguage(language) {
  const raw = String(language || '').toLowerCase();
  return SUPPORTED_QUESTION_LANGUAGES.has(raw) ? raw : 'en';
}

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

function getTranslation(version, language) {
  if (language === 'en') return null;
  const table = TRANSLATIONS_BY_VERSION[version];
  return (table && table[language]) || null;
}

function localizeOptions(options, key, translation) {
  if (!Array.isArray(options)) return undefined;
  if (!translation || !translation.optionLabels || !translation.optionLabels[key]) {
    return options.slice();
  }
  const labelMap = translation.optionLabels[key];
  // Keep option VALUES unchanged (they are the stored slug values) and emit a
  // parallel `option_labels` map for the frontend to render.
  return options.slice();
}

function buildOptionLabels(options, key, translation) {
  if (!Array.isArray(options) || !translation || !translation.optionLabels) return undefined;
  const labelMap = translation.optionLabels[key];
  if (!labelMap) return undefined;
  const labels = {};
  let hit = false;
  for (const opt of options) {
    if (Object.prototype.hasOwnProperty.call(labelMap, opt)) {
      labels[opt] = labelMap[opt];
      hit = true;
    }
  }
  return hit ? labels : undefined;
}

function normalizeQuestion(moduleKey, pack, question, orderOffset, translation) {
  const localizedPrompt = translation && translation.prompts && translation.prompts[question.key]
    ? translation.prompts[question.key]
    : question.prompt;
  const options = localizeOptions(question.options, question.key, translation);
  const optionLabels = buildOptionLabels(question.options, question.key, translation);

  const normalized = {
    id: `${pack.version}::${question.key}`,
    key: question.key,
    module: moduleKey,
    version: pack.version,
    template_type: pack.template_type,
    prompt: localizedPrompt,
    type: question.type || 'text',
    required: question.required !== false,
    allow_custom: question.allow_custom === true,
    options,
    condition: question.condition || undefined,
    section: question.section || 'General',
    order_index: typeof question.order_index === 'number' ? question.order_index + orderOffset : orderOffset,
    sdf_mapping: question.sdf_mapping || { target: `constraints.${moduleKey}.${question.key}` },
  };

  if (optionLabels) {
    normalized.option_labels = optionLabels;
  }

  return normalized;
}

function getQuestionTemplatePayload(modules, options = {}) {
  const moduleList = normalizeModuleList(modules);
  const requestedModules = moduleList.length ? moduleList : ['inventory', 'invoice', 'hr'];
  const language = normalizeQuestionLanguage(options.language);

  const modulesPayload = {};
  const questions = [];
  let orderOffset = 0;

  for (const moduleKey of requestedModules) {
    const pack = getActivePack(moduleKey);
    const packQuestions = Array.isArray(pack.getQuestions()) ? pack.getQuestions() : [];
    const translation = getTranslation(pack.version, language);

    const normalizedQuestions = packQuestions.map((question, index) =>
      normalizeQuestion(moduleKey, pack, question, orderOffset + index, translation)
    );

    modulesPayload[moduleKey] = {
      version: pack.version,
      template_type: pack.template_type,
      total_questions: normalizedQuestions.length,
      source_path: pack.source_path || null,
      language,
    };

    questions.push(...normalizedQuestions);
    orderOffset += normalizedQuestions.length;
  }

  return {
    template_versions: modulesPayload,
    questions,
    language,
  };
}

module.exports = {
  listSupportedModules,
  normalizeModuleList,
  getQuestionTemplatePayload,
  normalizeQuestionLanguage,
};
