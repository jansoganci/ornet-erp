import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { parasutRequest } from "../core/parasut-client.ts";

export async function deletePayment(params: {
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
    .select("parasut_transaction_id")
    .eq("id", paymentId)
    .single();

  if (error) throw error;
  if (!payment.parasut_transaction_id) return { skipped: true, reason: "not_synced" };

  const result = await parasutRequest(params.supabase, {
    path: `/transactions/${payment.parasut_transaction_id}`,
    method: "DELETE",
    operation: "delete_payment",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: paymentId,
  });

  const { error: updateError } = await params.supabase
    .from("financial_transaction_payments")
    .update({
      parasut_payment_id: null,
      parasut_transaction_id: null,
      parasut_synced_at: null,
    })
    .eq("id", paymentId);

  if (updateError) throw updateError;
  return result;
}
