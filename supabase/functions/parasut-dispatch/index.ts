import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ParasutError, toErrorMessage } from "./core/errors.ts";
import { auditLog } from "./core/logger.ts";
import { bulkMatch } from "./handlers/bulk-match.ts";
import { cancelDraft } from "./handlers/cancel-draft.ts";
import { createContact } from "./handlers/create-contact.ts";
import { deletePayment } from "./handlers/delete-payment.ts";
import { fetchHistory } from "./handlers/fetch-history.ts";
import { finalizeInvoice } from "./handlers/finalize-invoice.ts";
import { ping } from "./handlers/ping.ts";
import { prepareInvoice } from "./handlers/prepare-invoice.ts";
import { syncPayment } from "./handlers/sync-payment.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DispatchBody = {
  action?: string;
  payload?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function getActorId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error) return null;
  return data.user?.id ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  const correlationId = crypto.randomUUID();
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const actorId = await getActorId(supabase, req);

  try {
    const body = (await req.json().catch(() => ({}))) as DispatchBody;
    const action = body.action;

    let data: unknown;
    switch (action) {
      case "ping":
        data = await ping({ supabase, correlationId, actorId });
        break;
      case "bulk-match":
        data = await bulkMatch({ supabase, correlationId, actorId });
        break;
      case "create-contact":
        data = await createContact({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "prepare-invoice":
        data = await prepareInvoice({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "finalize-invoice":
        data = await finalizeInvoice({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "cancel-draft":
        data = await cancelDraft({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "sync-payment":
        data = await syncPayment({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "delete-payment":
        data = await deletePayment({ supabase, correlationId, actorId, payload: body.payload });
        break;
      case "fetch-history":
        data = await fetchHistory({ supabase, correlationId, actorId, payload: body.payload });
        break;
      default:
        throw new ParasutError("Unsupported Paraşüt action", 400, { action });
    }

    return jsonResponse({ ok: true, correlationId, data });
  } catch (error) {
    const status = error instanceof ParasutError ? error.status : 500;
    const message = toErrorMessage(error);

    await auditLog(supabase, {
      correlationId,
      operation: "dispatch_error",
      actorId,
      httpStatus: status,
      errorMessage: message,
      responseBody: error instanceof ParasutError ? error.details : null,
    });

    return jsonResponse({ ok: false, correlationId, error: message }, status);
  }
});
