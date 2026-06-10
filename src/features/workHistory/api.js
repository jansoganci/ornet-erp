import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

export async function searchWorkHistory(filters = {}) {
  const {
    search,
    type = 'both',
    dateFrom,
    dateTo,
    workType,
    workerId,
    siteId,
    limit = 200,
    offset = 0,
  } = filters;

  const { data, error } = await supabase.rpc('search_work_history', {
    search_query: normalizeForSearch(search || ''),
    search_type: type,
    p_site_id: siteId || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_work_type: workType && workType !== 'all' ? workType : null,
    p_worker_id: workerId && workerId !== 'all' ? workerId : null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data ?? [];
}
