import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Mock data for fallback
const mockTasks = [
  {
    id: 't-1',
    title: 'Call customer: John Doe',
    description: 'Customer satisfaction call after AC maintenance.',
    status: 'pending',
    priority: 'normal',
    assigned_to: 'mock-user',
    assigned_to_name: 'Admin User',
    due_date: '2026-02-04',
    due_time: '10:00',
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 't-2',
    title: 'Perform stock control',
    description: 'Inventory count of spare parts and consumables in the warehouse.',
    status: 'in_progress',
    priority: 'high',
    assigned_to: 'mock-user',
    assigned_to_name: 'Admin User',
    due_date: '2026-02-03',
    due_time: '15:00',
    created_at: '2026-02-02T09:00:00Z',
  },
  {
    id: 't-3',
    title: 'Prepare weekly report',
    description: 'Report of completed work orders from last week.',
    status: 'completed',
    priority: 'normal',
    assigned_to: 'mock-user',
    assigned_to_name: 'Admin User',
    due_date: '2026-02-02',
    due_time: '17:00',
    created_at: '2026-01-31T14:00:00Z',
    completed_at: '2026-02-02T16:30:00Z',
  },
  {
    id: 't-4',
    title: 'Add new staff to system',
    description: 'Create profile for the new field technician.',
    status: 'pending',
    priority: 'low',
    assigned_to: 'mock-user',
    assigned_to_name: 'Admin User',
    due_date: '2026-02-05',
    due_time: '09:00',
    created_at: '2026-02-03T11:00:00Z',
  },
  {
    id: 't-5',
    title: 'Urgent: Water leak equipment purchase',
    description: 'Process the invoice for the new water leak detection device.',
    status: 'pending',
    priority: 'urgent',
    assigned_to: 'mock-user',
    assigned_to_name: 'Admin User',
    due_date: '2026-02-03',
    due_time: '13:00',
    created_at: '2026-02-03T08:30:00Z',
  }
];

const mockProfiles = [
  { id: 'mock-user', full_name: 'Admin User', role: 'admin' },
  { id: 'user-1', full_name: 'John Technician', role: 'field_worker' },
  { id: 'user-2', full_name: 'Jane Accountant', role: 'accountant' },
];

export async function fetchTasks({ status, assigned_to, dateFrom, dateTo } = {}) {
  if (!isSupabaseConfigured) {
    return getMockTasks(status, assigned_to, dateFrom, dateTo);
  }

  try {
    let query = supabase
      .from('tasks_with_details')
      .select('*');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (assigned_to && assigned_to !== 'all') {
      query = query.eq('assigned_to', assigned_to);
    }

    if (dateFrom) {
      query = query.gte('due_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('due_date', dateTo);
    }

    const { data, error } = await query
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false });

    if (error) {
      if (error.status === 401) return getMockTasks(status, assigned_to, dateFrom, dateTo);
      throw error;
    }
    return data;
  } catch (err) {
    if (err.status === 401) return getMockTasks(status, assigned_to, dateFrom, dateTo);
    throw err;
  }
}

function getMockTasks(status, assigned_to, dateFrom, dateTo) {
  let filtered = [...mockTasks];

  if (status && status !== 'all') {
    filtered = filtered.filter(t => t.status === status);
  }

  if (assigned_to && assigned_to !== 'all') {
    filtered = filtered.filter(t => t.assigned_to === assigned_to);
  }

  if (dateFrom) {
    filtered = filtered.filter(t => t.due_date && t.due_date >= dateFrom);
  }

  if (dateTo) {
    filtered = filtered.filter(t => t.due_date && t.due_date <= dateTo);
  }

  filtered.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  return filtered;
}

export async function createTask(data) {
  if (!isSupabaseConfigured) {
    const newTask = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      status: data.status || 'pending',
    };
    return newTask;
  }

  const { data: created, error } = await supabase
    .from('tasks')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateTask({ id, ...data }) {
  if (!isSupabaseConfigured) {
    return { id, ...data, updated_at: new Date().toISOString() };
  }

  const { data: updated, error } = await supabase
    .from('tasks')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function deleteTask(id) {
  if (!isSupabaseConfigured) {
    return { id };
  }

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return { id };
}

export async function fetchTasksByDateRange({ dateFrom, dateTo, assigned_to } = {}) {
  if (!isSupabaseConfigured) {
    return getMockTasksByDateRange(dateFrom, dateTo, assigned_to);
  }

  try {
    let query = supabase
      .from('tasks_with_details')
      .select('*');

    if (dateFrom) {
      query = query.gte('due_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('due_date', dateTo);
    }

    if (assigned_to && assigned_to !== 'all') {
      query = query.eq('assigned_to', assigned_to);
    }

    const { data, error } = await query
      .order('due_date', { ascending: true });

    if (error) {
      if (error.status === 401) return getMockTasksByDateRange(dateFrom, dateTo, assigned_to);
      throw error;
    }
    return data;
  } catch (err) {
    if (err.status === 401) return getMockTasksByDateRange(dateFrom, dateTo, assigned_to);
    throw err;
  }
}

function getMockTasksByDateRange(dateFrom, dateTo, assigned_to) {
  let filtered = [...mockTasks];

  if (dateFrom) {
    filtered = filtered.filter(t => t.due_date && t.due_date >= dateFrom);
  }
  if (dateTo) {
    filtered = filtered.filter(t => t.due_date && t.due_date <= dateTo);
  }
  if (assigned_to && assigned_to !== 'all') {
    filtered = filtered.filter(t => t.assigned_to === assigned_to);
  }

  filtered.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  return filtered;
}

export async function fetchProfiles(filters = {}) {
  if (!isSupabaseConfigured) {
    const list = mockProfiles;
    if (filters.role) {
      return list.filter((p) => p.role === filters.role);
    }
    return list;
  }

  try {
    let query = supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name');

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    const { data, error } = await query;

    if (error) {
      if (error.status === 401) return mockProfiles;
      throw error;
    }
    return data;
  } catch (err) {
    if (err.status === 401) return mockProfiles;
    throw err;
  }
}
