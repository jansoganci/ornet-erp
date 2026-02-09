import { supabase } from '../../lib/supabase';
import { createCustomer } from '../customers/api';
import { createSite } from '../customerSites/api';
import { createSubscription } from './api';

/**
 * Find customer by company_name (ilike, trim). Returns id or null.
 */
async function findCustomerByCompanyName(companyName) {
  const name = String(companyName).trim();
  if (!name) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .ilike('company_name', name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Find site by customer_id and site_name. Returns id or null.
 */
async function findSiteByCustomerAndName(customerId, siteName) {
  const name = String(siteName).trim();
  if (!customerId || !name) return null;
  const { data, error } = await supabase
    .from('customer_sites')
    .select('id')
    .eq('customer_id', customerId)
    .ilike('site_name', name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Fetch all profiles and build full_name -> id map (case-insensitive match by trimmed name).
 */
async function getCashCollectorNameToIdMap() {
  const { data, error } = await supabase.from('profiles').select('id, full_name');
  if (error) throw error;
  const map = {};
  (data || []).forEach((p) => {
    const name = (p.full_name || '').trim();
    if (name) map[name.toLowerCase()] = p.id;
  });
  return map;
}

/**
 * Import subscriptions from validated rows. Find or create customer/site per row (with cache), then createSubscription.
 * Returns { created, failed, errors: [{ row, message }] }.
 */
export async function importSubscriptionsFromRows(rows) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const customerCache = {};
  const siteCache = {};
  const nameToProfileId = await getCashCollectorNameToIdMap();

  let created = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      let customerId = customerCache[row.company_name];
      if (!customerId) {
        customerId = await findCustomerByCompanyName(row.company_name);
        if (!customerId) {
          const newCustomer = await createCustomer({ company_name: row.company_name });
          customerId = newCustomer.id;
        }
        customerCache[row.company_name] = customerId;
      }

      const cacheKey = `${customerId}|${row.site_name}`;
      let siteId = siteCache[cacheKey];
      if (!siteId) {
        siteId = await findSiteByCustomerAndName(customerId, row.site_name);
        if (!siteId) {
          const newSite = await createSite({
            customer_id: customerId,
            site_name: row.site_name,
            address: row.address,
            account_no: row.account_no || null,
          });
          siteId = newSite.id;
        }
        siteCache[cacheKey] = siteId;
      }

      let cash_collector_id = null;
      if (row.cash_collector_name && row.subscription_type === 'manual_cash') {
        const key = String(row.cash_collector_name).trim().toLowerCase();
        cash_collector_id = nameToProfileId[key] || null;
      }

      const subscriptionPayload = {
        site_id: siteId,
        start_date: row.start_date,
        billing_day: row.billing_day ?? 1,
        base_price: row.base_price,
        sms_fee: row.sms_fee ?? 0,
        line_fee: row.line_fee ?? 0,
        vat_rate: row.vat_rate ?? 20,
        cost: 0,
        currency: 'TRY',
        billing_frequency: row.billing_frequency ?? 'monthly',
        subscription_type: row.subscription_type,
        card_bank_name: row.card_bank_name || null,
        card_last4: row.card_last4 || null,
        cash_collector_id,
        official_invoice: row.official_invoice !== false,
        service_type: row.service_type || null,
      };

      await createSubscription(subscriptionPayload);
      created++;
    } catch (err) {
      errors.push({ row: rowNum, message: err?.message || String(err) });
    }
  }

  return { created, failed: errors.length, errors };
}
