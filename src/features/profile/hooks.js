import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import { updateProfile } from './api';

export function useUpdateProfile() {
  const { t } = useTranslation('profile');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentProfile'] });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
