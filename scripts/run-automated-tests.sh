#!/usr/bin/env bash
# Run automated tests from docs/TEST-SCENARIOS.md
# Requires: SUPABASE_URL, ANON_KEY, USER_JWT (admin), TECH_JWT, SUBSCRIPTION_ID, PROPOSAL_ID (TRY)
# Optional: Load from .env.local (VITE_SUPABASE_URL → SUPABASE_URL, etc.)

set -e

# Load .env.local if present
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
  export SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}"
  export ANON_KEY="${ANON_KEY:-$VITE_SUPABASE_ANON_KEY}"
fi

# Validate required vars
for var in SUPABASE_URL ANON_KEY; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing $var. Set it or add to .env.local"
    exit 1
  fi
done

PASS=0
FAIL=0
SKIP=0

run_test() {
  local id="$1"
  local name="$2"
  local cmd="$3"
  local expect="$4"
  local actual
  actual=$(eval "$cmd" 2>/dev/null || echo "ERROR")
  if [[ "$actual" == *"$expect"* ]] || [[ "$expect" == *"$actual"* ]]; then
    echo "✅ $id — $name"
    ((PASS++)) || true
    return 0
  else
    echo "❌ $id — $name (expected: $expect, got: ${actual:0:80}...)"
    ((FAIL++)) || true
    return 1
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Automated Tests — Ornet ERP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# RLS-01 — Anon cannot read finance
res=$(curl -s -X GET \
  "$SUPABASE_URL/rest/v1/financial_transactions?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json")
if [ "$res" = "[]" ]; then
  echo "✅ RLS-01 — Anon key cannot read finance data"
  ((PASS++)) || true
else
  echo "❌ RLS-01 — Anon key cannot read finance data (got: ${res:0:60}...)"
  ((FAIL++)) || true
fi

# RLS-02 — Technician cannot read finance
if [ -n "$TECH_JWT" ]; then
  res=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/financial_transactions?select=id&limit=5" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TECH_JWT" \
    -H "Content-Type: application/json")
  if [ "$res" = "[]" ]; then
    echo "✅ RLS-02 — Technician cannot read finance data"
    ((PASS++)) || true
  else
    echo "❌ RLS-02 — Technician cannot read finance data"
    ((FAIL++)) || true
  fi
else
  echo "⏭️  RLS-02 — Skipped (TECH_JWT not set)"
  ((SKIP++)) || true
fi

# RLS-03 — Profiles: all authenticated can read (accepted — known behavior)
if [ -n "$USER_JWT" ]; then
  len=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/profiles?select=id,full_name,role" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" | jq 'length')
  if [ -n "$len" ] && [ "$len" -ge 1 ] 2>/dev/null; then
    echo "✅ RLS-03 — Profiles readable (accepted: all authenticated)"
    ((PASS++)) || true
  else
    echo "❌ RLS-03 — Profiles not readable (got $len rows)"
    ((FAIL++)) || true
  fi
else
  echo "⏭️  RLS-03 — Skipped (USER_JWT not set)"
  ((SKIP++)) || true
fi

# PR-C3 — TRY proposal item saves unit_price_usd as null
# Auto-fetch PROPOSAL_ID if not set (get first TRY proposal)
if [ -n "$USER_JWT" ] && [ -z "$PROPOSAL_ID" ]; then
  PROPOSAL_ID=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/proposals?currency=eq.TRY&select=id&limit=1" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" | jq -r '.[0].id // empty')
