import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ParasutRateLimitError, ParasutValidationError } from "./errors.ts";
import { auditLog } from "./logger.ts";
import { getValidToken } from "./oauth-store.ts";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  operation: string;
  correlationId: string;
  actorId?: string | null;
  erpRecordId?: string | null;
  idempotencyKey?: string | null;
  /** Set false for user-scoped endpoints like /me that don't take a {company_id} prefix. Defaults to true. */
  companyScoped?: boolean;
};

const RATE_WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 8;
let windowStartedAt = 0;
let requestCount = 0;

function baseUrl(): string {
  return (Deno.env.get("PARASUT_BASE_URL") ?? "https://api.parasut.com/v4").replace(/\/$/, "");
}

function companyId(): string {
  const value = Deno.env.get("PARASUT_COMPANY_ID");
  if (!value) throw new ParasutValidationError("Missing PARASUT_COMPANY_ID", 500);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveRateSlot(): Promise<void> {
  const now = Date.now();
  if (!windowStartedAt || now - windowStartedAt >= RATE_WINDOW_MS) {
    windowStartedAt = now;
    requestCount = 0;
  }

  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    await sleep(RATE_WINDOW_MS - (now - windowStartedAt) + 25);
    windowStartedAt = Date.now();
    requestCount = 0;
  }
  requestCount += 1;
}

function expandPath(path: string, companyScoped: boolean): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return companyScoped ? `${baseUrl()}/${companyId()}${suffix}` : `${baseUrl()}${suffix}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function parasutRequest(
  supabase: SupabaseClient,
  options: RequestOptions,
): Promise<unknown> {
  let lastPayload: unknown = null;
  const method = options.method ?? "GET";
  const url = expandPath(options.path, options.companyScoped ?? true);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await reserveRateSlot();
    const started = Date.now();
    const token = await getValidToken(supabase);
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await parseResponse(response);
    lastPayload = payload;
    await auditLog(supabase, {
      correlationId: options.correlationId,
      operation: options.operation,
      actorId: options.actorId,
      erpRecordId: options.erpRecordId,
      idempotencyKey: options.idempotencyKey,
      httpMethod: method,
      endpoint: options.path,
      httpStatus: response.status,
      durationMs: Date.now() - started,
      requestBody: options.body,
      responseBody: payload,
      errorMessage: response.ok ? null : `Paraşüt HTTP ${response.status}`,
    });

    if (response.ok) return payload;

    // 429 is always safe to retry — Paraşüt's rate limiter rejects before
    // doing any work, so nothing could have happened server-side. A 5xx on
    // a non-idempotent method (POST/PATCH/DELETE) is ambiguous — Paraşüt
    // may have created/mutated the resource before the error occurred, so
    // blindly retrying risks a duplicate (e.g. two sales_invoices drafts
    // for one prepare-invoice call). Only auto-retry 5xx for GET, which
    // has no side effects to duplicate. Confirmed bug, independent audit
    // 2026-07-23 — the caller's idempotency layer (idempotency.ts) is
    // responsible for safe retries of non-GET calls, not this client.
    const isRetryable = response.status === 429 || (response.status >= 500 && method === "GET");
    if (isRetryable) {
      await sleep((2 ** attempt) * 750 + Math.floor(Math.random() * 250));
      continue;
    }

    throw new ParasutValidationError(`Paraşüt HTTP ${response.status}`, response.status, payload);
  }

  throw new ParasutRateLimitError("Paraşüt request failed after retries", 502, lastPayload);
}
