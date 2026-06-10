/**
 * fetch-tcmb-rates — TCMB USD rates → exchange_rates
 *
 * Auth (A8, verify_jwt = false at gateway):
 *   - pg_cron: header x-cron-secret = Edge CRON_SECRET (Vault edge_cron_secret)
 *   - Browser: session JWT + profiles.role in (admin, accountant)
 *
 * Schedule: pg_cron fetch-tcmb-rates-daily at 03:00 UTC (see 00228)
 * Manual refresh: dashboard CurrencyWidget (canWrite) or /finance/exchange
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertCronOrFinanceRole } from "../_shared/cronAuth.ts";

const TCMB_XML_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchTcmbXml(): Promise<{ buyRate: number; sellRate: number; date: string } | null> {
  const response = await fetch(TCMB_XML_URL);
  if (!response.ok) return null;

  const xmlText = await response.text();

  const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<\/Currency>/);
  if (!usdMatch) return null;

  const buyMatch = usdMatch[0].match(/<BanknoteBuying>([\d.,]+)<\/BanknoteBuying>/);
  const sellMatch = usdMatch[0].match(/<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/);
  if (!buyMatch || !sellMatch) return null;

  const buyRate = parseFloat(buyMatch[1].replace(",", "."));
  const sellRate = parseFloat(sellMatch[1].replace(",", "."));

  if (Number.isNaN(buyRate) || Number.isNaN(sellRate)) return null;

  const dateMatch = xmlText.match(/Date="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (!dateMatch) return null;

  const [, month, day, year] = dateMatch;
  const date = `${year}-${month}-${day}`;

  return { buyRate, sellRate, date };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const authFailure = await assertCronOrFinanceRole(req, supabase);
  if (authFailure) {
    return new Response(authFailure.body, {
      status: authFailure.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const result = await fetchTcmbXml();
  if (!result) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Could not fetch from TCMB XML (check weekend/holiday)",
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const { buyRate, sellRate, date } = result;

  const rows = [
    {
      currency: "USD",
      buy_rate: buyRate,
      sell_rate: sellRate,
      effective_rate: buyRate,
      rate_date: date,
      source: "TCMB",
    },
  ];

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, {
      onConflict: "currency,rate_date",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("[fetch-tcmb-rates] upsert error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, count: rows.length, date }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
