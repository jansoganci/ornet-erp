import { Card } from '../../components/ui';

/**
 * Compact stat card – uses the base Card component with 'interactive' variant and 'tight' padding.
 * Icon (if passed) is inline at left with text color only; no background box.
 */
export function StatCard({ title, value, icon, loading = false, onClick }) {
  const Icon = icon;
  const isInteractive = typeof onClick === 'function';

  return (
    <Card
      variant={isInteractive ? 'interactive' : 'default'}
      padding="tight"
      onClick={isInteractive ? onClick : undefined}
      className="flex items-center gap-3"
    >
      {Icon && (
        <span className="flex-shrink-0 text-neutral-500 dark:text-neutral-400">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{title}</p>
        {loading ? (
          <div className="h-5 w-12 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded mt-0.5" />
        ) : (
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5 tabular-nums">{value}</p>
        )}
      </div>
    </Card>
  );
}
