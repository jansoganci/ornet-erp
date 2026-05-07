import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useBoomerangItem } from '../hooks';
import { FAILURE_REASONS } from '../schema';

export function BoomerangModal({ open, itemId, onClose }) {
  const { t } = useTranslation('operations');
  const [reason, setReason] = useState('customer_absent');
  const boomerangMutation = useBoomerangItem();

  if (!open) return null;

  const reasonOptions = FAILURE_REASONS.map((r) => ({
    value: r,
    label: t(`failure.reasons.${r}`),
  }));

  const handleConfirm = () => {
    boomerangMutation.mutate(
      { itemId, failureReason: reason },
      { onSuccess: onClose }
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className="fixed inset-x-4 bottom-4 z-50 bg-white dark:bg-[#171717] rounded-xl shadow-2xl border border-neutral-200 dark:border-[#262626] p-5
          sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm"
      >
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
          {t('boomerang.title')}
        </h3>
        <div className="mb-4">
          <Select
            label={t('failure.reason')}
            options={reasonOptions}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onClose}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="flex-1"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            loading={boomerangMutation.isPending}
            onClick={handleConfirm}
          >
            {t('boomerang.confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}
