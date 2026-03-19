import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { CalendarCheck } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { scheduleSchema, scheduleDefaultValues, WORK_TYPES } from '../schema';
import { useConvertToWorkOrder } from '../hooks';

export function InlineScheduler({ request, onClose }) {
  const { t } = useTranslation('operations');

  const convertMutation = useConvertToWorkOrder();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      ...scheduleDefaultValues,
      work_type: request.work_type || 'service',
    },
  });

  const workTypeOptions = WORK_TYPES.map((wt) => ({
    value: wt,
    label: t(`workType.${wt}`),
  }));

  const onSubmit = (data) => {
    convertMutation.mutate(
      {
        requestId: request.id,
        scheduleData: {
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time || null,
          work_type: data.work_type,
          notes: data.notes || null,
        },
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0f0f0f] px-4 py-3 rounded-b-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input
            type="date"
            label={t('scheduler.date')}
            error={errors.scheduled_date?.message}
            {...register('scheduled_date')}
          />
          <Input
            type="time"
            label={t('scheduler.time')}
            error={errors.scheduled_time?.message}
            {...register('scheduled_time')}
          />
          <Select
            label={t('scheduler.workType')}
            options={workTypeOptions}
            error={errors.work_type?.message}
            {...register('work_type')}
          />
          <Input
            label={t('scheduler.notes')}
            placeholder="..."
            error={errors.notes?.message}
            {...register('notes')}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={convertMutation.isPending}
            leftIcon={<CalendarCheck className="w-4 h-4" />}
          >
            {t('scheduler.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
