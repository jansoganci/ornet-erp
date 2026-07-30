import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { normalizeName } from "../core/mappers.ts";
import { parasutRequest } from "../core/parasut-client.ts";

type Contact = {
  id: string;
  attributes?: {
    name?: string;
    tax_number?: string;
    tax_office?: string;
  };
};

type Customer = {
  id: string;
  company_name: string;
  tax_number: string | null;
  identity_type: string | null;
  parasut_contact_id: string | null;
};

// One edge function invocation must stay well under Supabase's ~150s sync
// HTTP response limit. Each exact-match lookup is one rate-limited Paraşüt
// call (8 req/10s); with 300-500 customers a single unbatched pass would
// take 130-160+ seconds and risk a 504. 60/batch ≈ 75s worst case, leaving
// margin for DB round trips (found in code audit, docs/active/
// parasut-implementation-plan.md Phase 1.4 note).
const EXACT_MATCH_BATCH_SIZE = 60;

async function fetchContactsByTaxNumber(
  supabase: SupabaseClient,
  correlationId: string,
  actorId: string | null,
  taxNumber: string,
): Promise<Contact[]> {
  const result = await parasutRequest(supabase, {
    path: `/contacts?filter[tax_number]=${encodeURIComponent(taxNumber)}&filter[account_type]=customer`,
    operation: "bulk_match_exact_lookup",
    correlationId,
    actorId,
  }) as { data?: Contact[] };

  return result.data ?? [];
}

// Name-only fallback has no server-side filter to narrow it, so it still
// requires a full paginated pull. page[size] max is 25 (confirmed, roadmap
// Appendix C.5/C.12/D — the original page[size]=100 was invalid).
async function fetchAllCustomerContacts(
  supabase: SupabaseClient,
  correlationId: string,
  actorId: string | null,
): Promise<Contact[]> {
  const contacts: Contact[] = [];

  for (let page = 1; page <= 400; page += 1) {
    const result = await parasutRequest(supabase, {
      path: `/contacts?filter[account_type]=customer&page[size]=25&page[number]=${page}`,
      operation: "bulk_match_contacts",
      correlationId,
      actorId,
    }) as { data?: Contact[]; meta?: { total_pages?: number } };

    contacts.push(...(result.data ?? []));
    const totalPages = result.meta?.total_pages ?? page;
    if (page >= totalPages || (result.data ?? []).length === 0) break;
  }

  return contacts;
}

function toRow(customer: Customer, contact: Contact, matchType: string, score: number) {
  return {
    customer_id: customer.id,
    parasut_contact_id: contact.id,
    parasut_contact_name: contact.attributes?.name ?? null,
    parasut_tax_number: contact.attributes?.tax_number ?? null,
    match_type: matchType,
    score,
    source_snapshot: contact,
  };
}

async function upsertCandidates(supabase: SupabaseClient, rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;

  // On conflict, refresh source_snapshot/name/tax_number/score — e.g. a
  // previously "rejected" candidate whose underlying data was later
  // corrected should reflect the new snapshot on the next run. Deliberately
  // does NOT touch status/decided_at/decided_by, so a human's prior
  // accept/reject decision is never silently overwritten.
  const { data, error } = await supabase
    .from("parasut_match_candidates")
    .upsert(rows, { onConflict: "customer_id,parasut_contact_id" })
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

async function loadUnmatchedCustomers(
  supabase: SupabaseClient,
  range?: { from: number; to: number },
): Promise<{ customers: Customer[]; total: number }> {
  const { count, error: countError } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .is("parasut_contact_id", null);
  if (countError) throw countError;

  let query = supabase
    .from("customers")
    .select("id, company_name, tax_number, identity_type, parasut_contact_id")
    .is("deleted_at", null)
    .is("parasut_contact_id", null)
    .order("id");

  if (range) query = query.range(range.from, range.to);

  const { data, error } = await query;
  if (error) throw error;

  return { customers: (data ?? []) as Customer[], total: count ?? 0 };
}

// Exact match path (VKN/TCKN via filter[tax_number]) — batched by offset.
// Call repeatedly with the returned nextOffset until done:true. Skips
// customers with no tax_number (left for bulkMatchNameFallback) and skips
// ambiguous lookups (0 or >1 Paraşüt results) rather than guessing.
export async function bulkMatch(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<{
  inserted: number;
  candidates: number;
  processed: number;
  totalUnmatched: number;
  nextOffset: number | null;
  done: boolean;
}> {
  await requireRole(params.supabase, params.actorId, ["admin"]);

  const offset = Math.max(0, Math.trunc(Number(params.payload?.offset ?? 0)) || 0);
  const { customers: batch, total } = await loadUnmatchedCustomers(params.supabase, {
    from: offset,
    to: offset + EXACT_MATCH_BATCH_SIZE - 1,
  });

  const rows: Record<string, unknown>[] = [];

  for (const customer of batch) {
    const customerTax = customer.tax_number?.trim();
    // A tax number with no known identity_type can't be safely auto-labeled
    // exact_vkn vs exact_tckn — don't guess "vkn" by default (confirmed
    // bug, independent audit 2026-07-23). Leave for the name-fallback pass
    // instead; the underlying data issue (missing identity_type) needs a
    // human fix regardless.
    if (!customerTax || (customer.identity_type !== "vkn" && customer.identity_type !== "tckn")) continue;

    const matches = await fetchContactsByTaxNumber(
      params.supabase,
      params.correlationId,
      params.actorId,
      customerTax,
    );

    if (matches.length === 1) {
      const matchType = customer.identity_type === "tckn" ? "exact_tckn" : "exact_vkn";
      rows.push(toRow(customer, matches[0], matchType, 100));
    }
  }

  const inserted = await upsertCandidates(params.supabase, rows);
  const processed = Math.min(offset + batch.length, total);
  const done = batch.length < EXACT_MATCH_BATCH_SIZE || processed >= total;

  return {
    inserted,
    candidates: rows.length,
    processed,
    totalUnmatched: total,
    nextOffset: done ? null : processed,
    done,
  };
}

// Name-only fallback for customers with no tax_number, or whose exact match
// was skipped as ambiguous. Separate action from bulkMatch (not batched by
// offset) because its cost profile is different: one full Paraşüt contact
// pull, not many small per-customer calls — run it once, after exact-match
// batches finish, not interleaved with them.
export async function bulkMatchNameFallback(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
}): Promise<{ inserted: number; candidates: number }> {
  await requireRole(params.supabase, params.actorId, ["admin"]);

  const { customers } = await loadUnmatchedCustomers(params.supabase);
  const contacts = await fetchAllCustomerContacts(params.supabase, params.correlationId, params.actorId);
  const rows: Record<string, unknown>[] = [];

  for (const customer of customers) {
    const customerName = normalizeName(customer.company_name);
    if (!customerName) continue;

    for (const contact of contacts) {
      const contactName = normalizeName(contact.attributes?.name);
      if (customerName !== contactName) continue;
      rows.push(toRow(customer, contact, "name_only", 70));
    }
  }

  const inserted = await upsertCandidates(params.supabase, rows);
  return { inserted, candidates: rows.length };
}
