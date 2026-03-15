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

  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;
  return data;
}

export async function fetchTodaySchedule() {
  if (!isSupabaseConfigured) return mockSchedule;

  const { data, error } = await supabase.rpc('get_today_schedule');
  if (error) throw error;
  return data;
}

export async function fetchPendingTasks() {
  if (!isSupabaseConfigured) return mockPendingTasks;

  const { data, error } = await supabase.rpc('get_my_pending_tasks', { limit_count: 5 });
  if (error) throw error;
  return data;
}

export async function fetchMonthlyRevenue(monthsBack = 7) {
  if (!isSupabaseConfigured) {
    // Mock: descending months ending today
    const months = [];
    const labels = ['Eyl', 'Eki', 'Kas', 'Ara', 'Oca', 'Şub', 'Mar'];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, revenue: 60000 + Math.random() * 30000, expense: 30000 + Math.random() * 15000 });
    }
    return months;
  }

  const { data, error } = await supabase.rpc('get_monthly_revenue_expense', { months_back: monthsBack });
  if (error) throw error;
  return data;
}

export async function fetchOverduePayments() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_overdue_subscription_payments');
  if (error) throw error;
  return data ?? [];
}
