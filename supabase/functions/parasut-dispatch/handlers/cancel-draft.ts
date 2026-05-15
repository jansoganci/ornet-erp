import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { parasutRequest } from "../core/parasut-client.ts";

export async function cancelDraft(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const id = String(params.payload?.financial_transaction_id ?? "");
  if (!id) throw new ParasutValidationError("financial_transaction_id is required", 400);

  const { data: tx, error } = await params.supabase
    .from("financial_transactions")
    .select("parasut_invoice_id, parasut_sync_status")
    .eq("id", id)
    .single();

  if (error) throw error;
  if (tx.parasut_sync_status !== "draft" || !tx.parasut_invoice_id) {
    throw new ParasutValidationError("Only draft invoices can be cancelled", 400);
  }

  const result = await parasutRequest(params.supabase, {
    path: `/sales_invoices/${tx.parasut_invoice_id}`,
    method: "DELETE",
    operation: "cancel_draft",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: id,
  });

  const { error: updateError } = await params.supabase
    .from("financial_transactions")
    .update({
      parasut_invoice_id: null,
      parasut_sync_status: "ready",
      parasut_error: null,
    })
    .eq("id", id);

  if (updateError) throw updateError;
  return result;
}
