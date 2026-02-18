import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';

export function WorkOrderStatusActions({ workOrder, setStatusToUpdate }) {
  const { t } = useTranslation(['workOrders', 'common']);
  const status = workOrder?.status;
  const isCompletedOrCancelled = ['completed', 'cancelled'].includes(status);

  if (isCompletedOrCancelled) return null;

  return (
    <div className="hidden lg:flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717]">
      {status === 'pending' && (
        <Button
          className="flex-1 max-w-xs"
          onClick={() => setStatusToUpdate('in_progress')}
        >
          {t('workOrders:actions.start')}
        </Button>
      )}

      {status === 'in_progress' && (
        <Button
          variant="success"
          className="flex-1 max-w-xs"
          onClick={() => setStatusToUpdate('completed')}
        >
          {t('workOrders:actions.complete')}
        </Button>
      )}

      {!isCompletedOrCancelled && (
        <Button variant="ghost" onClick={() => setStatusToUpdate('cancelled')}>
          {t('workOrders:actions.cancel')}
        </Button>
      )}
    </div>
  );
}
