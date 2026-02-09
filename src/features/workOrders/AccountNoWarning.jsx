import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../../components/ui';
import { cn } from '../../lib/utils';

export function AccountNoWarning({ 
  workType, 
  accountNo, 
  onAddAccountNo 
}) {
  const { t } = useTranslation(['workOrders', 'common']);
  
  const hasAccountNo = accountNo && accountNo.trim() !== '';
  const isRequired = ['service', 'maintenance'].includes(workType);
  const isWarning = workType === 'installation';

  if (hasAccountNo || (!isRequired && !isWarning)) {
    return null;
  }

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300",
      isRequired 
        ? "bg-error-50 dark:bg-error-950/20 border-error-200 dark:border-error-900/30" 
        : "bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-900/30"
    )}>
      <div className="flex items-start space-x-3 mb-3 sm:mb-0">
        <div className={cn(
          "mt-0.5 p-1.5 rounded-lg",
          isRequired 
            ? "bg-error-100 dark:bg-error-900/40 text-error-600 dark:text-error-400" 
            : "bg-warning-100 dark:bg-warning-900/40 text-warning-600 dark:text-warning-400"
        )}>
          {isRequired ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <p className={cn(
            "text-sm font-bold",
            isRequired ? "text-error-900 dark:text-error-100" : "text-warning-900 dark:text-warning-100"
          )}>
            {isRequired 
              ? t('workOrders:validation.accountNoRequired') 
              : t('workOrders:warnings.installationNoAccountNo')}
          </p>
          <p className={cn(
            "text-xs mt-0.5",
            isRequired ? "text-error-700 dark:text-error-400" : "text-warning-700 dark:text-warning-400"
          )}>
            {isRequired 
              ? t('workOrders:validation.accountNoRequiredHint') 
              : t('workOrders:warnings.installationNoAccountNoHint')}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        variant={isRequired ? "danger" : "secondary"}
        onClick={onAddAccountNo}
        className="whitespace-nowrap ml-0 sm:ml-4"
      >
        {t('workOrders:form.buttons.addAccountNo')}
      </Button>
    </div>
  );
}
