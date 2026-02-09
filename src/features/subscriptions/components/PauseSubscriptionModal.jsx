import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Textarea } from '../../../components/ui';
import { usePauseSubscription } from '../hooks';

export function PauseSubscriptionModal({ open, onClose, subscriptionId }) {
  const { t } = useTranslation(['subscriptions', 'common']);
  const [reason, setReason] = useState('');
  const pauseMutation = usePauseSubscription();

  const handleConfirm = async () => {
    await pauseMutation.mutateAsync({ id: subscriptionId, reason });
    setReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subscriptions:pause.title')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="warning"
            onClick={handleConfirm}
            loading={pauseMutation.isPending}
            disabled={!reason.trim()}
            className="flex-1"
          >
            {t('subscriptions:pause.confirm')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('subscriptions:pause.message')}
        </p>
        <Textarea
          label={t('subscriptions:pause.reasonLabel')}
          placeholder={t('subscriptions:pause.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
