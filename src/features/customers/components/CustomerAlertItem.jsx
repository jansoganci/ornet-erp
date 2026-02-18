import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function CustomerAlertItem({ count }) {
  const { t } = useTranslation('customers');

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-lg bg-error-50 dark:bg-error-950/20 border border-error-200 dark:border-error-900/40">
      <AlertTriangle className="w-4 h-4 text-error-600 dark:text-error-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-error-700 dark:text-error-300">
          {t('detail.overview.alerts.faultyEquipment', { count })}
        </p>
        <p className="text-xs text-error-600/80 dark:text-error-400/80 mt-0.5">
          {t('detail.overview.alerts.faultyEquipmentDesc')}
        </p>
      </div>
    </div>
  );
}
