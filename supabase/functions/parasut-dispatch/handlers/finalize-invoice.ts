import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { eDocumentPayload } from "../core/mappers.ts";
import { pollTrackableJob } from "../core/job-poller.ts";
import { parasutRequest } from "../core/parasut-client.ts";

async function loadTransaction(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, customers(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Record<string, unknown> & { customers?: Record<string, unknown> };
}

async function isEInvoicePayer(
  supabase: SupabaseClient,
  taxNumber: string,
  correlationId: string,
  actorId: string | null,
  erpRecordId: string,
): Promise<boolean> {
  const result = await parasutRequest(supabase, {
    path: `/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(taxNumber)}`,
    operation: "check_e_invoice_inbox",
    correlationId,
    actorId,
    erpRecordId,
  }) as { data?: unknown[] };

  return (result.data ?? []).length > 0;
}

export async function finalizeInvoice(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const id = String(params.payload?.financial_transaction_id ?? "");
  if (!id) throw new ParasutValidationError("financial_transaction_id is required", 400);

  const tx = await loadTransaction(params.supabase, id);
  const customer = tx.customers ?? {};
  if (tx.parasut_sync_status !== "draft" || !tx.parasut_invoice_id) {
    throw new ParasutValidationError("Only draft invoices can be finalized", 400);
  }
  if (!customer.tax_number) throw new ParasutValidationError("Customer tax number is required", 400);

  const useEInvoice = await isEInvoicePayer(
    params.supabase,
    String(customer.tax_number),
    params.correlationId,
    params.actorId,
    id,
  );
  const type = useEInvoice ? "e_invoices" : "e_archives";
  const result = await parasutRequest(params.supabase, {
    path: `/${type}`,
    method: "POST",
    body: eDocumentPayload(type, String(tx.parasut_invoice_id)),
    operation: "finalize_invoice",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: id,
  }) as { data?: { id?: string; attributes?: { trackable_job_id?: string } } };

  const eDocumentId = result.data?.id ?? null;
  const jobId = result.data?.attributes?.trackable_job_id ?? null;

  await params.supabase
    .from("financial_transactions")
    .update({
      parasut_sync_status: "sent",
      parasut_e_document_id: eDocumentId,
      parasut_trackable_job_id: jobId,
      parasut_error: null,
    })
    .eq("id", id);

  if (jobId) {
    await pollTrackableJob({
      supabase: params.supabase,
      jobId,
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: id,
    });
  }

  const { error } = await params.supabase
    .from("financial_transactions")
    .update({
      parasut_sync_status: "confirmed",
      parasut_e_document_id: eDocumentId,
      parasut_synced_at: new Date().toISOString(),
      parasut_error: null,
      invoice_type: useEInvoice ? "e_fatura" : "e_arsiv",
    })
    .eq("id", id);

  if (error) throw error;
  return { ...result, e_document_type: type };
}
