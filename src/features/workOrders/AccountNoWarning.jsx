import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui';
import { cn } from '../../lib/utils';

const ACCOUNT_NO_INFO_WORK_TYPES = ['service', 'maintenance', 'installation'];

export function AccountNoWarning({
  workType,
  accountNo,
  onAddAccountNo,
  addAccountDisabled = false,
}) {
  const { t } = useTranslation(['workOrders', 'common']);

  const hasAccountNo = accountNo && accountNo.trim() !== '';
  const showMissingAccountWarning = ACCOUNT_NO_INFO_WORK_TYPES.includes(workType);

  if (hasAccountNo || !showMissingAccountWarning) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 shadow-sm',
      'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20',
    )}>
      <div className="flex items-center space-x-4">
        <div className={cn(
          'p-2.5 rounded-xl shadow-sm',
          'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        )}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-amber-900 dark:text-amber-100">
            {t('workOrders:warnings.missingAccountNo')}
          </p>
          <p className="text-xs font-medium opacity-80 mt-0.5 text-amber-700 dark:text-amber-400">
            {t('workOrders:warnings.missingAccountNoHint')}
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={addAccountDisabled}
        title={addAccountDisabled ? t('workOrders:form.hints.addAccountNoNeedCustomer') : undefined}
        onClick={onAddAccountNo}
        className="font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm bg-amber-600 hover:bg-amber-700 text-white border-none"
      >
        {t('workOrders:form.buttons.addAccountNo')}
      </Button>
    </div>
  );
}
