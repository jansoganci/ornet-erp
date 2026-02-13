#!/usr/bin/env node
/**
 * TCMB XML Feed - Fetch USD ForexSelling from today.xml, upsert to Supabase
 * No API key. Public endpoint. Fallback if Edge Function unavailable.
 *
 * Usage:
 *   node scripts/fetch-tcmb-rates.mjs
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Cron (6 AM Turkey = 3 AM UTC):
 *   0 3 * * * cd /path/to/ornet-erp && node scripts/fetch-tcmb-rates.mjs
 */

const TCMB_XML_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

async function fetchTcmbXml() {
  const res = await fetch(TCMB_XML_URL);
  if (!res.ok) throw new Error(`TCMB XML ${res.status}: ${await res.text()}`);

  const xmlText = await res.text();

  const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<\/Currency>/);
  if (!usdMatch) throw new Error("No USD in TCMB XML");

  const sellingMatch = usdMatch[0].match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/);
  if (!sellingMatch) throw new Error("No ForexSelling in USD");

  const rate = parseFloat(sellingMatch[1].replace(",", "."));
  if (Number.isNaN(rate)) throw new Error("Invalid rate");

  const dateMatch = xmlText.match(/Date="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (!dateMatch) throw new Error("No date in TCMB XML");

  const [, month, day, year] = dateMatch;
  const date = `${year}-${month}-${day}`;

  return { rate, date };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { rate, date } = await fetchTcmbXml();

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey);

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(
      [
        {
          currency: "USD",
          buy_rate: null,
          sell_rate: rate,
          effective_rate: rate,
          rate_date: date,
          source: "TCMB",
        },
      ],
      { onConflict: "currency,rate_date" }
    );

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  console.log(`OK: USD rate ${rate} saved for ${date}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
