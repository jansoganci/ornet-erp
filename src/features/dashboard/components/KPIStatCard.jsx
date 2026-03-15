import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';

/**
 * KPIStatCard — Operational metric card with trend indicator.
 *
 * Use for: counts, status numbers, operational KPIs.
 * Do NOT use for financial time-series data — use SparklineStatCard for those.
 *
 * Props:
 *   title       — card label shown above the value (translated string)
 *   value       — metric value as a formatted string, e.g. "12" or "₺84,200"
 *   icon        — Lucide icon component
 *   trendChange — delta string shown below value, e.g. "+3" or "+12.4%"
 *   trendType   — 'up' | 'down' | 'neutral'  (purely visual — caller decides meaning)
 *   variant     — 'default' | 'alert'  (alert = red left border + tinted bg)
 *   href        — react-router path; whole card becomes a <Link> when provided
 *   loading     — shows skeleton when true
 *   className   — additional classes for the card wrapper
 */
export function KPIStatCard({
  title,
  value,
  icon: Icon,
  trendChange,
  trendType = 'neutral',
  variant = 'default',
  href,
  loading = false,
  className,
}) {
  const isAlert = variant === 'alert';

  // ── Trend icon & color ──────────────────────────────────────────────────────
  const TrendIcon =
    trendType === 'up' ? ArrowUp :
    trendType === 'down' ? ArrowDown :
    Minus;

  const trendColor =
    trendType === 'up'   ? 'text-green-500 dark:text-green-400' :
    trendType === 'down' ? 'text-red-500 dark:text-red-400' :
    'text-neutral-500 dark:text-neutral-500';

  // ── Skeleton state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(
        'rounded-xl border p-5',
        'bg-white border-gray-200',
        'dark:bg-gray-800/40 dark:border-white/10 dark:backdrop-blur-sm',
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  // ── Card shell classes ──────────────────────────────────────────────────────
  const shellClass = cn(
    // Base
    'rounded-xl border p-5 block',
    'transition-all duration-150',
    'hover:-translate-y-px',

    // Default glass surface
    'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    'dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10',
    'dark:hover:bg-gray-800/60 dark:hover:border-white/20',

    // Alert variant overrides
    isAlert && [
      'border-l-4 border-l-red-500',
      'bg-red-50 border-red-200',
      'dark:bg-red-950/20 dark:border-red-900/50 dark:border-l-red-500',
    ],

    // Cursor only when clickable
    href && 'cursor-pointer',

    className
  );

  // ── Inner content ───────────────────────────────────────────────────────────
  const content = (
    <>
      {/* Header row: label + icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500 truncate pr-2">
          {title}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
        )}
      </div>

      {/* Metric value */}
      <p
        className="text-3xl font-bold tracking-tighter text-neutral-900 dark:text-neutral-50 tabular-nums mb-1"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>

      {/* Delta badge */}
      {trendChange && (
        <div className={cn('flex items-center gap-0.5 delta-badge', trendColor)}>
          <TrendIcon className="w-3 h-3 flex-shrink-0" />
          <span className="text-xs font-medium">{trendChange}</span>
        </div>
      )}

      {/* Alert left-border pulse overlay */}
      {isAlert && (
        <span
          className="alert-accent-border absolute inset-y-0 left-0 w-1 rounded-l-xl bg-red-500"
          aria-hidden="true"
        />
      )}
    </>
  );

  // ── Render as Link or plain div ─────────────────────────────────────────────
  if (href) {
    return (
      <Link to={href} className={cn(shellClass, 'relative')}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cn(shellClass, 'relative')}>
      {content}
    </div>
  );
}
