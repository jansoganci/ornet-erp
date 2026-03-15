import { supabase } from '../../lib/supabase';
import { fetchWorkOrders } from '../workOrders/api';
import { fetchTasksByDateRange } from '../tasks/api';

export { fetchWorkOrders, fetchTasksByDateRange };

export function subscribeToCalendar(onWorkOrderChange, onTaskChange) {
  return supabase
    .channel('calendar-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'work_orders',
      },
      onWorkOrderChange
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
      },
      onTaskChange
    )
    .subscribe();
}

export function unsubscribeFromCalendar(channel) {
  return supabase.removeChannel(channel);
}
