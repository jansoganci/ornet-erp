import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuditPayload = {
  correlationId: string;
  operation: string;
  erpRecordId?: string | null;
  parasutId?: string | null;
  idempotencyKey?: string | null;
  httpMethod?: string | null;
  endpoint?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  requestBody?: unknown;
  responseBody?: unknown;
  errorMessage?: string | null;
  actorId?: string | null;
  jobStatus?: string | null;
};

function reportParasutTelemetry(payload: {
  operation: string;
  httpStatus?: number | null;
  jobStatus?: string | null;
}): void {
  console.info("[parasut telemetry]", {
    "parasut.operation": payload.operation,
    "parasut.http_status": payload.httpStatus ?? null,
    "parasut.job_status": payload.jobStatus ?? null,
  });
}

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);

  const redactedKeys = new Set([
    "access_token",
    "refresh_token",
    "authorization",
    "client_secret",
    "password",
  ]);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      redactedKeys.has(key.toLowerCase()) ? "[redacted]" : sanitize(entry),
    ]),
  );
}

export async function auditLog(
  supabase: SupabaseClient,
  payload: AuditPayload,
): Promise<void> {
  reportParasutTelemetry({
    operation: payload.operation,
    httpStatus: payload.httpStatus,
    jobStatus: payload.jobStatus,
  });

  const row = {
    correlation_id: payload.correlationId,
    operation: payload.operation,
    erp_record_id: payload.erpRecordId ?? null,
    parasut_id: payload.parasutId ?? null,
    idempotency_key: payload.idempotencyKey ?? null,
    http_method: payload.httpMethod ?? null,
    endpoint: payload.endpoint ?? null,
    http_status: payload.httpStatus ?? null,
    duration_ms: payload.durationMs ?? null,
    request_body: sanitize(payload.requestBody) ?? null,
    response_body: sanitize(payload.responseBody) ?? null,
    error_message: payload.errorMessage ?? null,
    actor_id: payload.actorId ?? null,
  };

  const { error } = await supabase.from("parasut_audit_log").insert(row);
  if (error) {
    console.error("[parasut] audit log insert failed", error.message);
  }
}
