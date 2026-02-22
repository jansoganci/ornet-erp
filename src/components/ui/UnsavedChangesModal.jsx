import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Save, LogOut, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Modal shown when a user navigates away from a dirty form.
 *
 * onSave contract:
 *   return true        → success: call blocker.proceed() to navigate
 *   return false       → validation failed: call blocker.reset() so user can see errors
 *   return null/void   → network error: keep modal open (toast already shown by caller)
 */
export function UnsavedChangesModal({ blocker, onSave }) {
  const { t } = useTranslation('common');
  const [isSaving, setIsSaving] = useState(false);

  if (blocker.state !== 'blocked') return null;

  const handleSave = async () => {
    if (isSaving || !onSave) return;
    setIsSaving(true);
    try {
      const result = await onSave();
      if (result === true) {
        blocker.proceed();
      } else if (result === false) {
        // Validation failed — close modal so user can see form errors
        blocker.reset();
      }
      // null / undefined = network error, keep modal open
    } catch {
      // onSave threw (network/server error) — toast already shown by caller, keep modal open
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeave = () => {
    blocker.proceed();
  };

  const handleCancel = () => {
    blocker.reset();
  };

  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={handleCancel}
      title={t('unsavedChanges.title')}
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-end">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 sm:flex-none order-3 sm:order-1"
            leftIcon={<X className="w-4 h-4" />}
          >
            {t('unsavedChanges.cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={handleLeave}
            disabled={isSaving}
            className="flex-1 sm:flex-none order-2 sm:order-2 text-error-600 border-error-200 hover:bg-error-50 dark:border-error-900/30 dark:hover:bg-error-950/30"
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            {t('unsavedChanges.leave')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            className="flex-1 sm:flex-none order-1 sm:order-3"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {t('unsavedChanges.save')}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-2">
          <p className="text-neutral-700 dark:text-neutral-300">
            {t('unsavedChanges.description')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
