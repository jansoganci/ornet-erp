import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Textarea } from '../../../components/ui';
import { useCancelSubscription } from '../hooks';

export function CancelSubscriptionModal({ open, onClose, subscriptionId, pendingPaymentsCount = 0 }) {
  const { t } = useTranslation(['subscriptions', 'common']);
  const [reason, setReason] = useState('');
  const [writeOffUnpaid, setWriteOffUnpaid] = useState(false);
  const cancelMutation = useCancelSubscription();

  const handleConfirm = async () => {
    await cancelMutation.mutateAsync({ id: subscriptionId, reason, writeOffUnpaid });
    setReason('');
    setWriteOffUnpaid(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subscriptions:cancel.title')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={cancelMutation.isPending}
            disabled={!reason.trim()}
            className="flex-1"
          >
            {t('subscriptions:cancel.confirm')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('subscriptions:cancel.message')}
        </p>
        <p className="text-sm font-bold text-error-600 dark:text-error-400">
          {t('subscriptions:cancel.warning')}
        </p>

        {pendingPaymentsCount > 0 && (
          <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800/40">
            <p className="text-sm text-warning-700 dark:text-warning-400">
              {t('subscriptions:cancel.unpaidInfo', { count: pendingPaymentsCount })}
            </p>
          </div>
        )}

        <Textarea
          label={t('subscriptions:pause.reasonLabel')}
          placeholder={t('subscriptions:pause.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />

        {pendingPaymentsCount > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
              checked={writeOffUnpaid}
              onChange={(e) => setWriteOffUnpaid(e.target.checked)}
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {t('subscriptions:cancel.writeOffLabel')}
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
