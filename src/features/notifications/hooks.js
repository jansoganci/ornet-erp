import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { startOfDay, startOfWeek, isAfter, parseISO } from 'date-fns';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchActiveNotifications,
  fetchResolvedNotifications,
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
  resolved: (page) => [...notificationKeys.all, 'resolved', page ?? 1],
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

export function useActiveNotifications(page = 1, filters = {}) {
  return useQuery({
    queryKey: [...notificationKeys.list(page), filters],
    queryFn: () => fetchActiveNotifications(page, 20, filters),
    enabled: isSupabaseConfigured,
  });
}

export function useResolvedNotifications(page = 1, filters = {}) {
  return useQuery({
    queryKey: [...notificationKeys.resolved(page), filters],
    queryFn: () => fetchResolvedNotifications(page, 20, filters),
    enabled: isSupabaseConfigured,
  });
}

export function useNotificationsList({ resolved = false, page = 1, timeFilter = 'all', dateFrom, dateTo }) {
  const filters = useMemo(() => ({ dateFrom, dateTo }), [dateFrom, dateTo]);
  const activeQuery = useActiveNotifications(page, filters);
  const resolvedQuery = useResolvedNotifications(page, filters);

  const query = resolved ? resolvedQuery : activeQuery;

  const filteredData = useMemo(() => {
    if (!query.data) return query.data;
    
    // If we have explicit dateFrom/dateTo, backend already filtered it.
    // We only apply quick timeFilter (today, this_week, older) if no explicit range is provided
    if (timeFilter === 'all' || dateFrom || dateTo) return query.data;

    const now = new Date();
    let boundary;

    if (timeFilter === 'today') {
      boundary = startOfDay(now);
    } else if (timeFilter === 'this_week') {
      boundary = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    }

    return query.data.filter((item) => {
      const dateStr = resolved ? item.resolved_at : item.created_at;
      if (!dateStr) return false;
      const itemDate = parseISO(dateStr);

      if (timeFilter === 'older') {
        const weekBoundary = startOfWeek(now, { weekStartsOn: 1 });
        return !isAfter(itemDate, weekBoundary);
      }

      return isAfter(itemDate, boundary);
    });
  }, [query.data, resolved, timeFilter]);

  return {
    data: filteredData,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
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
