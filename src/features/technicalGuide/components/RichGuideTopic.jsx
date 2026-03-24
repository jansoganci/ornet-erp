import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ListChecks,
  Lock,
  MapPin,
  Monitor,
  Router,
  Search,
  Share2,
  ShieldAlert,
  Smartphone,
  Video,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

/** İkonlar: modem → DVR bul → sabitle → port listesi → NAT → test */
const STEP_ICONS = [Router, Search, Lock, ListChecks, Share2, Smartphone];

const PORT_ICONS = [Monitor, Smartphone, Video];

/**
 * Zengin rehber: metin `content/*.js` modülünden gelir (Türkçe doküman doğrudan kaynak dosyada).
 */
export function RichGuideTopic({ content }) {
  const { t } = useTranslation('technicalGuide');

  const flowItemsRaw = content.flowItems;
  const flowLabelsFallback = content.flowLabels;
  const flowSafe =
    Array.isArray(flowItemsRaw) && flowItemsRaw.length > 0
      ? flowItemsRaw
      : Array.isArray(flowLabelsFallback)
        ? flowLabelsFallback.map((label) => ({ label }))
        : [];

  const stepsSafe = Array.isArray(content.steps) ? content.steps : [];
  const portsSafe = Array.isArray(content.ports) ? content.ports : [];
  const glossarySafe = Array.isArray(content.glossary) ? content.glossary : [];
  const checklistSafe = Array.isArray(content.checklist) ? content.checklist : [];

  const forwardingTitle = content.forwardingTitle ?? '';
  const forwardingBody = content.forwardingBody ?? '';
  const portsTitle = content.portsSectionTitle ?? '';
  const glossaryTitle = content.glossaryTitle ?? '';
  const checklistTitle = content.checklistTitle ?? '';
  const securityNote = content.securityNote ?? '';
  const externalStaticTitle = content.externalStaticTitle ?? '';
  const externalStaticBody = content.externalStaticBody ?? '';
  const externalStaticBridge = content.externalStaticBridge ?? '';

  const highlightAlerts = Array.isArray(content.highlightAlerts) ? content.highlightAlerts : [];

  return (
    <div className="space-y-10">
      {highlightAlerts.length > 0 ? (
        <section className="space-y-3" aria-label={t('rich.goldenRulesTitle')}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            {t('rich.goldenRulesTitle')}
          </h3>
          <div className="space-y-3">
            {highlightAlerts.map((alert, i) => (
              <aside
                key={i}
                className={cn(
                  'flex gap-3 rounded-2xl border border-amber-300/90 bg-amber-50 p-4 shadow-sm',
                  'dark:border-amber-800/60 dark:bg-amber-950/35'
                )}
              >
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
                  aria-hidden
                />
                <div className="min-w-0 space-y-1">
                  {alert.title ? (
                    <p className="font-semibold text-amber-950 dark:text-amber-100">{alert.title}</p>
                  ) : null}
                  <p className="text-sm leading-relaxed text-amber-950/95 dark:text-amber-50/95 whitespace-pre-wrap">
                    {alert.text}
                  </p>
                </div>
              </aside>
            ))}
          </div>
        </section>
      ) : null}

      {flowSafe.length > 0 && (
        <>
          {/* Mobile: compact vertical timeline (read-only, minimal height) */}
          <section
            className="md:hidden -mx-4 px-4 sm:-mx-6 sm:px-6"
            aria-label={t('rich.flowCaption')}
          >
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-500">
              {t('rich.flowCaption')}
            </h3>
            <ol className="m-0 list-none bg-neutral-100 p-0 dark:bg-[#0e0e0e]">
              {flowSafe.map((item, i) => {
                const label = typeof item === 'string' ? item : item.label;
                const hint = typeof item === 'object' && item !== null && item.hint ? item.hint : '';
                const isLast = i === flowSafe.length - 1;
                return (
                  <li key={i} className="flex items-stretch gap-3">
                    <div className="flex w-7 shrink-0 flex-col items-center self-stretch">
                      <span
                        className={cn(
                          'relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                          'bg-neutral-300 text-[11px] font-bold leading-none text-neutral-900',
                          'dark:bg-neutral-500 dark:text-neutral-950',
                        )}
                      >
                        {isLast ? (
                          <Check
                            className="h-3.5 w-3.5 stroke-[2.5] text-neutral-900 dark:text-neutral-950"
                            aria-hidden
                          />
                        ) : (
                          <span className="tabular-nums">{i + 1}</span>
                        )}
                      </span>
                      {!isLast ? (
                        <div
                          className="mt-0 w-[2px] flex-1 min-h-[10px] self-center bg-neutral-300 dark:bg-[#262626]"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        'min-w-0 flex-1 border-0 pb-2.5 pt-0.5 shadow-none',
                        isLast ? 'pb-0' : '',
                      )}
                    >
                      <p className="truncate text-sm font-bold leading-tight text-neutral-900 dark:text-white">
                        {label}
                      </p>
                      {hint ? (
                        <p className="mt-0.5 text-xs leading-snug text-neutral-600 dark:text-[#adaaaa]">
                          {hint}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Tablet/desktop: card list without arrows */}
          <div className="hidden md:block rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-4 dark:border-[#262626] dark:bg-[#1a1a1a]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
              {t('rich.flowCaption')}
            </p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {flowSafe.map((item, i) => {
                const label = typeof item === 'string' ? item : item.label;
                const hint = typeof item === 'object' && item !== null && item.hint ? item.hint : '';
                return (
                  <li key={i}>
                    <div className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-[#333] dark:bg-[#262626]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white dark:bg-primary-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{label}</span>
                        {hint ? (
                          <p className="mt-1 text-xs font-medium text-primary-700 dark:text-primary-300">{hint}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{t('rich.stepsHeading')}</h3>
        <ol className="space-y-5">
          {stepsSafe.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? MapPin;
            const ex = typeof step.example === 'string' ? step.example.trim() : '';
            const subnoteTitle = typeof step.subnoteTitle === 'string' ? step.subnoteTitle.trim() : '';
            const subnoteBody = typeof step.subnoteBody === 'string' ? step.subnoteBody.trim() : '';
            const rawRows = step.rows;
            const rows = Array.isArray(rawRows) ? rawRows : [];
            const hasRows = rows.length > 0;
            const bodyText = typeof step.body === 'string' ? step.body.trim() : '';
            return (
              <li
                key={index}
                className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-[#262626] dark:bg-[#1a1a1a]"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-6">
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center sm:text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-md dark:bg-primary-600 dark:text-white">
                      <span className="text-sm font-bold tabular-nums">{index + 1}</span>
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-50">{step.title}</h4>
                    {bodyText ? (
                      <p className="text-neutral-700 dark:text-neutral-300">{bodyText}</p>
                    ) : null}
                    {hasRows ? (
                      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/80 dark:border-[#333] dark:bg-[#0e0e0e]">
                        {rows.map((row, ri) => (
                          <div
                            key={ri}
                            className="grid gap-1 border-b border-neutral-200 px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,8.5rem)_1fr] sm:gap-4 dark:border-[#333]"
                          >
                            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {row.label}
                            </span>
                            <span className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                              {row.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {ex ? (
                      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-[#333] dark:bg-[#1a1a1a] dark:text-neutral-200">
                        {ex}
                      </p>
                    ) : null}
                    {subnoteTitle && subnoteBody ? (
                      <div className="rounded-xl border border-primary-200/70 bg-primary-50/50 p-4 dark:border-primary-900/45 dark:bg-primary-950/25">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{subnoteTitle}</p>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{subnoteBody}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {portsSafe.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{portsTitle}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {portsSafe.map((p, i) => {
              const PIcon = PORT_ICONS[i] ?? Monitor;
              const tone =
                i === 0
                  ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
                  : i === 1
                    ? 'border-primary-200/80 bg-primary-50/40 dark:border-primary-900/40 dark:bg-primary-950/20'
                    : 'border-violet-200/80 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20';
              return (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col rounded-xl border p-5 shadow-sm',
                    tone
                  )}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <PIcon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" aria-hidden />
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{p.label}</span>
                  </div>
                  <p className="mb-3 flex-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{p.note}</p>
                  <div className="mt-auto inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-sm font-mono font-semibold text-neutral-900 dark:bg-black/20 dark:text-neutral-100">
                    {p.portKey}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {forwardingTitle && forwardingBody ? (
        <section
          className={cn(
            'rounded-xl border border-neutral-200 bg-white p-6 dark:border-[#262626] dark:bg-[#1a1a1a]',
            'shadow-sm'
          )}
        >
          <div className="flex gap-3">
            <Router className="mt-0.5 h-6 w-6 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{forwardingTitle}</h3>
              <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">{forwardingBody}</p>
            </div>
          </div>
        </section>
      ) : null}

      {externalStaticTitle && externalStaticBody ? (
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6 dark:border-[#262626] dark:bg-[#1a1a1a]">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{externalStaticTitle}</h3>
          <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">{externalStaticBody}</p>
          {externalStaticBridge ? (
            <p className="border-t border-neutral-200 pt-4 text-sm italic text-neutral-600 dark:border-[#262626] dark:text-neutral-400">
              {externalStaticBridge}
            </p>
          ) : null}
        </section>
      ) : null}

      {glossarySafe.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{glossaryTitle}</h3>
          <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-[#262626] dark:border-[#262626] dark:bg-[#1a1a1a]">
            {glossarySafe.map((row, i) => (
              <div key={i} className="grid gap-1 px-4 py-4 sm:grid-cols-[minmax(0,0.35fr)_1fr] sm:gap-6">
                <dt className="font-medium text-neutral-900 dark:text-neutral-100">{row.term}</dt>
                <dd className="text-neutral-700 dark:text-neutral-300">{row.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {checklistSafe.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{checklistTitle}</h3>
          </div>
          <ul className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-[#262626] dark:bg-[#1a1a1a]">
            {checklistSafe.map((line, i) => (
              <li key={i} className="flex gap-3 text-neutral-800 dark:text-neutral-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {securityNote ? (
        <aside
          className={cn(
            'flex gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 p-5',
            'dark:border-amber-900/50 dark:bg-amber-950/25'
          )}
        >
          <ShieldAlert className="h-6 w-6 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">{securityNote}</p>
        </aside>
      ) : null}
    </div>
  );
}
