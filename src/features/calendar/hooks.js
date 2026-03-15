import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '../../lib/supabase';
import { fetchWorkOrders, fetchTasksByDateRange, subscribeToCalendar, unsubscribeFromCalendar } from './api';
import { mapWorkOrdersToEvents, mapTasksToEvents } from './utils';

export const calendarKeys = {
  all: ['calendar'],
  workOrders: (dateFrom, dateTo, filters) => [
    ...calendarKeys.all,
    'workOrders',
    dateFrom,
    dateTo,
    filters ?? {},
  ],
  tasks: (dateFrom, dateTo, filters) => [
    ...calendarKeys.all,
    'tasks',
    dateFrom,
    dateTo,
    filters ?? {},
  ],
};

/**
 * Fetches work orders for the given date range and filters, then maps them to
 * calendar events (id, title, start, end, resource).
 * Use dateFrom/dateTo as ISO date strings (YYYY-MM-DD) for the visible range.
 */
export function useCalendarWorkOrders({ dateFrom, dateTo, status, type } = {}) {
  const query = useQuery({
    queryKey: calendarKeys.workOrders(dateFrom, dateTo, { status, type }),
    queryFn: async () => {
      const workOrders = await fetchWorkOrders({
        dateFrom,
        dateTo,
        status: status && status !== 'all' ? status : undefined,
        type: type && type !== 'all' ? type : undefined,
      });
      return mapWorkOrdersToEvents(workOrders);
    },
    enabled: Boolean(dateFrom && dateTo),
  });

  return {
    ...query,
    events: query.data ?? [],
  };
}

/**
 * Fetches tasks (plan items) for the given date range and maps them to
 * calendar events with _type='plan'.
 */
export function useCalendarTasks({ dateFrom, dateTo, assigned_to } = {}) {
  const query = useQuery({
    queryKey: calendarKeys.tasks(dateFrom, dateTo, { assigned_to }),
    queryFn: async () => {
      const tasks = await fetchTasksByDateRange({
        dateFrom,
        dateTo,
        assigned_to: assigned_to && assigned_to !== 'all' ? assigned_to : undefined,
      });
      return mapTasksToEvents(tasks);
    },
    enabled: Boolean(dateFrom && dateTo),
  });

  return {
    ...query,
    events: query.data ?? [],
  };
}

/**
 * Subscribes to Supabase realtime on work_orders and tasks tables.
 * When any row changes (INSERT/UPDATE/DELETE), invalidates calendar queries
 * so the calendar refetches. Only active when Supabase is configured.
 */
export function useCalendarRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = subscribeToCalendar(
      () => { queryClient.invalidateQueries({ queryKey: calendarKeys.all }); },
      () => { queryClient.invalidateQueries({ queryKey: calendarKeys.all }); }
    );

    return () => {
      unsubscribeFromCalendar(channel);
    };
  }, [queryClient]);
}
