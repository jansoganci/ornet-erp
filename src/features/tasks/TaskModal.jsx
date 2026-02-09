import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X } from 'lucide-react';
import { 
  Modal, 
  Button, 
  Input, 
  Select,
  Textarea
} from '../../components/ui';
import { taskSchema } from './schema';
import { useCreateTask, useUpdateTask, useProfiles } from './hooks';

export function TaskModal({ open, onClose, task = null }) {
  const { t } = useTranslation('tasks');
  const isEdit = !!task;

  const { data: profiles, isLoading: isProfilesLoading } = useProfiles();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'pending',
      priority: 'normal',
      assigned_to: '',
      due_date: '',
      due_time: '',
    }
  });

  useEffect(() => {
    if (open) {
      if (task) {
        reset(task);
      } else {
        reset({
          title: '',
          description: '',
          status: 'pending',
          priority: 'normal',
          assigned_to: '',
          due_date: '',
          due_time: '',
        });
      }
    }
  }, [open, task, reset]);

  const onSubmit = (data) => {
    if (isEdit) {
      updateMutation.mutate(
        { id: task.id, ...data },
        {
          onSuccess: () => onClose()
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onClose()
      });
    }
  };

  const priorityOptions = [
    { value: 'low', label: t('priorities.low') },
    { value: 'normal', label: t('priorities.normal') },
    { value: 'high', label: t('priorities.high') },
    { value: 'urgent', label: t('priorities.urgent') },
  ];

  const statusOptions = [
    { value: 'pending', label: t('statuses.pending') },
    { value: 'in_progress', label: t('statuses.inProgress') },
    { value: 'completed', label: t('statuses.completed') },
    { value: 'cancelled', label: t('statuses.cancelled') },
  ];

  const profileOptions = [
    { value: '', label: t('form.placeholders.selectAssignee') },
    ...(profiles?.map(p => ({ value: p.id, label: p.full_name })) || [])
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('form.editTitle') : t('form.addTitle')}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} leftIcon={<X className="w-4 h-4" />}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSubmit(onSubmit)} 
            loading={createMutation.isPending || updateMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? t('common.save') : t('common.create')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('form.fields.title')}
          placeholder={t('form.placeholders.title')}
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label={t('form.fields.description')}
          placeholder={t('form.placeholders.description')}
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('form.fields.priority')}
            options={priorityOptions}
            {...register('priority')}
          />
          <Select
            label={t('form.fields.status')}
            options={statusOptions}
            {...register('status')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('form.fields.dueDate')}
            type="date"
            {...register('due_date')}
          />
          <Input
            label={t('form.fields.dueTime')}
            type="time"
            {...register('due_time')}
          />
        </div>

        <Select
          label={t('form.fields.assignedTo')}
          options={profileOptions}
          disabled={isProfilesLoading}
          {...register('assigned_to')}
        />
      </form>
    </Modal>
  );
}
