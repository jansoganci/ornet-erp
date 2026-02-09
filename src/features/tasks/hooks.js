import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';

export const taskKeys = {
  all: ['tasks'],
  lists: () => [...taskKeys.all, 'list'],
  list: (filters) => [...taskKeys.lists(), filters],
  profiles: (filters) => [...taskKeys.all, 'profiles', filters],
};

export function useTasks(filters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => api.fetchTasks(filters),
  });
}

export function useProfiles(filters = {}) {
  return useQuery({
    queryKey: taskKeys.profiles(filters),
    queryFn: () => api.fetchProfiles(filters),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    }
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: api.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    }
  });
}
