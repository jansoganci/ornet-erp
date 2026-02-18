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
      "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 shadow-sm",
      isRequired 
        ? "bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/20" 
        : "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20"
    )}>
      <div className="flex items-center space-x-4">
        <div className={cn(
          "p-2.5 rounded-xl shadow-sm",
          isRequired 
            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" 
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        )}>
          {isRequired ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <p className={cn(
            "text-sm font-bold tracking-tight",
            isRequired ? "text-red-900 dark:text-red-100" : "text-amber-900 dark:text-amber-100"
          )}>
            {isRequired 
              ? t('workOrders:validation.accountNoRequired') 
              : t('workOrders:warnings.installationNoAccountNo')}
          </p>
          <p className={cn(
            "text-xs font-medium opacity-80 mt-0.5",
            isRequired ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          )}>
            {isRequired 
              ? t('workOrders:validation.accountNoRequiredHint') 
              : t('workOrders:warnings.installationNoAccountNoHint')}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        onClick={onAddAccountNo}
        className={cn(
          "font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm",
          isRequired 
            ? "bg-red-600 hover:bg-red-700 text-white border-none" 
            : "bg-amber-600 hover:bg-amber-700 text-white border-none"
        )}
      >
        {t('workOrders:form.buttons.addAccountNo')}
      </Button>
    </div>
  );
}
