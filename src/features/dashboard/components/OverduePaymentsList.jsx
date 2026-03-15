import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useOverduePayments } from '../hooks';

// ── Skeleton ────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
          <Skeleton className="h-4 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Month badge ──────────────────────────────────────────────────────────────

function MonthsBadge({ count }) {
  const color =
    count >= 3
      ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
      : count >= 2
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 h-5 rounded-full text-[11px] font-semibold flex-shrink-0',
        color
      )}
    >
      {count}ay
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * OverduePaymentsList — Card listing pending subscription payments from past months.
 * Data source: useOverduePayments() → get_overdue_subscription_payments()
 * "Tümünü Gör" links to /subscriptions.
 */
export function OverduePaymentsList() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { data: payments, isLoading } = useOverduePayments();

  const list = Array.isArray(payments) ? payments : [];

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
            {t('sections.overduePayments')}
          </h3>
          {!isLoading && list.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none flex-shrink-0">
              {list.length > 9 ? '9+' : list.length}
            </span>
          )}
        </div>
        <Link
          to="/subscriptions"
          className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
        >
          {t('feed.viewAll')}
        </Link>
      </div>

      {/* Body */}
      {isLoading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            {t('overduePayments.empty')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {list.map((item, index) => {
            const monthLabel = item.payment_month
              ? format(parseISO(item.payment_month), 'MMM yyyy', { locale: tr })
              : '–';
            const amount = new Intl.NumberFormat('tr-TR', {
              style: 'currency',
              currency: 'TRY',
              maximumFractionDigits: 0,
            }).format(item.total_amount ?? item.amount ?? 0);

            return (
              <Link
                key={item.payment_id}
                to={`/subscriptions/${item.subscription_id}`}
                className={cn(
                  'feed-row flex items-center gap-3 px-5 min-h-[44px] py-2.5',
                  'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group'
                )}
                style={{ '--row-delay': `${Math.min(index, 5) * 50}ms` }}
              >
                {/* Alert icon */}
                <AlertCircle className="w-3.5 h-3.5 text-red-400 dark:text-red-500 flex-shrink-0" />

                {/* Customer + site */}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                    {item.company_name ?? tCommon('unknown')}
                  </span>
                  <span className="block text-xs text-neutral-400 dark:text-neutral-500 truncate">
                    {[item.site_name, monthLabel].filter(Boolean).join(' · ')}
                  </span>
                </span>

                {/* Months overdue badge */}
                <MonthsBadge count={item.months_overdue ?? 1} />

                {/* Amount */}
                <span className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 flex-shrink-0">
                  {amount}
                </span>

                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
