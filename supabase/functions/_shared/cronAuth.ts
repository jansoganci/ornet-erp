/**
 * Shared auth helpers for cron-invoked Edge Functions.
 * Requires CRON_SECRET in Edge Function secrets and matching header on the request.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET_HEADER = "x-cron-secret";
const FINANCE_WRITE_ROLES = ["admin", "accountant"] as const;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractProvidedSecret(req: Request): string | null {
  const header = req.headers.get(CRON_SECRET_HEADER);
  if (header) return header;

  const auth = req.headers.get("Authorization");
  if (auth?.match(/^Bearer\s+/i)) {
    return auth.replace(/^Bearer\s+/i, "");
  }
  return null;
}

/** Returns 401/503 Response when not authorized; null when OK. */
export function assertCronAuthorized(req: Request): Response | null {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return json({ ok: false, error: "Server misconfigured" }, 503);
  }

  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  return null;
}

function getCronSecretExpected(): string | null {
  const expected = Deno.env.get("CRON_SECRET");
  return expected && expected.length > 0 ? expected : null;
}

/** Cron path: x-cron-secret header only (no Bearer-as-secret). Returns true when valid. */
export function isCronSecretHeaderValid(req: Request): boolean {
  const expected = getCronSecretExpected();
  if (!expected) return false;

  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;

  return timingSafeEqual(provided, expected);
}

function extractBearerJwt(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.match(/^Bearer\s+/i)) return null;
  return auth.replace(/^Bearer\s+/i, "");
}

async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data?.role ?? null;
}

/**
 * Dual auth for fetch-tcmb-rates (A8): pg_cron secret OR admin/accountant JWT.
 * Returns 401/403/503 Response when denied; null when OK.
 */
export async function assertCronOrFinanceRole(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response | null> {
  if (isCronSecretHeaderValid(req)) {
    return null;
  }

  const expected = getCronSecretExpected();
  if (!expected) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return json({ ok: false, error: "Server misconfigured" }, 503);
  }

  const jwt = extractBearerJwt(req);
  if (!jwt) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user?.id) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const role = await getUserRole(supabase, data.user.id);
  if (!role || !FINANCE_WRITE_ROLES.includes(role as typeof FINANCE_WRITE_ROLES[number])) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  return null;
}
