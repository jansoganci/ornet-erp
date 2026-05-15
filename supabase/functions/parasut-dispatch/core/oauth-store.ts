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
  const { data, error } = await supabase
    .from("parasut_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new ParasutAuthError(error.message, 500, error);
  if (isValid(data)) return data.access_token;

  const clientId = requireEnv("PARASUT_CLIENT_ID");
  const clientSecret = requireEnv("PARASUT_CLIENT_SECRET");

  if (data?.refresh_token) {
    const token = await requestToken({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
    });
    return persistToken(supabase, token, data.refresh_token);
  }

  const token = await requestToken({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username: requireEnv("PARASUT_USERNAME"),
    password: requireEnv("PARASUT_PASSWORD"),
  });
  return persistToken(supabase, token);
}
