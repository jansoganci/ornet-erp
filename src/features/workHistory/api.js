import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

export async function searchWorkHistory(filters = {}) {
  const { search, type = 'both', dateFrom, dateTo, workType, workerId, siteId } = filters;

  const { data, error } = await supabase.rpc('search_work_history', {
    search_query: normalizeForSearch(search || ''),
    search_type: type
  });

  if (error) throw error;

  let results = data;

  // Apply additional client-side filters
  if (siteId) {
    results = results.filter(r => r.site_id === siteId);
  }
  if (dateFrom) {
    results = results.filter(r => r.scheduled_date >= dateFrom);
  }
  if (dateTo) {
    results = results.filter(r => r.scheduled_date <= dateTo);
  }
  if (workType && workType !== 'all') {
    results = results.filter(r => r.work_type === workType);
  }
  if (workerId && workerId !== 'all') {
    results = results.filter(r => r.assigned_to.includes(workerId));
  }

  return results;
}
