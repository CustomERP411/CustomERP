import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { detectUserPlatform, usePlatformInfo } from '../components/project/projectConstants';

type PlatformKey = 'windows-x64' | 'macos-arm64' | 'macos-x64' | 'linux-x64';

const PLATFORM_ORDER: PlatformKey[] = ['windows-x64', 'macos-arm64', 'macos-x64', 'linux-x64'];

const isPlatformKey = (value: string | null): value is PlatformKey =>
  !!value && PLATFORM_ORDER.includes(value as PlatformKey);

function formatStep(step: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value),
    step,
  );
}

export default function SetupPage() {
  const { t } = useTranslation(['setup', 'common']);
  const [searchParams] = useSearchParams();
  const platformInfo = usePlatformInfo();

  const requestedPlatform = searchParams.get('platform');
  const detectedPlatform = detectUserPlatform();
  const initialPlatform = isPlatformKey(requestedPlatform)
    ? requestedPlatform
    : (isPlatformKey(detectedPlatform) ? detectedPlatform : 'windows-x64');

  const [openPlatform, setOpenPlatform] = useState<PlatformKey>(initialPlatform);

  useEffect(() => {
    setOpenPlatform(initialPlatform);
  }, [initialPlatform]);

  const fileName = searchParams.get('file') || t('defaults.fileName');
  const projectName = searchParams.get('project') || t('defaults.projectName');

  const platforms = useMemo(
    () => PLATFORM_ORDER.map((key) => ({
      key,
      ...platformInfo[key],
      intro: t(`platforms.${key}.intro`),
      steps: t(`platforms.${key}.steps`, { returnObjects: true }) as string[],
    })),
    [platformInfo, t],
  );

  const importantNotes = t('importantNotes.items', { returnObjects: true }) as Array<{ title: string; body: string }>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-app-border bg-app-surface-elevated p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-app-accent-blue">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-app-text sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-app-text-muted">
              {t('subtitle', { projectName })}
            </p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-surface-muted p-4 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-app-text-subtle">
              {t('downloadedFile')}
            </div>
            <div className="mt-1 break-all font-mono text-app-text">{fileName}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {importantNotes.map((note) => (
          <article key={note.title} className="rounded-xl border border-app-border bg-app-surface p-4">
            <h2 className="text-sm font-semibold text-app-text">{note.title}</h2>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">{note.body}</p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-app-text">{t('chooseOsTitle')}</h2>
          <p className="mt-1 text-sm text-app-text-muted">{t('chooseOsSubtitle')}</p>
        </div>

        <div className="space-y-3">
          {platforms.map((platform) => {
            const isOpen = openPlatform === platform.key;
            return (
              <article key={platform.key} className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
                <button
                  type="button"
                  onClick={() => setOpenPlatform(platform.key)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-app-surface-hover sm:px-5"
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-app-text">{platform.label}</div>
                    <div className="mt-1 text-xs text-app-text-muted">
                      {t('startFileLabel')} <code className="rounded bg-app-surface-muted px-1 py-0.5">{platform.startFile}</code>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 shrink-0 text-app-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-app-border px-4 py-5 sm:px-5">
                    <p className="text-sm leading-6 text-app-text-muted">{platform.intro}</p>
                    <ol className="mt-4 space-y-3">
                      {platform.steps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-accent-blue text-xs font-bold text-app-text-inverse">
                            {index + 1}
                          </span>
                          <span className="pt-1 text-sm leading-6 text-app-text">
                            {formatStep(step, {
                              fileName,
                              startFile: platform.startFile,
                              projectName,
                            })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
