import { Card } from '../../../components/ui';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * Enhanced StatCard for Subscription metrics
 */
export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  subtitle, 
  trend, 
  hint, 
  onClick,
  loading = false 
}) {
  const isInteractive = typeof onClick === 'function';

  return (
    <Card
      variant={isInteractive ? 'interactive' : 'default'}
      onClick={isInteractive ? onClick : undefined}
      className="p-4 border-neutral-200/60 dark:border-neutral-800/60 shadow-sm"
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 shrink-0">
            <Icon className={cn("w-5 h-5", color || "text-neutral-500")} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider leading-snug truncate">
              {label}
            </p>
            {trend && (
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                trend.isPositive 
                  ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400" 
                  : "bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400"
              )}>
                {trend.isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {trend.value}%
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="h-7 w-24 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded" />
          ) : (
            <p className="text-xl font-black text-neutral-900 dark:text-neutral-50 leading-tight whitespace-nowrap tabular-nums">
              {value}
            </p>
          )}

          {(subtitle || hint) && (
            <div className="mt-1 flex flex-col gap-0.5">
              {subtitle && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {subtitle}
                </p>
              )}
              {hint && (
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic truncate">
                  {hint}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
