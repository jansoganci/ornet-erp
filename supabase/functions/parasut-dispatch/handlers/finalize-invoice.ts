import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutInProgressError, ParasutValidationError } from "../core/errors.ts";
import { acquireIdempotency, finalizeKey, finishIdempotency } from "../core/idempotency.ts";
import { eDocumentPayload } from "../core/mappers.ts";
import { pollTrackableJob } from "../core/job-poller.ts";
import { parasutRequest } from "../core/parasut-client.ts";

type EDocumentType = "e_invoices" | "e_archives";

async function loadTransaction(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, customers(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Record<string, unknown> & { customers?: Record<string, unknown> };
}

type EInvoiceInboxCheck = { isEInvoicePayer: boolean; registeredAt: string | null };

async function checkEInvoiceInbox(
  supabase: SupabaseClient,
  taxNumber: string,
  correlationId: string,
  actorId: string | null,
  erpRecordId: string,
): Promise<EInvoiceInboxCheck> {
  const result = await parasutRequest(supabase, {
    path: `/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(taxNumber)}`,
    operation: "check_e_invoice_inbox",
    correlationId,
    actorId,
    erpRecordId,
  }) as { data?: Array<{ attributes?: { registered_at?: string; address_registered_at?: string } }> };

  const entries = result.data ?? [];
  if (entries.length === 0) return { isEInvoicePayer: false, registeredAt: null };

  // Prefer address_registered_at (registration date of the specific e-Fatura
  // address) over registered_at if both are present — which field actually
  // governs the "invoice date can't predate this" rule is unconfirmed
  // against a real response (roadmap Appendix D.6) — verify on first real
  // finalize and swap the preference if wrong.
  const attrs = entries[0]?.attributes ?? {};
  const registeredAt = attrs.address_registered_at ?? attrs.registered_at ?? null;
  return { isEInvoicePayer: true, registeredAt };
}

// Once the job is done, the trackable_job response does NOT carry the
// resulting e-document id (confirmed via official quick-start guide,
// roadmap B.5) — it must be read from the sales_invoice's own
// active_e_document relationship.
async function fetchActiveEDocumentId(
  supabase: SupabaseClient,
  salesInvoiceId: string,
  correlationId: string,
  actorId: string | null,
  erpRecordId: string,
): Promise<string | null> {
  const result = await parasutRequest(supabase, {
    path: `/sales_invoices/${salesInvoiceId}?include=active_e_document`,
    operation: "fetch_active_e_document",
    correlationId,
    actorId,
    erpRecordId,
  }) as { data?: { relationships?: { active_e_document?: { data?: { id?: string } | null } } } };

  return result.data?.relationships?.active_e_document?.data?.id ?? null;
}

// Poll the job to completion, then look up and record the real e-document
// id. Safe to call more than once for the same jobId — if a previous call
// already reached "confirmed", it's a no-op read followed by a return.
async function completeFinalization(
  params: { supabase: SupabaseClient; correlationId: string; actorId: string | null },
  id: string,
  jobId: string,
  type: EDocumentType,
): Promise<{ e_document_id: string; e_document_type: EDocumentType; trackable_job_id: string }> {
  const tx = await loadTransaction(params.supabase, id);
  if (tx.parasut_sync_status === "confirmed" && tx.parasut_e_document_id) {
    return { e_document_id: String(tx.parasut_e_document_id), e_document_type: type, trackable_job_id: jobId };
  }

  await pollTrackableJob({
    supabase: params.supabase,
    jobId,
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: id,
  });

  const eDocumentId = await fetchActiveEDocumentId(
    params.supabase,
    String(tx.parasut_invoice_id),
    params.correlationId,
    params.actorId,
    id,
  );
  if (!eDocumentId) {
    throw new ParasutValidationError("Paraşüt job finished but no active e-document was found on the invoice", 502);
  }

  const { error } = await params.supabase
    .from("financial_transactions")
    .update({
      parasut_sync_status: "confirmed",
      parasut_e_document_id: eDocumentId,
      parasut_synced_at: new Date().toISOString(),
      parasut_error: null,
    })
    .eq("id", id);
  if (error) throw error;

  return { e_document_id: eDocumentId, e_document_type: type, trackable_job_id: jobId };
}

// Replay path: the POST to Paraşüt already succeeded on a prior attempt (a
// trackable_job was created) — finish polling/confirming using the tx's own
// stored job id instead of re-POSTing /e_invoices|/e_archives.
async function finishAfterJobCreated(
  params: { supabase: SupabaseClient; correlationId: string; actorId: string | null },
  id: string,
): Promise<unknown> {
  const tx = await loadTransaction(params.supabase, id);
  const jobId = tx.parasut_trackable_job_id ? String(tx.parasut_trackable_job_id) : "";
  if (!jobId) {
    throw new ParasutValidationError(
      "Finalize was already marked succeeded but no trackable_job_id is on record — needs manual investigation",
      500,
    );
  }
  const type: EDocumentType = tx.invoice_type === "e_fatura" ? "e_invoices" : "e_archives";
  return completeFinalization(params, id, jobId, type);
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

  const key = finalizeKey(id);
  const idem = await acquireIdempotency(params.supabase, key, "finalize_invoice", id);
  if (!idem.acquired) {
    if (idem.outcome === "replay") return finishAfterJobCreated(params, id);
    throw new ParasutInProgressError(`Invoice finalization for ${id} is already in progress`);
  }

  // Tracks whether the POST to Paraşüt itself succeeded (a trackable_job
  // was created). Once true, the catch block must not mark this key
  // "failed" — Paraşüt has already started an irreversible e-document
  // creation; any failure after this point is a local/polling problem to
  // retry via finishAfterJobCreated, not a reason to allow a second POST.
  let jobCreated = false;

  try {
    const tx = await loadTransaction(params.supabase, id);
    const customer = tx.customers ?? {};
    if (tx.deleted_at) throw new ParasutValidationError("Deleted transactions cannot be invoiced", 400);
    if (tx.parasut_sync_status !== "draft" || !tx.parasut_invoice_id) {
      throw new ParasutValidationError("Only draft invoices can be finalized", 400);
    }
    if (!customer.tax_number) throw new ParasutValidationError("Customer tax number is required", 400);

    const inboxCheck = await checkEInvoiceInbox(
      params.supabase,
      String(customer.tax_number),
      params.correlationId,
      params.actorId,
      id,
    );
    const useEInvoice = inboxCheck.isEInvoicePayer;

    // Invoice date constraint (roadmap Appendix B.4/C.10/D.6): the issue
    // date already fixed on the draft (tx.transaction_date, set at prepare
    // time) can't predate the buyer's e-Fatura registration date. Catch
    // this before calling Paraşüt rather than surfacing a confusing API
    // error after the fact.
    if (inboxCheck.registeredAt && tx.transaction_date) {
      const issueDate = new Date(String(tx.transaction_date));
      const registeredAt = new Date(inboxCheck.registeredAt);
      if (!Number.isNaN(issueDate.getTime()) && !Number.isNaN(registeredAt.getTime()) && issueDate < registeredAt) {
        throw new ParasutValidationError(
          `Invoice date (${tx.transaction_date}) predates the buyer's e-Fatura registration date (${inboxCheck.registeredAt})`,
          400,
        );
      }
    }

    const type: EDocumentType = useEInvoice ? "e_invoices" : "e_archives";
    const result = await parasutRequest(params.supabase, {
      path: `/${type}`,
      method: "POST",
      body: eDocumentPayload(type, String(tx.parasut_invoice_id)),
      operation: "finalize_invoice",
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: id,
      idempotencyKey: key,
    }) as { data?: { id?: string } };

    // POST /e_invoices|/e_archives returns the trackable_job itself as
    // `data` (type "trackable_jobs") — data.id IS the job id, not an
    // e-document id, and there is no separate attributes.trackable_job_id
    // field. The previous code read the wrong field for jobId (always
    // null) and treated data.id as if it were the final e-document id,
    // so it never polled and marked "confirmed" before the job even ran.
    // Confirmed bug, independent audit 2026-07-23.
    const jobId = result.data?.id ?? null;
    if (!jobId) throw new ParasutValidationError("Paraşüt did not return a trackable job id", 502, result);

    jobCreated = true;

    await params.supabase
      .from("financial_transactions")
      .update({
        parasut_sync_status: "sent",
        parasut_trackable_job_id: jobId,
        invoice_type: useEInvoice ? "e_fatura" : "e_arsiv",
        parasut_error: null,
      })
      .eq("id", id);

    // Mark succeeded now — the irreversible POST is done. Everything after
    // this (poll, fetch e-document, mark confirmed) is safely retryable via
    // finishAfterJobCreated on the replay path above, without ever
    // re-POSTing to Paraşüt.
    await finishIdempotency(params.supabase, key, "succeeded", { jobId, type });

    const response = await completeFinalization(params, id, jobId, type);
    return response;
  } catch (error) {
    if (!jobCreated) {
      await finishIdempotency(
        params.supabase,
        key,
        "failed",
        null,
        error instanceof Error ? error.message : String(error),
      );
    }
    throw error;
  }
}
