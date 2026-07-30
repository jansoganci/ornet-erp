import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ParasutAuthError } from "./errors.ts";

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new ParasutAuthError(`Missing ${name}`, 500);
  return value;
}

function isValid(row: TokenRow | null): row is TokenRow & { access_token: string } {
  if (!row?.access_token || !row.expires_at) return false;
  return new Date(row.expires_at).getTime() - Date.now() > 60_000;
}

// Single-flight lock for token refresh: two concurrent invocations both
// seeing an expired token must not both call Paraşüt's refresh_token grant
// with the same (about-to-rotate) refresh token. The refresh_lock_until/
// refresh_locked_by columns exist since migration 00216 but were never
// read/written until now.
const REFRESH_LOCK_MS = 30_000;
const LOCK_POLL_INTERVAL_MS = 500;
// Poll for roughly as long as the lock can be held (plus a small buffer),
// not a fixed short window — otherwise a non-holder gives up and refreshes
// unprotected while the real holder's 30s lock is still valid, defeating
// the lock entirely. Confirmed bug, independent audit 2026-07-23 (was
// polling only ~3s against a 30s lock).
const LOCK_POLL_TOTAL_MS = REFRESH_LOCK_MS + 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readToken(supabase: SupabaseClient): Promise<TokenRow | null> {
  const { data, error } = await supabase
    .from("parasut_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new ParasutAuthError(error.message, 500, error);
  return data;
}

async function tryAcquireRefreshLock(supabase: SupabaseClient, lockedBy: string): Promise<boolean> {
  const now = new Date().toISOString();
  const lockUntil = new Date(Date.now() + REFRESH_LOCK_MS).toISOString();

  const { data, error } = await supabase
    .from("parasut_oauth_tokens")
    .update({ refresh_lock_until: lockUntil, refresh_locked_by: lockedBy })
    .eq("id", 1)
    .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${now}`)
    .select("id")
    .maybeSingle();

  if (error) throw new ParasutAuthError(error.message, 500, error);
  return Boolean(data);
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const oauthUrl = requireEnv("PARASUT_OAUTH_URL");
  const body = new URLSearchParams(params);
  const response = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) {
    throw new ParasutAuthError("Paraşüt OAuth token request failed", response.status, json);
  }
  return json as TokenResponse;
}

async function persistToken(
  supabase: SupabaseClient,
  token: TokenResponse,
  fallbackRefreshToken?: string | null,
): Promise<string> {
  const expiresIn = Number(token.expires_in ?? 7200);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase.from("parasut_oauth_tokens").upsert({
    id: 1,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? fallbackRefreshToken ?? null,
    token_type: token.token_type ?? "Bearer",
    expires_at: expiresAt,
    refresh_lock_until: null,
    refresh_locked_by: null,
    last_refreshed_at: new Date().toISOString(),
  });

  if (error) throw new ParasutAuthError(error.message, 500, error);
  return token.access_token;
}

export async function getValidToken(supabase: SupabaseClient): Promise<string> {
  const data = await readToken(supabase);
  if (isValid(data)) return data.access_token;

  const lockedBy = crypto.randomUUID();
  let gotLock = await tryAcquireRefreshLock(supabase, lockedBy);

  if (!gotLock) {
    // Another invocation is refreshing right now. Poll for it to finish —
    // and periodically retry acquiring the lock ourselves, so that once the
    // holder's lock naturally expires (crashed mid-refresh) we take it over
    // properly instead of just proceeding unlocked once our poll window runs out.
    const deadline = Date.now() + LOCK_POLL_TOTAL_MS;
    while (Date.now() < deadline) {
      await sleep(LOCK_POLL_INTERVAL_MS);
      const latest = await readToken(supabase);
      if (isValid(latest)) return latest.access_token;

      gotLock = await tryAcquireRefreshLock(supabase, lockedBy);
      if (gotLock) break;
    }
    // Either we now hold the lock (gotLock=true, took over from a crashed
    // holder) or we genuinely timed out waiting — either way, fall through
    // and refresh. persistToken() always clears the lock on success, so
    // this stays self-healing regardless of which path got us here.
  }

  const clientId = requireEnv("PARASUT_CLIENT_ID");
  const clientSecret = requireEnv("PARASUT_CLIENT_SECRET");
  const current = await readToken(supabase);

  if (current?.refresh_token) {
    const token = await requestToken({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: current.refresh_token,
    });
    return persistToken(supabase, token, current.refresh_token);
  }

  // No refresh_token on record (first-ever token, or it was somehow lost) —
  // password grant is the deliberate self-heal path; never remove
  // PARASUT_USERNAME/PARASUT_PASSWORD secrets (roadmap Appendix A.7).
  const token = await requestToken({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username: requireEnv("PARASUT_USERNAME"),
    password: requireEnv("PARASUT_PASSWORD"),
  });
  return persistToken(supabase, token);
}
