import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Mock data for fallback
const mockStats = {
  today_work_orders: 3,
  pending_work_orders: 8,
  in_progress_work_orders: 2,
  completed_this_week: 12,
  open_tasks: 5,
  overdue_tasks: 1,
  total_customers: 45,
  user_role: 'admin'
};

const mockSchedule = [
  {
    id: 'wo-1',
    customer_name: 'John Doe',
    customer_phone: '0532 123 4567',
    customer_address: 'Kadikoy, Istanbul',
    type: 'service',
    status: 'scheduled',
    scheduled_time: '10:00',
    title: 'AC Maintenance',
    priority: 'normal'
  },
  {
    id: 'wo-2',
    customer_name: 'Jane Smith',
    customer_phone: '0544 987 6543',
    customer_address: 'Maltepe, Istanbul',
    type: 'installation',
    status: 'in_progress',
    scheduled_time: '13:30',
    title: 'Boiler Installation',
    priority: 'high'
  },
  {
    id: 'wo-3',
    customer_name: 'Alice Brown',
    customer_phone: '0505 111 2233',
    customer_address: 'Besiktas, Istanbul',
    type: 'service',
    status: 'scheduled',
    scheduled_time: '16:00',
    title: 'Water Leak Detection',
    priority: 'urgent'
  }
];

const mockPendingTasks = [
  {
    id: 't-1',
    title: 'Call customer: John Doe',
    due_date: '2026-02-04',
    priority: 'normal',
    work_order_title: 'AC Maintenance',
    customer_name: 'John Doe',
    is_overdue: false
  },
  {
    id: 't-2',
    title: 'Perform stock control',
    due_date: '2026-02-03',
    priority: 'high',
    work_order_title: null,
    customer_name: null,
    is_overdue: true
  },
  {
    id: 't-5',
    title: 'Urgent: Equipment purchase',
    due_date: '2026-02-03',
    priority: 'urgent',
    work_order_title: null,
    customer_name: null,
    is_overdue: false
  }
];

export async function fetchDashboardStats() {
  if (!isSupabaseConfigured) return mockStats;

  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) {
      // 401 unauth, 404 function missing, 400 bad request (e.g. schema mismatch) -> use mock
      if (error.status === 401 || error.status === 404 || error.status === 400) return mockStats;
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.status === 401 || err?.status === 404 || err?.status === 400) return mockStats;
    throw err;
  }
}

export async function fetchTodaySchedule() {
  if (!isSupabaseConfigured) return mockSchedule;

  try {
    const { data, error } = await supabase.rpc('get_today_schedule');
    if (error) {
      if (error.status === 401 || error.status === 404 || error.status === 400) return mockSchedule;
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.status === 401 || err?.status === 404 || err?.status === 400) return mockSchedule;
    throw err;
  }
}

export async function fetchPendingTasks() {
  if (!isSupabaseConfigured) return mockPendingTasks;

  try {
    const { data, error } = await supabase.rpc('get_my_pending_tasks', { limit_count: 5 });
    if (error) {
      if (error.status === 401 || error.status === 404 || error.status === 400) return mockPendingTasks;
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.status === 401 || err?.status === 404 || err?.status === 400) return mockPendingTasks;
    throw err;
  }
}
