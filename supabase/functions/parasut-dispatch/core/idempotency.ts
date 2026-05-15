import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type IdempotencyResult =
  | { acquired: true; key: string }
  | { acquired: false; key: string; response: unknown; status: string };

export function invoiceKey(financialTransactionId: string): string {
  return `invoice:financial_tx:${financialTransactionId}:v1`;
}

export async function acquireIdempotency(
  supabase: SupabaseClient,
  key: string,
  operationType: string,
  erpRecordId: string,
): Promise<IdempotencyResult> {
  const { data, error } = await supabase
    .from("parasut_idempotency")
    .insert({ key, operation_type: operationType, erp_record_id: erpRecordId, status: "started" })
    .select("key")
    .single();

  if (!error && data) return { acquired: true, key };

  const { data: existing, error: fetchError } = await supabase
    .from("parasut_idempotency")
    .select("status, response_snapshot")
    .eq("key", key)
    .single();

  if (fetchError) throw fetchError;
  return {
    acquired: false,
    key,
    status: existing.status,
    response: existing.response_snapshot,
  };
}

export async function finishIdempotency(
  supabase: SupabaseClient,
  key: string,
  status: "succeeded" | "failed",
  response: unknown,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from("parasut_idempotency")
    .update({
      status,
      response_snapshot: response ?? null,
      error_message: errorMessage ?? null,
    })
    .eq("key", key);

  if (error) throw error;
}