fi
if [ -n "$USER_JWT" ] && [ -n "$PROPOSAL_ID" ]; then
  res=$(curl -s -w "\n%{http_code}" -X POST \
    "$SUPABASE_URL/rest/v1/proposal_items" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{
      "proposal_id": "'"$PROPOSAL_ID"'",
      "description": "Test kalemi PR-C3",
      "quantity": 1,
      "unit": "adet",
      "unit_price": 500,
      "unit_price_usd": null,
      "cost_usd": null
    }')
  code=$(echo "$res" | tail -1)
  body=$(echo "$res" | sed '$d')
  usd=$(echo "$body" | jq -r 'if .[0].unit_price_usd == null then "null" else "has_value" end')
  if [ "$code" = "201" ] && [ "$usd" = "null" ]; then
    echo "✅ PR-C3 — TRY proposal item saves unit_price_usd as null"
    ((PASS++)) || true
  else
    echo "❌ PR-C3 — TRY proposal item (code=$code, unit_price_usd=$usd)"
    ((FAIL++)) || true
  fi
else
  if [ -z "$USER_JWT" ]; then
    echo "⏭️  PR-C3 — Skipped (USER_JWT not set)"
  else
    echo "⏭️  PR-C3 — Skipped (no TRY proposal found; add PROPOSAL_ID to .env.local)"
  fi
  ((SKIP++)) || true
fi

# MA-C1-API — Materials reject malformed body
if [ -n "$USER_JWT" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$SUPABASE_URL/rest/v1/materials" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" \
    -d '{}')
  if [ "$code" = "400" ] || [ "$code" = "422" ]; then
    echo "✅ MA-C1-API — Materials reject empty body (HTTP $code)"
    ((PASS++)) || true
  else
    echo "❌ MA-C1-API — Materials reject empty body (expected 400/422, got $code)"
    ((FAIL++)) || true
  fi
else
  echo "⏭️  MA-C1-API — Skipped (USER_JWT not set)"
  ((SKIP++)) || true
fi

# SB-C2 — Payment recording returns subscription_id (run first; records a payment)
# fn_record_payment requires p_payment_id (not p_subscription_id); fetch pending payment first
if [ -n "$USER_JWT" ] && [ -n "$SUBSCRIPTION_ID" ]; then
  # Get user ID from auth (needed for fn_record_payment)
  user_res=$(curl -s -X GET "$SUPABASE_URL/auth/v1/user" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT")
  USER_ID=$(echo "$user_res" | jq -r '.id // empty')

  # Fetch first pending payment for subscription
  pay_res=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/subscription_payments?subscription_id=eq.$SUBSCRIPTION_ID&status=eq.pending&select=id&order=payment_month.asc&limit=1" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT")
  PAYMENT_ID=$(echo "$pay_res" | jq -r 'if type == "array" and length > 0 then .[0].id else empty end')

  if [ -z "$PAYMENT_ID" ]; then
    echo "❌ SB-C2 — No pending payment for subscription (add one or use different SUBSCRIPTION_ID)"
    ((FAIL++)) || true
  elif [ -z "$USER_ID" ]; then
    echo "❌ SB-C2 — Could not get user ID from auth"
    ((FAIL++)) || true
  else
    PAYMENT_DATE=$(date +%Y-%m-%d)
    sb2_res=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/fn_record_payment" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $USER_JWT" \
      -H "Content-Type: application/json" \
      -d "{
        \"p_payment_id\": \"$PAYMENT_ID\",
        \"p_payment_date\": \"$PAYMENT_DATE\",
        \"p_payment_method\": \"cash\",
        \"p_should_invoice\": false,
        \"p_vat_rate\": 0,
        \"p_invoice_no\": null,
        \"p_invoice_type\": null,
        \"p_notes\": null,
        \"p_reference_no\": null,
        \"p_user_id\": \"$USER_ID\"
      }")
    # RPC returns SETOF = array of rows
    sub_id=$(echo "$sb2_res" | jq -r 'if type == "array" and length > 0 then .[0].subscription_id else empty end')
    if [ -n "$sub_id" ] && [ "$sub_id" != "null" ]; then
      echo "✅ SB-C2 — Payment recording returns subscription_id"
      ((PASS++)) || true
    else
      err=$(echo "$sb2_res" | jq -r '.message // .error_description // .')
      echo "❌ SB-C2 — Payment recording ($err)"
      ((FAIL++)) || true
    fi
  fi

  # SB-C3 — Pause only skips future months, not current
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/fn_pause_subscription" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"p_subscription_id\": \"$SUBSCRIPTION_ID\"}" > /dev/null 2>&1 || true
  CURRENT_MONTH=$(date +%Y-%m-01)
  sb3_res=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/subscription_payments?subscription_id=eq.$SUBSCRIPTION_ID&payment_month=gte.$CURRENT_MONTH&select=status" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json")
  sb3_status=$(echo "$sb3_res" | jq -r 'if type == "array" and length > 0 then .[0].status else empty end')
  if [ "$sb3_status" != "skipped" ] && [ -n "$sb3_status" ]; then
    echo "✅ SB-C3 — Pause keeps current month (status=$sb3_status)"
    ((PASS++)) || true
  else
    echo "❌ SB-C3 — Current month was skipped (status=$sb3_status)"
    ((FAIL++)) || true
  fi
