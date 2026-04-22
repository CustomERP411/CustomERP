import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const MOBILE_BREAKPOINT = 768;

export default function MobileGate({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const { t } = useTranslation(['errors', 'landing']);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isMobile) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-indigo-600 font-bold text-2xl">C</span>
        </div>
        <div className="text-3xl font-bold text-white">
          <span className="text-emerald-400">Custom</span>ERP
        </div>
      </div>

      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      </div>

      {/* Message */}
      <h1 className="text-2xl font-bold text-white mb-3">{t('errors:mobileBlocked.title')}</h1>
      <p className="text-indigo-200 text-base leading-relaxed max-w-sm mb-10">
        {t('errors:mobileBlocked.body')}
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          {t('landing:pills.aiPowered')}
        </span>
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          {t('landing:pills.deployFast')}
        </span>
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          {t('landing:pills.noCoding')}
        </span>
      </div>

      <p className="mt-12 text-indigo-300 text-xs">{t('landing:footer.copyright')}</p>
    </div>
  );
}
