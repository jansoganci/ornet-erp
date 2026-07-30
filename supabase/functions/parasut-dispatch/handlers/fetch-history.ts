import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { parasutRequest } from "../core/parasut-client.ts";

type SalesInvoiceRecord = { id?: string; attributes?: Record<string, unknown> };

// TODO(Phase 6 test): filter[issue_date][gteq] is the roadmap's assumed
// range-operator syntax but was not directly confirmed against the swagger
// spec — verify it 200s (not 400s) during real-API testing; if it 400s,
// fall back to two explicit filter[issue_date] calls or a client-side cutoff.
async function fetchAllInvoicesSince(
  supabase: SupabaseClient,
  correlationId: string,
  actorId: string | null,
  erpRecordId: string,
  contactId: string,
  issueDate: string,
): Promise<SalesInvoiceRecord[]> {
  const invoices: SalesInvoiceRecord[] = [];

  for (let page = 1; page <= 400; page += 1) {
    const result = await parasutRequest(supabase, {
      path:
        `/sales_invoices?filter[contact_id]=${encodeURIComponent(contactId)}` +
        `&filter[issue_date][gteq]=${issueDate}&filter[item_type]=invoice` +
        `&include=payments,active_e_document&page[size]=25&page[number]=${page}`,
      operation: "fetch_history",
      correlationId,
      actorId,
      erpRecordId,
    }) as { data?: SalesInvoiceRecord[]; meta?: { total_pages?: number } };

    const pageData = result.data ?? [];
    invoices.push(...pageData);

    const totalPages = result.meta?.total_pages ?? page;
    if (page >= totalPages || pageData.length === 0) break;
  }

  return invoices;
}

export async function fetchHistory(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<{ data: SalesInvoiceRecord[] }> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const customerId = String(params.payload?.customer_id ?? "");
  if (!customerId) throw new ParasutValidationError("customer_id is required", 400);

  const { data: customer, error } = await params.supabase
    .from("customers")
    .select("parasut_contact_id")
    .eq("id", customerId)
    .single();

  if (error) throw error;
  if (!customer.parasut_contact_id) return { data: [] };

  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - 12);
  const issueDate = dateFrom.toISOString().slice(0, 10);

  const data = await fetchAllInvoicesSince(
    params.supabase,
    params.correlationId,
    params.actorId,
    customerId,
    customer.parasut_contact_id,
    issueDate,
  );

  return { data };
}
