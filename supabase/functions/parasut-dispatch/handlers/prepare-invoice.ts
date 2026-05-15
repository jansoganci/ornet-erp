import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { acquireIdempotency, finishIdempotency, invoiceKey } from "../core/idempotency.ts";
import { financialTxToSalesInvoicePayload } from "../core/mappers.ts";
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

function validateForDraft(tx: Record<string, unknown>, customer: Record<string, unknown>) {
  if (tx.direction !== "income") throw new ParasutValidationError("Only income rows can be invoiced", 400);
  if (tx.parasut_sync_status === "confirmed") throw new ParasutValidationError("Invoice is already confirmed", 409);
  if (tx.parasut_invoice_id) throw new ParasutValidationError("Draft already exists for this transaction", 409);
  if (!customer?.parasut_contact_id) throw new ParasutValidationError("Customer is not matched with Paraşüt", 400);
  if (!customer?.tax_number || !customer?.identity_type) {
    throw new ParasutValidationError("Customer tax identity is incomplete", 400);
  }
  if (Number(tx.amount_try ?? 0) <= 0) throw new ParasutValidationError("Invoice amount must be positive", 400);
}

export async function prepareInvoice(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const id = String(params.payload?.financial_transaction_id ?? "");
  if (!id) throw new ParasutValidationError("financial_transaction_id is required", 400);

  const key = invoiceKey(id);
  const idem = await acquireIdempotency(params.supabase, key, "prepare_invoice", id);
  if (!idem.acquired) return idem.response;

  try {
    const tx = await loadTransaction(params.supabase, id);
    const customer = tx.customers ?? {};
    validateForDraft(tx, customer);

    const body = financialTxToSalesInvoicePayload(tx, customer);
    const result = await parasutRequest(params.supabase, {
      path: "/sales_invoices",
      method: "POST",
      body,
      operation: "prepare_invoice",
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: id,
      idempotencyKey: key,
    }) as { data?: { id?: string } };

    const invoiceId = result.data?.id;
    if (!invoiceId) throw new ParasutValidationError("Paraşüt invoice response did not include an id", 502, result);

    const { error } = await params.supabase
      .from("financial_transactions")
      .update({
        parasut_invoice_id: invoiceId,
        parasut_sync_status: "draft",
        parasut_error: null,
      })
      .eq("id", id);
    if (error) throw error;

    await finishIdempotency(params.supabase, key, "succeeded", result);
    return result;
  } catch (error) {
    await finishIdempotency(
      params.supabase,
      key,
      "failed",
      null,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
