import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * @param {object} props
 * @param {'success' | 'partial' | 'error'} props.variant
 * @param {{ label: string, value: number | string }[]} [props.stats] — rows like "Eklenen: 5"
 * @param {string} [props.title]
 * @param {string} [props.message] — optional subtitle
 * @param {string} [props.className]
 * @param {'default' | 'compact'} [props.size]
 * @param {import('react').ReactNode} [props.children]
 */
export function ImportResultSummary({
  variant,
  stats = [],
  title,
  message,
  className,
  size = 'default',
  children,
}) {
  const compact = size === 'compact';

  const palette =
    variant === 'success'
      ? {
          wrap: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/25',
          icon: CheckCircle,
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          titleClass: 'text-emerald-900 dark:text-emerald-100',
          textClass: 'text-emerald-800 dark:text-emerald-200/90',
        }
      : variant === 'partial'
        ? {
            wrap: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/25',
            icon: AlertTriangle,
            iconClass: 'text-amber-600 dark:text-amber-400',
            titleClass: 'text-amber-900 dark:text-amber-100',
            textClass: 'text-amber-900/90 dark:text-amber-200/90',
          }
        : {
            wrap: 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/25',
            icon: XCircle,
            iconClass: 'text-red-600 dark:text-red-400',
            titleClass: 'text-red-900 dark:text-red-100',
            textClass: 'text-red-800 dark:text-red-200/90',
          };

  const Icon = palette.icon;

  return (
    <div className={cn('rounded-xl border p-4', palette.wrap, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('shrink-0 mt-0.5', compact ? 'w-4 h-4' : 'w-5 h-5', palette.iconClass)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          {title && (
            <h4 className={cn('font-semibold', compact ? 'text-sm' : 'text-base', palette.titleClass)}>{title}</h4>
          )}
          {stats.length > 0 && (
            <ul className={cn('space-y-1', compact ? 'text-xs' : 'text-sm', palette.textClass)}>
              {stats.map((row, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-neutral-600 dark:text-neutral-400">{row.label}</span>
                  <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{row.value}</span>
                </li>
              ))}
            </ul>
          )}
          {message && (
            <p className={cn('leading-relaxed', compact ? 'text-xs' : 'text-sm', palette.textClass)}>{message}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
