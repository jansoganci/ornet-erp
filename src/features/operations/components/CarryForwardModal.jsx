import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../components/ui';

const tomorrowIso = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
};

export function CarryForwardModal({ open, onClose, onConfirm, isSubmitting = false }) {
  const { t } = useTranslation(['operations', 'common']);
  const [newDate, setNewDate] = useState(tomorrowIso());

  const handleClose = () => {
    setNewDate(tomorrowIso());
    onClose();
  };

  const handleConfirm = async () => {
    if (!newDate) return;
    const result = await onConfirm(newDate);
    if (result !== false) {
      handleClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('operations:carryForward.title')}
      footer={(
        <>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} loading={isSubmitting}>
            {t('operations:carryForward.confirm')}
          </Button>
        </>
      )}
    >
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('operations:carryForward.date')}
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 dark:border-[#262626] dark:bg-[#171717] dark:text-neutral-50"
        />
      </label>
    </Modal>
  );
}
