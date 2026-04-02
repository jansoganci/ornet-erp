import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Textarea } from '../../../components/ui';

const OUTCOME_OPTIONS = [
  { value: 'field_resolved', labelKey: 'operations:closeOutcome.options.field_resolved' },
  { value: 'remote_resolved', labelKey: 'operations:closeOutcome.options.remote_resolved' },
  { value: 'closed_no_action', labelKey: 'operations:closeOutcome.options.closed_no_action' },
  { value: 'cancelled', labelKey: 'operations:closeOutcome.options.cancelled' },
];

export function CloseOutcomeModal({ open, onClose, onConfirm, isSubmitting = false }) {
  const { t } = useTranslation(['operations', 'common']);
  const [outcomeType, setOutcomeType] = useState('field_resolved');
  const [notes, setNotes] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setOutcomeType('field_resolved');
      setNotes('');
    }
  }, [open]);

  const handleClose = () => {
    setOutcomeType('field_resolved');
    setNotes('');
    onClose();
  };

  const handleConfirm = async () => {
    const result = await onConfirm({
      outcomeType,
      contactNotes: notes.trim() || null,
    });

    if (result !== false) {
      handleClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('operations:closeOutcome.title')}
      footer={(
        <>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} loading={isSubmitting}>
            {t('operations:closeOutcome.confirm')}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {t('operations:closeOutcome.outcomeLabel')}
          </p>
          <div className="space-y-2">
            {OUTCOME_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-[#262626] dark:text-neutral-300"
              >
                <input
                  type="radio"
                  name="close-outcome"
                  value={option.value}
                  checked={outcomeType === option.value}
                  onChange={(e) => setOutcomeType(e.target.value)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>{t(option.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label={t('operations:closeOutcome.notesLabel')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('operations:closeOutcome.notesPlaceholder')}
          rows={3}
        />
      </div>
    </Modal>
  );
}
