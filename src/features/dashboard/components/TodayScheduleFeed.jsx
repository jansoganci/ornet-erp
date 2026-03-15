import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useTodaySchedule } from '../hooks';

// ── Badge helpers ──────────────────────────────────────────────────────────

const TYPE_CLASSES = {
  installation: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-900/50',
  service:      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50',
  maintenance:  'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-900/50',
  survey:       'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50',
  other:        'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50',
};

const STATUS_CLASSES = {
  pending:     'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700',
  scheduled:   'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50',
  completed:   'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
  cancelled:   'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800',
};

function TypeBadge({ type, label }) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 h-5 rounded text-[11px] font-medium border flex-shrink-0',
      TYPE_CLASSES[type] ?? TYPE_CLASSES.other
    )}>
      {label}
    </span>
  );
}

function StatusChip({ status, label }) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 h-5 rounded-full text-[11px] font-medium border flex-shrink-0',
      STATUS_CLASSES[status] ?? STATUS_CLASSES.pending
    )}>
      {label}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="divide-y divide-white/5 dark:divide-white/5 divide-gray-100">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-3 w-10 flex-shrink-0" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-4 w-14 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * TodayScheduleFeed — Card showing today's work orders sorted by scheduled time.
 * Max 8 rows. "Tümünü Gör" links to /daily-work.
 * Uses existing useTodaySchedule() hook — no new RPCs needed.
 */
export function TodayScheduleFeed() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { data: schedule, isLoading, error } = useTodaySchedule();

  const sorted = Array.isArray(schedule)
    ? [...schedule]
        .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
        .slice(0, 8)
    : [];

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
          {t('sections.todaySchedule')}
        </h3>
        <Link
          to="/daily-work"
          className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
        >
          {t('feed.viewAll')}
        </Link>
      </div>

      {/* Body */}
      {isLoading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            {tCommon('errors.loadFailed')}
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            {t('feed.emptySchedule')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {sorted.map((item, index) => (
            <Link
              key={item.id}
              to={`/work-orders/${item.id}`}
              className={cn(
                'feed-row flex items-center gap-3 px-5 min-h-[44px] py-2.5',
                'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group'
              )}
              style={{ '--row-delay': `${Math.min(index, 5) * 50}ms` }}
            >
              {/* Time */}
              <span className="text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0">
                {item.scheduled_time?.slice(0, 5) ?? '–'}
              </span>

              {/* Customer + title */}
              <span className="flex-1 min-w-0 text-sm text-neutral-900 dark:text-neutral-50 truncate">
                {item.customer_name ?? tCommon('labels.unknown')}
                {item.title && (
                  <span className="text-neutral-400 dark:text-neutral-500">
                    {' · '}{item.title}
                  </span>
                )}
              </span>

              {/* Type badge */}
              <TypeBadge
                type={item.type}
                label={tCommon(`type.${item.type}`) ?? item.type}
              />

              {/* Status chip */}
              <StatusChip
                status={item.status}
                label={tCommon(`status.${item.status}`) ?? item.status}
              />

              {/* Chevron */}
              <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
