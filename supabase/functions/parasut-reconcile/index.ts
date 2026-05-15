import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parasutRequest } from "../parasut-dispatch/core/parasut-client.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SalesInvoiceRecord = {
  attributes?: {
    gross_total?: number | string;
    net_total?: number | string;
    total_vat?: number | string;
  };
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

function yesterdayIso(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function invoiceGrossTotal(invoice: SalesInvoiceRecord): number {
  const attributes = invoice.attributes ?? {};
  const grossTotal = asNumber(attributes.gross_total);
  if (grossTotal > 0) return grossTotal;
  return asNumber(attributes.net_total) + asNumber(attributes.total_vat);
}

function totalsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const correlationId = crypto.randomUUID();
  const issueDate = yesterdayIso();

  const { data: erpRows, error } = await supabase
    .from("financial_transactions")
    .select("amount_try, output_vat")
    .eq("parasut_sync_status", "confirmed")
    .eq("transaction_date", issueDate);

  if (error) return jsonResponse({ ok: false, error: error.message }, 500);

  const erpCount = erpRows?.length ?? 0;
  const erpSum = (erpRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount_try || 0) + Number(row.output_vat || 0),
    0,
  );

  let parasutCount = 0;
  let parasutSum = 0;
  let parasutError: string | null = null;

  try {
    const parasutResponse = await parasutRequest(supabase, {
      path: `/sales_invoices?filter[issue_date]=${encodeURIComponent(issueDate)}&include=payments`,
      operation: "reconcile",
      correlationId,
    }) as { data?: SalesInvoiceRecord[] };

    const invoices = parasutResponse?.data ?? [];
    parasutCount = invoices.length;
    parasutSum = invoices.reduce((sum, invoice) => sum + invoiceGrossTotal(invoice), 0);
  } catch (reconcileError) {
    parasutError = reconcileError instanceof Error ? reconcileError.message : String(reconcileError);
  }

  const match = !parasutError
    && erpCount === parasutCount
    && totalsMatch(erpSum, parasutSum);

  const errorMessage = parasutError
    ?? (match
      ? null
      : `ERP/Parasut mismatch for ${issueDate}: erp count=${erpCount} sum=${erpSum.toFixed(2)}; parasut count=${parasutCount} sum=${parasutSum.toFixed(2)}`);

  await supabase.from("parasut_audit_log").insert({
    correlation_id: correlationId,
    operation: "reconcile",
    request_body: { issueDate },
    response_body: {
      erp: { count: erpCount, sum: erpSum },
      parasut: { count: parasutCount, sum: parasutSum },
      match,
    },
    error_message: errorMessage,
  });

  return jsonResponse({
    ok: true,
    correlationId,
    issueDate,
    erp: { count: erpCount, sum: erpSum },
    parasut: { count: parasutCount, sum: parasutSum },
    match,
  });
});
