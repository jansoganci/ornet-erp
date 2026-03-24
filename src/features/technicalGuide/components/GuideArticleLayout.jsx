import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer, PageHeader } from '../../../components/layout';
import { cn } from '../../../lib/utils';

function getScrollProgressPct() {
  const el = document.documentElement;
  const scrollTop = el.scrollTop || document.body.scrollTop;
  const scrollable = el.scrollHeight - el.clientHeight;
  if (scrollable <= 0) return 0;
  return Math.min(100, Math.round((scrollTop / scrollable) * 100));
}

function ReadingProgressBar({ className }) {
  const { t } = useTranslation('technicalGuide');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => setPct(getScrollProgressPct());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t('article.readingProgress')}
    >
      <div
        className="h-full rounded-full bg-primary-600 transition-[width] duration-150 ease-out dark:bg-primary-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Shared layout for technical guide articles (typography + back link).
 * Mobile: sticky back + title + reading progress; desktop: back + PageHeader + sticky progress bar.
 */
export function GuideArticleLayout({ title, children }) {
  const { t } = useTranslation('technicalGuide');
  const navigate = useNavigate();

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div
        className={cn(
          'md:hidden sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-0 mb-1',
          'border-b border-neutral-200 dark:border-[#262626]',
          'bg-white/95 dark:bg-[#0e0e0e]/95 backdrop-blur-md',
        )}
      >
        <div className="flex items-center gap-2 min-w-0 pb-3">
          <button
            type="button"
            onClick={() => navigate('/technical-guide')}
            className="p-2 -ml-2 rounded-full shrink-0 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label={t('article.backAria')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight truncate min-w-0">
            {title}
          </h1>
        </div>
        <ReadingProgressBar className="rounded-none" />
      </div>

      <div className="hidden md:block space-y-3">
        <div>
          <Link
            to="/technical-guide"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {t('article.backToList')}
          </Link>
        </div>
        <PageHeader title={title} />
        <div
          className={cn(
            'sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2',
            'bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-[#262626]/80',
          )}
        >
          <ReadingProgressBar />
        </div>
      </div>

      <article className="w-full text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
        {children}
      </article>
    </PageContainer>
  );
}
