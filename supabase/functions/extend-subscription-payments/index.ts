/**
 * extend-subscription-payments
 *
 * Supabase Edge Function — scheduled monthly roller.
 * Calls extend_active_subscription_payments() in the database.
 *
 * Schedule: 02:00 UTC on the 1st of every month (Supabase Dashboard cron)
 * Cron expression: 0 2 1 * *
 *
 * Auth: CRON_SECRET Edge secret + request header x-cron-secret (or Bearer token).
 * verify_jwt = false in config.toml — gateway does not validate JWT; this handler does.
 *
 * Deploy checklist (A5):
 * 1. Set Edge secret CRON_SECRET (same value used by cron caller).
 * 2. Deploy function + config.toml.
 * 3. Dashboard → Cron → extend-subscription-payments job → HTTP headers:
 *    x-cron-secret: <CRON_SECRET>
 *    (Do not rely on anon_key alone after this change.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertCronAuthorized } from "../_shared/cronAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = new Date().toISOString();

  const authFailure = assertCronAuthorized(req);
  if (authFailure) return authFailure;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc(
      "extend_active_subscription_payments",
    );

    if (error) {
      console.error("[extend-subscription-payments] DB error:", error.message);
      return new Response(
        JSON.stringify({ ok: false, error: error.message, startedAt }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const created = Array.isArray(data) ? data : [];
    const rowsCreated = created.length;

    console.log(
      `[extend-subscription-payments] ${startedAt} — ${rowsCreated} payment row(s) created`,
    );

    return new Response(
      JSON.stringify({ ok: true, startedAt, rowsCreated }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extend-subscription-payments] Unexpected error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message, startedAt }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
