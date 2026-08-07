import { supabase } from '../../lib/supabase';

/**
 * Bulk-fetch all customers (id + company_name) in one query.
 * Returns a Map: lowercased company_name → customer id.
 */
async function fetchAllCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name')
    .is('deleted_at', null);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (row.company_name) {
      map.set(row.company_name.trim().toLowerCase(), row.id);
    }
  }
  return map;
}

/**
 * Bulk-fetch all sites (id + customer_id + site_name) in one query.
 * Returns a Map: "customerId|lowercased site_name" → site id.
 */
async function fetchAllSites() {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('id, customer_id, site_name')
    .is('deleted_at', null);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (row.site_name && row.customer_id) {
      const key = `${row.customer_id}|${row.site_name.trim().toLowerCase()}`;
      map.set(key, row.id);
    }
  }
  return map;
}

const BATCH_SIZE = 25;

/**
 * Import subscriptions from validated rows.
 *
 * Strategy:
 *   1. Bulk-fetch all customers  (1 call)
 *   2. Bulk-fetch all sites      (1 call)
 *   3. Call bulk_import_subscriptions RPC in batches of BATCH_SIZE
 *      (each batch = separate transaction to avoid statement timeout)
 *
 * @param {Array} rows — validated rows from validateAndMapRows()
 * @param {Object} [options]
 * @param {(progress: {current: number, total: number}) => void} [options.onProgress]
 * @returns {{ created: number, failed: number, errors: Array<{row: number, message: string}> }}
 */
export async function importSubscriptionsFromRows(rows, { onProgress } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // --- Phase 1: Bulk-fetch existing data (2 queries) ---
  const customerMap = await fetchAllCustomers();
  const siteMap = await fetchAllSites();

  // --- Phase 2: Resolve site_id for each row client-side ---
  const rpcItems = [];
  const clientErrors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row number (1-based + header)

    // Customer lookup
    const customerKey = row.company_name?.trim().toLowerCase();
    const customerId = customerKey ? customerMap.get(customerKey) : null;

    if (!customerId) {
      clientErrors.push({
        row: rowNum,
        message: `Müşteri bulunamadı: "${row.company_name}"`,
      });
      continue;
    }

    // Site lookup
    const siteKey = `${customerId}|${row.site_name?.trim().toLowerCase()}`;
    const siteId = siteMap.get(siteKey);

    if (!siteId) {
      clientErrors.push({
        row: rowNum,
        message: `Lokasyon bulunamadı: "${row.site_name}" (Müşteri: ${row.company_name})`,
      });
      continue;
    }

    // Build payload for RPC (raw values — no summing; view calculates subtotal/total)
    rpcItems.push({
      row_num:              rowNum,
      site_id:              siteId,
      start_date:           row.start_date,
      billing_day:          1,
      base_price:           row.base_price ?? 0,
      sim_amount:           row.sim_amount ?? 0,
      sms_fee:              row.sms_fee ?? 0,
      line_fee:             row.line_fee ?? 0,
      cost:                 row.cost ?? 0,
      vat_rate:             20,
      currency:             'TRY',
      billing_frequency:    row.billing_frequency || 'monthly',
      payment_start_month:  row.payment_start_month ?? null,
      service_type:         row.service_type || null,
      official_invoice:     row.official_invoice !== false,
      notes:                row.notes || null,
      setup_notes:          row.setup_notes || null,
      subscriber_title:     row.subscriber_title || null,
      // Site-fill only (RPC writes empty customer_sites fields; not stored on subscriptions)
      site_alarm_center:    row.site_alarm_center || null,
      site_account_no:      row.site_account_no || null,
    });
  }

  // --- Phase 3: RPC calls in batches to avoid statement timeout ---
  let rpcCreated = 0;
  let rpcErrors = [];

  const totalItems = rpcItems.length;
  let processed = clientErrors.length; // count client errors as already processed
  onProgress?.({ current: processed, total: rows.length });

  for (let i = 0; i < totalItems; i += BATCH_SIZE) {
    const batch = rpcItems.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.rpc('bulk_import_subscriptions', {
      items: batch,
      p_user_id: user.id,
    });

    if (error) throw error;

    rpcCreated += data?.created ?? 0;
    rpcErrors = rpcErrors.concat(data?.errors ?? []);
    processed += batch.length;
    onProgress?.({ current: processed, total: rows.length });
  }

  // Merge client-side errors + server-side errors
  const allErrors = [...clientErrors, ...rpcErrors];

  return {
    created: rpcCreated,
    failed: allErrors.length,
    errors: allErrors,
  };
}
