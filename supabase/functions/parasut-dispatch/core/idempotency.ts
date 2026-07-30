import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type IdempotencyResult =
  | { acquired: true; key: string }
  | { acquired: false; key: string; outcome: "replay"; response: unknown }
  | { acquired: false; key: string; outcome: "in_progress" };

// A "started" row older than this with no matching finishIdempotency() call
// is assumed to be a crashed/timed-out invocation, not a live in-flight one,
// and becomes eligible for re-acquisition (same as a "failed" row).
const STALE_STARTED_MS = 5 * 60 * 1000;

export function invoiceKey(financialTransactionId: string): string {
  return `invoice:financial_tx:${financialTransactionId}:v1`;
}

export function finalizeKey(financialTransactionId: string): string {
  return `finalize:financial_tx:${financialTransactionId}:v1`;
}

export function paymentKey(financialTransactionPaymentId: string): string {
  return `payment:financial_tx_payment:${financialTransactionPaymentId}:v1`;
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

  // Insert conflicted: a row for this key already exists. Figure out
  // whether it's a valid cache hit, re-acquirable, or genuinely in flight.
  const { data: existing, error: fetchError } = await supabase
    .from("parasut_idempotency")
    .select("status, response_snapshot")
    .eq("key", key)
    .single();

  if (fetchError) throw fetchError;

  if (existing.status === "succeeded") {
    return { acquired: false, key, outcome: "replay", response: existing.response_snapshot };
  }

  // "failed" rows are always re-acquirable. "started" rows only become
  // re-acquirable once stale (a crashed invocation that never reached
  // finishIdempotency). Both the eligibility check and the write happen in
  // one conditional UPDATE so two concurrent callers can't both believe
  // they re-acquired the same key — only one UPDATE can match+affect the row.
  //
  // Uses updated_at, not created_at: created_at never changes once the row
  // exists, so a prior re-acquisition (which bumps updated_at via the
  // table's own trigger but leaves created_at untouched) would otherwise
  // still look "old enough" to a second caller evaluating the same
  // condition — letting two concurrent callers both re-acquire the same
  // stale key and both call Paraşüt. (Confirmed bug from independent
  // audit, 2026-07-23.)
  const staleThreshold = new Date(Date.now() - STALE_STARTED_MS).toISOString();
  const { data: reacquired, error: reacquireError } = await supabase
    .from("parasut_idempotency")
    .update({ status: "started", response_snapshot: null, error_message: null })
    .eq("key", key)
    .or(`status.eq.failed,and(status.eq.started,updated_at.lt.${staleThreshold})`)
    .select("key")
    .maybeSingle();

  if (reacquireError) throw reacquireError;
  if (reacquired) return { acquired: true, key };

  // Row is "started" and not stale (a live concurrent call), or another
  // caller won the re-acquire race between our read and this write — either
  // way, this is not a replay and not our turn to act.
  return { acquired: false, key, outcome: "in_progress" };
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