else
  echo "⏭️  SB-C2, SB-C3 — Skipped (USER_JWT or SUBSCRIPTION_ID not set)"
  ((SKIP++)) || true
fi

# ── Section 3: Technician Role Tests (TECH_JWT = field_worker/technician) ──
if [ -n "$TECH_JWT" ]; then
  # TECH-BLOCK — Technician must get [] for sensitive tables (RLS blocks)
  for block_test in \
    "financial_transactions:select=id&limit=5:TECH-BLOCK-01:Technician blocked from finance" \
    "subscriptions:select=id&limit=5:TECH-BLOCK-02:Technician blocked from subscriptions" \
    "subscription_payments:select=id&limit=5:TECH-BLOCK-03:Technician blocked from subscription_payments" \
    "proposals:select=id&limit=5:TECH-BLOCK-04:Technician blocked from proposals" \
    "sim_cards:select=id&limit=5:TECH-BLOCK-05:Technician blocked from sim_cards" \
    "payment_methods:select=id&limit=5:TECH-BLOCK-06:Technician blocked from payment_methods"
  do
    IFS=: read -r table query id name <<< "$block_test"
    res=$(curl -s -X GET "$SUPABASE_URL/rest/v1/$table?$query" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $TECH_JWT" \
      -H "Content-Type: application/json")
    if [ "$res" = "[]" ]; then
      echo "✅ $id — $name"
      ((PASS++)) || true
    else
      echo "❌ $id — $name (got data)"
      ((FAIL++)) || true
    fi
  done

  # TECH-ALLOW — Technician can access work-related data
  # Profiles: all authenticated can read; technician gets at least own profile
  res=$(curl -s -X GET "$SUPABASE_URL/rest/v1/profiles?select=id,full_name,role&limit=10" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TECH_JWT" \
    -H "Content-Type: application/json")
  len=$(echo "$res" | jq 'length')
  if [ -n "$len" ] && [ "$len" -ge 1 ] 2>/dev/null; then
    echo "✅ TECH-ALLOW-01 — Technician can read profiles"
    ((PASS++)) || true
  else
    echo "❌ TECH-ALLOW-01 — Technician cannot read profiles (len=$len)"
    ((FAIL++)) || true
  fi

  # Customers: all authenticated can read
  code=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    "$SUPABASE_URL/rest/v1/customers?select=id&limit=5" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TECH_JWT" \
    -H "Content-Type: application/json")
  if [ "$code" = "200" ]; then
    echo "✅ TECH-ALLOW-02 — Technician can read customers"
    ((PASS++)) || true
  else
    echo "❌ TECH-ALLOW-02 — Technician cannot read customers (HTTP $code)"
    ((FAIL++)) || true
  fi

  # Work orders: technician sees only assigned; 200 = allowed (may be [])
  code=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    "$SUPABASE_URL/rest/v1/work_orders?select=id&limit=5" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TECH_JWT" \
    -H "Content-Type: application/json")
  if [ "$code" = "200" ]; then
    echo "✅ TECH-ALLOW-03 — Technician can read work_orders (assigned only)"
    ((PASS++)) || true
  else
    echo "❌ TECH-ALLOW-03 — Technician cannot read work_orders (HTTP $code)"
    ((FAIL++)) || true
  fi

  # get_daily_work_list RPC: technician gets own work for date
  TODAY=$(date +%Y-%m-%d)
  res=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_daily_work_list" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TECH_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"target_date\": \"$TODAY\"}")
  if echo "$res" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "✅ TECH-ALLOW-04 — Technician can call get_daily_work_list"
    ((PASS++)) || true
  else
    err=$(echo "$res" | jq -r '.message // .error_description // .')
    echo "❌ TECH-ALLOW-04 — Technician cannot call get_daily_work_list ($err)"
    ((FAIL++)) || true
  fi
else
  echo "⏭️  Section 3 (Technician tests) — Skipped (TECH_JWT not set)"
  ((SKIP++)) || true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ $FAIL -eq 0 ]
