import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { fetchWorkOrders } from '../workOrders/api';
import { mapWorkOrdersToEvents } from './utils';

export const calendarKeys = {
  all: ['calendar'],
  workOrders: (dateFrom, dateTo, filters) => [
    ...calendarKeys.all,
    'workOrders',
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
 * Subscribes to Supabase realtime on work_orders. When any row changes
 * (INSERT/UPDATE/DELETE), invalidates calendar queries so the calendar refetches.
 * Only active when Supabase is configured. Call from CalendarPage.
 */
export function useCalendarRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('work_orders-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
