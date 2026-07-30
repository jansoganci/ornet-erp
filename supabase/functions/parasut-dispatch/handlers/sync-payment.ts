import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutInProgressError, ParasutValidationError } from "../core/errors.ts";
import { acquireIdempotency, finishIdempotency, paymentKey } from "../core/idempotency.ts";
import { parasutRequest } from "../core/parasut-client.ts";

type SyncPaymentResult = {
  data?: { id?: string; relationships?: { transaction?: { data?: { id?: string } } } };
};

async function applyLocalUpdate(
  supabase: SupabaseClient,
  paymentId: string,
  result: SyncPaymentResult,
): Promise<void> {
  const { error } = await supabase
    .from("financial_transaction_payments")
    .update({
      parasut_payment_id: result.data?.id ?? null,
      parasut_transaction_id: result.data?.relationships?.transaction?.data?.id ?? null,
      parasut_synced_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (error) throw error;
}

export async function syncPayment(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const paymentId = String(params.payload?.financial_transaction_payment_id ?? "");
  if (!paymentId) throw new ParasutValidationError("financial_transaction_payment_id is required", 400);

  // Was entirely unprotected before (paymentKey() existed but was unused) —
  // a double-click could POST the same collection to Paraşüt twice.
  // Confirmed bug, independent audit 2026-07-23.
  const key = paymentKey(paymentId);
  const idem = await acquireIdempotency(params.supabase, key, "sync_payment", paymentId);
  if (!idem.acquired) {
    if (idem.outcome === "replay") {
      const cached = idem.response as SyncPaymentResult | { skipped?: boolean } | null;
      if (cached && "data" in cached && cached.data?.id) {
        await applyLocalUpdate(params.supabase, paymentId, cached as SyncPaymentResult);
      }
      return idem.response;
    }
    throw new ParasutInProgressError(`Payment sync for ${paymentId} is already in progress`);
  }

  let remoteSucceeded = false;

  try {
    const { data: payment, error } = await params.supabase
      .from("financial_transaction_payments")
      .select("*, financial_transactions(parasut_invoice_id)")
      .eq("id", paymentId)
      .single();
    if (error) throw error;

    const invoiceId = payment.financial_transactions?.parasut_invoice_id;
    if (!invoiceId) {
      const skipped = { skipped: true, reason: "parent_invoice_not_synced" };
      await finishIdempotency(params.supabase, key, "succeeded", skipped);
      return skipped;
    }
    if (payment.parasut_payment_id) {
      const skipped = { skipped: true, payment_id: payment.parasut_payment_id };
      await finishIdempotency(params.supabase, key, "succeeded", skipped);
      return skipped;
    }

    const result = await parasutRequest(params.supabase, {
      path: `/sales_invoices/${invoiceId}/payments`,
      method: "POST",
      operation: "sync_payment",
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: paymentId,
      idempotencyKey: key,
      body: {
        data: {
          type: "payments",
          attributes: {
            date: payment.paid_date,
            amount: Number(payment.amount ?? payment.amount_try ?? 0),
          },
        },
      },
    }) as SyncPaymentResult;

    remoteSucceeded = true;
    await finishIdempotency(params.supabase, key, "succeeded", result);

    try {
      await applyLocalUpdate(params.supabase, paymentId, result);
    } catch (updateError) {
      throw new ParasutValidationError(
        `Paraşüt payment ${result.data?.id ?? "?"} was created but the local record update failed — retrying ` +
          `this call is safe, it will repair the record without creating a duplicate payment. Original error: ` +
          `${updateError instanceof Error ? updateError.message : String(updateError)}`,
        500,
      );
    }

    return result;
  } catch (error) {
    if (!remoteSucceeded) {
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
