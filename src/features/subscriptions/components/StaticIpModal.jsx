import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal, Input, Button, Textarea } from '../../../components/ui';
import { assignStaticIp } from '../../simCards/staticIpApi';

const schema = z.object({
  ip_address: z.string().min(1),
  notes: z.string().optional(),
});

export function StaticIpModal({ simCardId, open, onClose }) {
  const { t } = useTranslation('simCards');
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { ip_address: '', notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) => assignStaticIp({ sim_card_id: simCardId, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staticIp', simCardId] });
      queryClient.invalidateQueries({ queryKey: ['staticIpHistory', simCardId] });
      toast.success(t('staticIp.success.assigned'));
      reset();
      onClose();
    },
    onError: (err) => {
      toast.error(err?.message || t('staticIp.success.assigned'));
    },
  });

  const onSubmit = (values) => mutation.mutate(values);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('staticIp.assign')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('staticIp.fields.ipAddress')}
          placeholder="192.168.1.1"
          error={errors.ip_address?.message}
          {...register('ip_address')}
        />
        <Textarea
          label={t('staticIp.fields.notes')}
          rows={3}
          {...register('notes')}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || mutation.isPending}
          >
            {t('staticIp.assign')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
