import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';
import { SparklineTooltip } from './ChartTooltip';
import { SPARKLINE_COLORS } from '../../lib/chartTheme';

const ICON_BOX_VARIANTS = {
  default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
  alert: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
  success: 'bg-success-50 dark:bg-success-950/20 text-success-600 dark:text-success-400',
  warning: 'bg-warning-50 dark:bg-warning-950/20 text-warning-600 dark:text-warning-400',
  error: 'bg-error-50 dark:bg-error-950/20 text-error-600 dark:text-error-400',
  info: 'bg-info-50 dark:bg-info-950/20 text-info-600 dark:text-info-400',
};

/**
 * KpiCard — Unified KPI/statistics card for the entire application.
 *
 * Supports: simple metrics, trends, sparklines, alert variant, colored icon boxes.
 *
 * @param {string} title - Label above value
 * @param {string|number} value - Formatted metric value
 * @param {LucideIcon} [icon] - Lucide icon component
 * @param {boolean} [loading] - Show skeleton
 * @param {string} [subtitle] - Optional subtitle below value
 * @param {string} [hint] - Optional hint (smaller, italic)
 * @param {string} [trend] - Delta string (e.g. "+12.4%", "+3")
 * @param {'up'|'down'|'neutral'} [trendType] - Visual direction for trend
 * @param {string} [href] - React Router path; card becomes Link
 * @param {function} [onClick] - Click handler when href not used
 * @param {'default'|'alert'|'success'|'warning'|'error'|'info'} [variant] - Visual variant
 * @param {Array<{name:string,value:number}>} [chartData] - Enables sparkline mode
 * @param {function} [chartFormatter] - Tooltip formatter for sparkline
 * @param {'positive'|'negative'} [chartType] - Sparkline color direction
 * @param {string} [className] - Additional wrapper classes
 */
export function KpiCard({
  title,
  value,
  icon: Icon,
  loading = false,
  subtitle,
  hint,
  trend,
  trendType = 'neutral',
  href,
  onClick,
  variant = 'default',
  chartData,
  chartFormatter,
  chartType = 'positive',
  infoTooltip,
  infoPlacement = 'inline',
  className,
}) {
  const isAlert = variant === 'alert';
  const hasSparkline = Array.isArray(chartData) && chartData.length > 0;
  const showIconBox = ['success', 'warning', 'error', 'info'].includes(variant);

  const TrendIcon = trendType === 'up' ? ArrowUp : trendType === 'down' ? ArrowDown : Minus;
  const trendColor =
    trendType === 'up'
      ? 'text-green-500 dark:text-green-400'
      : trendType === 'down'
        ? 'text-red-500 dark:text-red-400'
        : 'text-neutral-500 dark:text-neutral-500';

  const isPositive = chartType === 'positive';
  const lineColor = hasSparkline
    ? isPositive
      ? SPARKLINE_COLORS.positive
      : SPARKLINE_COLORS.negative
    : null;
  const changeColor = isPositive
    ? 'text-green-500 dark:text-green-400'
    : 'text-red-500 dark:text-red-400';

  const uid = useId();
  const gradientId = `sparkGrad-${uid.replace(/:/g, '')}`;

  const shellClass = cn(
    'rounded-xl border p-3 md:p-5 block transition-all duration-150 hover:-translate-y-px',
    'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    'dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10',
    'dark:hover:bg-gray-800/60 dark:hover:border-white/20',
    isAlert && [
      'border-l-4 border-l-red-500',
      'bg-red-50 border-red-200',
      'dark:bg-red-950/20 dark:border-red-900/50 dark:border-l-red-500',
    ],
    (href || onClick) && 'cursor-pointer',
    className
  );

  if (loading) {
    return (
      <div
        className={cn(
        'rounded-xl border p-3 md:p-5',
        'bg-white border-gray-200',
        'dark:bg-gray-800/40 dark:border-white/10 dark:backdrop-blur-sm',
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        {hasSparkline ? (
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-12 w-28 rounded" />
          </div>
        ) : (
          <>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-16" />
          </>
        )}
      </div>
    );
  }

  const floatingInfo = infoTooltip && infoPlacement === 'bottom-right';

  const header = (
    <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500 break-words min-w-0 line-clamp-2">
        {title}
      </span>
      <div className="flex items-start gap-2 shrink-0">
        {infoTooltip && !floatingInfo && (
          <span className="relative group/info">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-white/70 dark:bg-neutral-900/50">
              <Info className="w-3.5 h-3.5" />
            </span>
            <span className="pointer-events-none absolute right-0 top-6 z-30 hidden w-56 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-[11px] leading-4 text-neutral-700 dark:text-neutral-200 shadow-lg group-hover/info:block">
              {infoTooltip}
            </span>
          </span>
        )}
        {Icon &&
          (showIconBox ? (
            <div className={cn('p-2 rounded-xl flex-shrink-0', ICON_BOX_VARIANTS[variant])}>
              <Icon className="w-4 h-4" />
            </div>
          ) : (
            <Icon className="w-4 h-4 flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
          ))}
      </div>
    </div>
  );

  const valueEl = hasSparkline ? (
    <p
      className="text-2xl font-semibold tracking-tighter text-neutral-900 dark:text-neutral-50 tabular-nums leading-none mb-1.5"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </p>
  ) : (
    <p
      className="text-3xl font-bold tracking-tighter text-neutral-900 dark:text-neutral-50 tabular-nums mb-1"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </p>
  );

  const trendEl =
    trend &&
    (hasSparkline ? (
      <span className={cn('text-xs font-medium delta-badge inline-block', changeColor)}>{trend}</span>
    ) : (
      <div className={cn('flex items-center gap-0.5 delta-badge', trendColor)}>
        <TrendIcon className="w-3 h-3 flex-shrink-0" />
        <span className="text-xs font-medium">{trend}</span>
      </div>
    ));

  const content = (
    <>
      {header}
      {hasSparkline ? (
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {valueEl}
            {trendEl}
          </div>
          <div className="h-12 w-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={<SparklineTooltip formatter={chartFormatter} />}
                  cursor={{
                    stroke: 'rgba(255,255,255,0.08)',
                    strokeWidth: 1,
                    strokeDasharray: '3 3',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <>
          {valueEl}
          {trendEl}
          {subtitle && (
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 break-words mt-1.5">
              {subtitle}
            </p>
          )}
          {hint && (
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 break-words mt-1.5">
              {hint}
            </p>
          )}
        </>
      )}
      {isAlert && (
        <span
          className="alert-accent-border absolute inset-y-0 left-0 w-1 rounded-l-xl bg-red-500"
          aria-hidden="true"
        />
      )}
      {floatingInfo && (
        <span className="absolute right-3 bottom-3 z-20 group/info">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-white/80 dark:bg-neutral-900/70">
            <Info className="w-3.5 h-3.5" />
          </span>
          <span className="pointer-events-none absolute right-0 bottom-7 hidden w-56 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-[11px] leading-4 text-neutral-700 dark:text-neutral-200 shadow-lg group-hover/info:block">
            {infoTooltip}
          </span>
        </span>
      )}
    </>
  );

  const wrapperClass = cn(shellClass, 'relative', hasSparkline && 'overflow-hidden');

  if (href) {
    return (
      <Link to={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(wrapperClass, 'w-full text-left')}>
        {content}
      </button>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}
