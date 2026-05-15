import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { parasutRequest } from "../core/parasut-client.ts";

export async function syncPayment(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const paymentId = String(params.payload?.financial_transaction_payment_id ?? "");
  if (!paymentId) throw new ParasutValidationError("financial_transaction_payment_id is required", 400);

  const { data: payment, error } = await params.supabase
    .from("financial_transaction_payments")
    .select("*, financial_transactions(parasut_invoice_id)")
    .eq("id", paymentId)
    .single();

  if (error) throw error;
  const invoiceId = payment.financial_transactions?.parasut_invoice_id;
  if (!invoiceId) return { skipped: true, reason: "parent_invoice_not_synced" };
  if (payment.parasut_payment_id) return { skipped: true, payment_id: payment.parasut_payment_id };

  const result = await parasutRequest(params.supabase, {
    path: `/sales_invoices/${invoiceId}/payments`,
    method: "POST",
    operation: "sync_payment",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: paymentId,
    body: {
      data: {
        type: "payments",
        attributes: {
          date: payment.paid_date,
          amount: Number(payment.amount ?? payment.amount_try ?? 0),
        },
      },
    },
  }) as { data?: { id?: string; relationships?: { transaction?: { data?: { id?: string } } } } };

  const { error: updateError } = await params.supabase
    .from("financial_transaction_payments")
    .update({
      parasut_payment_id: result.data?.id ?? null,
      parasut_transaction_id: result.data?.relationships?.transaction?.data?.id ?? null,
      parasut_synced_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (updateError) throw updateError;
  return result;
}
