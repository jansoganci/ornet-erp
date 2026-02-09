import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useOverdueInvoices } from '../hooks';

export function ComplianceAlert() {
  const { t } = useTranslation('subscriptions');
  const { data: overdueInvoices = [] } = useOverdueInvoices();

  if (!overdueInvoices.length) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning-200 dark:border-warning-800/40 bg-warning-50 dark:bg-warning-950/20 px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0" />
      <p className="text-sm font-medium text-warning-800 dark:text-warning-300">
        {t('compliance.overdueCount', { count: overdueInvoices.length })}
      </p>
    </div>
  );
}
