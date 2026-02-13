// TCMB XML Feed - Fetch USD ForexSelling from today.xml, store in exchange_rates
// No API key, no auth. Public endpoint, works from Supabase Edge.
// Runs via pg_cron daily at 06:00 Turkey / 03:00 UTC, or manually from frontend

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TCMB_XML_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchTcmbXml(): Promise<{ rate: number; date: string } | null> {
  const response = await fetch(TCMB_XML_URL);
  if (!response.ok) return null;

  const xmlText = await response.text();

  // Find USD Currency section
  const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<\/Currency>/);
  if (!usdMatch) return null;

  // Extract ForexSelling (efektif satış)
  const sellingMatch = usdMatch[0].match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/);
  if (!sellingMatch) return null;

  const rate = parseFloat(sellingMatch[1].replace(",", "."));
  if (Number.isNaN(rate)) return null;

  // Extract date: Date="02/12/2026" (MM/DD/YYYY)
  const dateMatch = xmlText.match(/Date="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (!dateMatch) return null;

  const [, month, day, year] = dateMatch;
  const date = `${year}-${month}-${day}`; // YYYY-MM-DD

  return { rate, date };
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const result = await fetchTcmbXml();
  if (!result) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Could not fetch from TCMB XML (check weekend/holiday)",
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { rate, date } = result;

  const rows = [
    {
      currency: "USD",
      buy_rate: null,
      sell_rate: rate,
      effective_rate: rate,
      rate_date: date,
      source: "TCMB",
    },
  ];

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, {
      onConflict: "currency,rate_date",
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error("Supabase upsert error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      count: rows.length,
      date,
      rates: rows,
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
