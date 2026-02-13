import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useCurrentProfile } from '../../subscriptions/hooks';
import { useCreateReminder } from '../hooks';
import { reminderSchema, reminderDefaultValues } from '../schema';
import { Modal, Input, Textarea, Button } from '../../../components/ui';

/**
 * ReminderFormModal - Create user reminder
 *
 * Form fields: title (required), content (optional), date, time (default 09:00)
 * Submitted reminders trigger cron notification when due.
 *
 * @param {boolean} open - Modal visibility
 * @param {function} onClose - Close callback
 */
export function ReminderFormModal({ open, onClose }) {
  const { t } = useTranslation('notifications');
  const { data: currentProfile } = useCurrentProfile();
  const createReminder = useCreateReminder();

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      ...reminderDefaultValues,
      remind_time: '09:00',
    },
  });

  const onSubmit = (data) => {
    const createdBy = currentProfile?.id;
    if (!createdBy) return;

    createReminder.mutate(
      {
        title: data.title,
        content: data.content || undefined,
        remind_date: data.remind_date,
        remind_time: data.remind_time || '09:00',
        created_by: createdBy,
      },
      {
        onSuccess: () => {
          reset(reminderDefaultValues);
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('reminder.createTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting || createReminder.isPending}
            onClick={handleSubmit(onSubmit)}
            disabled={!currentProfile?.id}
          >
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('reminder.fields.title')}
          placeholder={t('reminder.placeholders.title')}
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label={t('reminder.fields.content')}
          placeholder={t('reminder.placeholders.content')}
          error={errors.content?.message}
          {...register('content')}
        />
        <Input
          label={t('reminder.fields.date')}
          type="date"
          min={todayIso}
          error={errors.remind_date?.message}
          {...register('remind_date')}
        />
        <Input
          label={t('reminder.fields.time')}
          type="time"
          placeholder={t('reminder.placeholders.time')}
          error={errors.remind_time?.message}
          {...register('remind_time')}
        />
      </form>
    </Modal>
  );
}
