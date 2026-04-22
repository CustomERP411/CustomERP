import { useState, useEffect, type ReactNode } from 'react';

const MOBILE_BREAKPOINT = 768;

export default function MobileGate({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);

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
      <h1 className="text-2xl font-bold text-white mb-3">Desktop Experience Only</h1>
      <p className="text-indigo-200 text-base leading-relaxed max-w-sm mb-10">
        CustomERP is a powerful ERP generation platform designed for desktop use.
        Please visit us on a computer for the best experience.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          AI-Powered Generation
        </span>
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          Live ERP Preview
        </span>
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-sm text-white font-medium backdrop-blur-sm">
          No Coding Required
        </span>
      </div>

      {/* Visual hint */}
      <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-6 max-w-sm">
        <div className="flex items-center gap-3 text-left">
          <svg className="w-6 h-6 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <p className="text-white text-sm">Open <span className="font-semibold text-emerald-400">customerp.site</span> on your desktop browser to get started.</p>
        </div>
      </div>

      <p className="mt-12 text-indigo-300 text-xs">
        © 2026 CustomERP. Bilkent University CTIS Project.
      </p>
    </div>
  );
}
