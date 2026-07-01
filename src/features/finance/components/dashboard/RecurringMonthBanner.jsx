import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { useRecurringMonthStatus } from '../../recurringHooks';

const linkClassName =
  'inline-flex items-center justify-center shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors';

export function RecurringMonthBanner({ year, month }) {
  const { t } = useTranslation(['finance', 'common']);
  const { data: status, isLoading } = useRecurringMonthStatus({ year, month });

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-xl" />;
  }

  if (!status || status.totalActive === 0 || status.isFutureMonth) {
    return null;
  }

  const monthNames = t('common:monthsFull', { returnObjects: true });
  const periodLabel = `${monthNames[month - 1]} ${year}`;

  if (status.isComplete) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex-1">
          {t('finance:recurringMonthBanner.complete', {
            period: periodLabel,
            generated: status.generatedCount,
            total: status.totalActive,
          })}
        </p>
        <Link
          to="/finance/recurring"
          className={`${linkClassName} text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30`}
        >
          {t('finance:recurringMonthBanner.viewTemplates')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
        {t('finance:recurringMonthBanner.incomplete', {
          period: periodLabel,
          missing: status.missingCount,
          generated: status.generatedCount,
          total: status.totalActive,
        })}
      </p>
      <Link
        to="/finance/recurring"
        className={`${linkClassName} text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30`}
      >
        {t('finance:recurringMonthBanner.goGenerate')}
      </Link>
    </div>
  );
}
