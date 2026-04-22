import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enAuth from './locales/en/auth.json';
import enSidebar from './locales/en/sidebar.json';
import enProjects from './locales/en/projects.json';
import enProjectDetail from './locales/en/projectDetail.json';
import enSdf from './locales/en/sdf.json';
import enChatbot from './locales/en/chatbot.json';
import enSettings from './locales/en/settings.json';
import enAdmin from './locales/en/admin.json';
import enErrors from './locales/en/errors.json';
import enMyRequests from './locales/en/myRequests.json';
import enPreviewPage from './locales/en/previewPage.json';

import trCommon from './locales/tr/common.json';
import trLanding from './locales/tr/landing.json';
import trAuth from './locales/tr/auth.json';
import trSidebar from './locales/tr/sidebar.json';
import trProjects from './locales/tr/projects.json';
import trProjectDetail from './locales/tr/projectDetail.json';
import trSdf from './locales/tr/sdf.json';
import trChatbot from './locales/tr/chatbot.json';
import trSettings from './locales/tr/settings.json';
import trAdmin from './locales/tr/admin.json';
import trErrors from './locales/tr/errors.json';
import trMyRequests from './locales/tr/myRequests.json';
import trPreviewPage from './locales/tr/previewPage.json';

export const SUPPORTED_LANGUAGES = ['en', 'tr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'customerp_language';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  tr: 'Türkçe',
};

export function normalizeLanguage(lang: string | null | undefined): SupportedLanguage {
  if (!lang) return 'en';
  const lower = lang.toLowerCase();
  if (lower.startsWith('tr')) return 'tr';
  return 'en';
}

const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    auth: enAuth,
    sidebar: enSidebar,
    projects: enProjects,
    projectDetail: enProjectDetail,
    sdf: enSdf,
    chatbot: enChatbot,
    settings: enSettings,
    admin: enAdmin,
    errors: enErrors,
    myRequests: enMyRequests,
    previewPage: enPreviewPage,
  },
  tr: {
    common: trCommon,
    landing: trLanding,
    auth: trAuth,
    sidebar: trSidebar,
    projects: trProjects,
    projectDetail: trProjectDetail,
    sdf: trSdf,
    chatbot: trChatbot,
    settings: trSettings,
    admin: trAdmin,
    errors: trErrors,
    myRequests: trMyRequests,
    previewPage: trPreviewPage,
  },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    defaultNS: 'common',
    ns: [
      'common',
      'landing',
      'auth',
      'sidebar',
      'projects',
      'projectDetail',
      'sdf',
      'chatbot',
      'settings',
      'admin',
      'errors',
      'myRequests',
      'previewPage',
    ],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

export async function setAppLanguage(lang: SupportedLanguage): Promise<void> {
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* ignore storage errors */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export function getCurrentLanguage(): SupportedLanguage {
  return normalizeLanguage(i18n.language);
}

export default i18n;
