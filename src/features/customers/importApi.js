import { supabase } from '../../lib/supabase';

const CHUNK_SIZE = 50;

/**
 * Fetch all existing customers (id + company_name) in one call.
 */
async function fetchAllExistingCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name')
    .is('deleted_at', null);
  if (error) throw error;
  // Build a case-insensitive map: lowercased name → id
  const map = {};
  for (const row of data || []) {
    if (row.company_name) {
      map[row.company_name.trim().toLowerCase()] = row.id;
    }
  }
  return map;
}

/**
 * Fetch all existing sites (customer_id + account_no) in one call.
 */
async function fetchAllExistingSites() {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('customer_id, account_no')
    .is('deleted_at', null)
    .not('account_no', 'is', null);
  if (error) throw error;
  const set = new Set();
  for (const row of data || []) {
    if (row.account_no) {
      set.add(`${row.customer_id}|${row.account_no.trim()}`);
    }
  }
  return set;
}

/**
 * Insert an array in chunks, returning results per chunk.
 */
async function insertInChunks(table, rows) {
  const results = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .insert(chunk)
      .select('id');
    if (error) throw error;
    results.push(...(data || []));
  }
  return results;
}

/**
 * Import customers and sites from validated rows.
 * Uses batch strategy: bulk-fetch existing data, batch-insert new records.
 *
 * @param {Array} rows — validated rows from validateAndMapRows()
 * @param {Object} [options]
 * @param {(progress: {current: number, total: number}) => void} [options.onProgress]
 * @returns {{ created: number, skipped: number, failed: number, errors: Array, results: Array }}
 */
export async function importCustomersAndSitesFromRows(rows, options = {}) {
  const { onProgress } = options;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const total = rows.length;
  let processed = 0;

  const report = (n) => {
    processed = n;
    onProgress?.({ current: processed, total });
  };

  report(0);

  // --- Phase 1: Bulk-fetch existing data (2 queries instead of ~800) ---
  const existingCustomerMap = await fetchAllExistingCustomers();
  const existingSiteSet = await fetchAllExistingSites();

  // --- Phase 2: Determine which customers to create ---
  const uniqueCustomers = new Map(); // lowered name → { company_name, subscriber_title }
  for (const row of rows) {
    const key = row.company_name.trim().toLowerCase();
    if (!existingCustomerMap[key] && !uniqueCustomers.has(key)) {
      uniqueCustomers.set(key, {
        company_name: row.company_name.trim(),
        subscriber_title: row.subscriber_title || null,
      });
    }
  }

  // --- Phase 3: Batch-insert new customers ---
  const newCustomerPayloads = [...uniqueCustomers.values()];
  if (newCustomerPayloads.length > 0) {
    const inserted = await insertInChunks('customers', newCustomerPayloads);
    // Map inserted IDs back
    for (let i = 0; i < newCustomerPayloads.length; i++) {
      const key = newCustomerPayloads[i].company_name.trim().toLowerCase();
      existingCustomerMap[key] = inserted[i]?.id;
    }
  }

  report(Math.round(total * 0.2)); // ~20% after customer creation

  // --- Phase 4: Build site payloads, skip duplicates ---
  const sitePayloads = [];
  const results = [];
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const customerKey = row.company_name.trim().toLowerCase();
    const customerId = existingCustomerMap[customerKey];

    if (!customerId) {
      errors.push({ row: rowNum, message: 'Customer insert returned no ID' });
      results.push({ rowNum, status: 'failed', message: 'Customer insert returned no ID' });
      continue;
    }

    // Check duplicate by account_no
    if (row.account_no) {
      const siteKey = `${customerId}|${row.account_no.trim()}`;
      if (existingSiteSet.has(siteKey)) {
        skipped++;
        results.push({ rowNum, status: 'skipped', message: 'Hesap no zaten mevcut' });
        continue;
      }
      // Mark as used to avoid duplicates within the same import
      existingSiteSet.add(siteKey);
    }

    const payload = {
      customer_id: customerId,
      address: row.address || '',
      site_name: row.site_name || '',
    };
    if (row.alarm_center) payload.alarm_center = row.alarm_center;
    if (row.account_no) payload.account_no = row.account_no;
    if (row.city) payload.city = row.city;
    if (row.district) payload.district = row.district;
    if (row.connection_date) payload.connection_date = row.connection_date;

    sitePayloads.push({ payload, rowNum, index: i });
    results.push(null); // placeholder — filled after insert
  }

  // --- Phase 5: Batch-insert sites in chunks ---
  const siteBatches = [];
  for (let i = 0; i < sitePayloads.length; i += CHUNK_SIZE) {
    siteBatches.push(sitePayloads.slice(i, i + CHUNK_SIZE));
  }

  for (let batchIdx = 0; batchIdx < siteBatches.length; batchIdx++) {
    const batch = siteBatches[batchIdx];
    try {
      const { error: insertErr } = await supabase
        .from('customer_sites')
        .insert(batch.map((b) => b.payload));
      if (insertErr) throw insertErr;

      for (const item of batch) {
        created++;
        results[item.index] = { rowNum: item.rowNum, status: 'created' };
      }
    } catch (err) {
      // If batch fails, mark all rows in this batch as failed
      for (const item of batch) {
        errors.push({ row: item.rowNum, message: err?.message || String(err) });
        results[item.index] = { rowNum: item.rowNum, status: 'failed', message: err?.message || String(err) };
      }
    }

    // Progress: 20% was customer phase, remaining 80% is sites
    const siteProgress = ((batchIdx + 1) / siteBatches.length) * 0.8;
    report(Math.round(total * (0.2 + siteProgress)));
  }

  // Fill any remaining null results (shouldn't happen, but safety)
  for (let i = 0; i < results.length; i++) {
    if (results[i] === null) {
      results[i] = { rowNum: i + 2, status: 'failed', message: 'Unknown error' };
    }
  }

  return { created, skipped, failed: errors.length, errors, results };
}
