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

async function fetchContacts(
  supabase: SupabaseClient,
  correlationId: string,
  actorId: string | null,
): Promise<Contact[]> {
  const contacts: Contact[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const result = await parasutRequest(supabase, {
      path: `/contacts?page[size]=100&page[number]=${page}`,
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

export async function bulkMatch(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
}): Promise<{ inserted: number; candidates: number }> {
  await requireRole(params.supabase, params.actorId, ["admin"]);

  const { data: customers, error } = await params.supabase
    .from("customers")
    .select("id, company_name, tax_number, identity_type, parasut_contact_id")
    .is("deleted_at", null);

  if (error) throw error;

  const contacts = await fetchContacts(params.supabase, params.correlationId, params.actorId);
  const rows: Record<string, unknown>[] = [];

  for (const customer of (customers ?? []) as Customer[]) {
    if (customer.parasut_contact_id) continue;
    const customerTax = customer.tax_number?.trim();
    const customerName = normalizeName(customer.company_name);

    for (const contact of contacts) {
      const contactTax = contact.attributes?.tax_number?.trim();
      const contactName = normalizeName(contact.attributes?.name);
      let matchType: "exact_vkn" | "exact_tckn" | "name_only" | null = null;
      let score = 0;

      if (customerTax && contactTax && customerTax === contactTax && customer.identity_type === "vkn") {
        matchType = "exact_vkn";
        score = 100;
      } else if (customerTax && contactTax && customerTax === contactTax && customer.identity_type === "tckn") {
        matchType = "exact_tckn";
        score = 100;
      } else if (customerName && contactName && customerName === contactName) {
        matchType = "name_only";
        score = 70;
      }

      if (!matchType) continue;

      rows.push({
        customer_id: customer.id,
        parasut_contact_id: contact.id,
        parasut_contact_name: contact.attributes?.name ?? null,
        parasut_tax_number: contact.attributes?.tax_number ?? null,
        match_type: matchType,
        score,
        source_snapshot: contact,
      });
    }
  }

  if (rows.length === 0) return { inserted: 0, candidates: 0 };

  const { data, error: insertError } = await params.supabase
    .from("parasut_match_candidates")
    .upsert(rows, {
      onConflict: "customer_id,parasut_contact_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) throw insertError;
  return { inserted: data?.length ?? 0, candidates: rows.length };
}
