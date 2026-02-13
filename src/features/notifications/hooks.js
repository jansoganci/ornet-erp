import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchActiveNotifications,
  fetchBadgeCount,
  resolveNotification,
  fetchReminders,
  createReminder,
  completeReminder,
} from './api';

export const notificationKeys = {
  all: ['notifications'],
  badge: () => [...notificationKeys.all, 'badge'],
  list: (page) => [...notificationKeys.all, 'list', page ?? 1],
  reminders: () => [...notificationKeys.all, 'reminders'],
};

export function useNotificationBadge() {
  return useQuery({
    queryKey: notificationKeys.badge(),
    queryFn: fetchBadgeCount,
    enabled: isSupabaseConfigured,
    refetchInterval: 60000,
  });
}

export function useActiveNotifications(page = 1) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: () => fetchActiveNotifications(page, 20),
    enabled: isSupabaseConfigured,
  });
}

export function useResolveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.badge() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useReminders() {
  return useQuery({
    queryKey: notificationKeys.reminders(),
    queryFn: fetchReminders,
    enabled: isSupabaseConfigured,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('notifications');

  return useMutation({
    mutationFn: createReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.reminders() });
      toast.success(t('reminder.created'));
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.reminders() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.badge() });
    },
  });
}

export function useNotificationRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.badge() });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
