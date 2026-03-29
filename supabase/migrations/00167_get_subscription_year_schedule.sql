-- Migration: 00167_get_subscription_year_schedule
-- Description: Add get_subscription_year_schedule() — returns the complete billing
--   schedule for a subscription in a given calendar year.  Real subscription_payments
--   rows are returned with their actual data; months that have no DB row yet are
--   returned as status = 'projected' with amounts calculated from current subscription
--   pricing.  This replaces the need to pre-generate phantom "pending" rows for UI
--   display and enables the lean-DB batch collection model.
--
-- Return columns:
--   payment_month   — 1st of the billing month (DATE)
--   amount          — net amount, KDV hariç (NUMERIC)
--   vat_amount      — KDV component (NUMERIC)
--   total_amount    — gross amount, KDV dahil (NUMERIC)
--   status          — 'paid' | 'pending' | 'failed' | 'skipped' | 'write_off' | 'projected'
--   payment_date    — actual payment date, NULL for pending/projected rows
--   payment_method  — 'card' | 'cash' | 'bank_transfer' | NULL
--   invoice_no      — issued invoice number, NULL if not yet invoiced
--   payment_id      — subscription_payments.id (NULL for projected rows)
--   is_projected    — TRUE when no real DB row exists for this month
--
-- Billing frequency → expected rows per year:
--   monthly  → 12 rows (one per month)
--   3_month  → 4 rows  (quarterly)
--   6_month  → 2 rows  (semi-annual)
--   yearly   → 1 row   (annual)
--
-- ============================================================================

CREATE OR REPLACE FUNCTION get_subscription_year_schedule(
  p_subscription_id UUID,
  p_year            INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  payment_month   DATE,
  amount          NUMERIC(12,2),
  vat_amount      NUMERIC(12,2),
  total_amount    NUMERIC(12,2),
  status          TEXT,
  payment_date    DATE,
  payment_method  TEXT,
  invoice_no      TEXT,
  payment_id      UUID,
  is_projected    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub             RECORD;
  v_interval_months INTEGER;
  v_multiplier      INTEGER;
  v_anchor          DATE;
  v_month           DATE;
  v_cutoff_month    DATE;        -- last month to project for cancelled subscriptions
  v_subtotal        NUMERIC(12,2);
  v_vat             NUMERIC(12,2);
  v_total           NUMERIC(12,2);
  v_real            RECORD;
BEGIN

  -- ── 1. Load subscription ──────────────────────────────────────────────────
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;

  -- ── 2. Billing frequency → interval + multiplier ─────────────────────────
  CASE COALESCE(v_sub.billing_frequency, 'monthly')
    WHEN 'yearly'  THEN v_interval_months := 12; v_multiplier := 12;
    WHEN '6_month' THEN v_interval_months := 6;  v_multiplier := 6;
    WHEN '3_month' THEN v_interval_months := 3;  v_multiplier := 3;
    ELSE                v_interval_months := 1;  v_multiplier := 1;  -- monthly (default)
  END CASE;

  -- ── 3. Projected amounts from current subscription pricing ────────────────
  -- Use same formula as extend_active_subscription_payments / ensure_payments_for_year
  v_subtotal := COALESCE(v_sub.base_price,    0)
              + COALESCE(v_sub.sms_fee,        0)
              + COALESCE(v_sub.line_fee,        0)
              + COALESCE(v_sub.static_ip_fee,   0)
              + COALESCE(v_sub.sim_amount,       0);
  v_vat   := ROUND(v_subtotal * COALESCE(v_sub.vat_rate, 20) / 100, 2);
  v_total := v_subtotal + v_vat;

  -- ── 4. Projection cutoff for cancelled subscriptions ─────────────────────
  -- After end_date we show real (paid) rows but emit no further projected rows.
  IF v_sub.status = 'cancelled' AND v_sub.end_date IS NOT NULL THEN
    v_cutoff_month := date_trunc('month', v_sub.end_date)::DATE;
  ELSE
    v_cutoff_month := NULL;  -- no cutoff; active or paused
  END IF;

  -- ── 5. Anchor: first ever billing month for this subscription ─────────────
  --
  -- Priority 1 — use MIN(payment_month) from existing rows.
  --   This guarantees the virtual schedule stays perfectly on-cycle with
  --   whatever anchor was used when payments were first generated
  --   (which may be CURRENT_DATE per migration 00148, not start_date).
  --
  -- Priority 2 — derive from subscription metadata when no rows exist yet
  --   (brand-new subscription, first 28th cron hasn't fired yet).
  --   Mirrors the same logic used by extend_active_subscription_payments.
  --
  SELECT MIN(sp.payment_month)
  INTO   v_anchor
  FROM   subscription_payments sp
  WHERE  sp.subscription_id = p_subscription_id;

  IF v_anchor IS NULL THEN
    -- No real rows yet: calculate from subscription configuration
    IF COALESCE(v_sub.billing_frequency, 'monthly') <> 'monthly'
       AND v_sub.payment_start_month IS NOT NULL THEN
      -- Non-monthly with explicit start month (e.g. 3-month cycle starting April)
      v_anchor := make_date(
        EXTRACT(YEAR FROM v_sub.start_date)::INTEGER,
        v_sub.payment_start_month,
        1
      );
    ELSE
      -- Monthly or no payment_start_month override
      v_anchor := date_trunc('month', v_sub.start_date)::DATE;
    END IF;
  END IF;

  -- ── 6. Advance anchor (on-cycle) to the first billing month in p_year ─────
  -- Each step stays exactly on the billing cycle established by the anchor.
  v_month := v_anchor;
  WHILE v_month < make_date(p_year, 1, 1) LOOP
    v_month := (v_month + (v_interval_months || ' months')::INTERVAL)::DATE;
  END LOOP;

  -- ── 7. Emit one row per billing month that falls in p_year ────────────────
  WHILE EXTRACT(YEAR FROM v_month)::INTEGER = p_year LOOP

    -- Skip months before the subscription's contract start date
    -- (e.g. a 3-month cycle whose anchor pre-dates start_date)
    IF v_month >= date_trunc('month', v_sub.start_date)::DATE THEN

      -- Attempt to find the real subscription_payments row for this month
      SELECT sp.id,
             sp.amount,
             sp.vat_amount,
             sp.total_amount,
             sp.status,
             sp.payment_date,
             sp.payment_method,
             sp.invoice_no
      INTO   v_real
      FROM   subscription_payments sp
      WHERE  sp.subscription_id = p_subscription_id
        AND  sp.payment_month   = v_month;

      IF FOUND THEN
        -- ── Real row: return its actual data ──────────────────────────────
        payment_month  := v_month;
        amount         := v_real.amount;
        vat_amount     := v_real.vat_amount;
        total_amount   := v_real.total_amount;
        status         := v_real.status;
        payment_date   := v_real.payment_date;
        payment_method := v_real.payment_method;
        invoice_no     := v_real.invoice_no;
        payment_id     := v_real.id;
        is_projected   := FALSE;
        RETURN NEXT;

      ELSIF v_cutoff_month IS NULL OR v_month <= v_cutoff_month THEN
        -- ── Projected row: calculated from current pricing ─────────────────
        -- Only emitted when: subscription is not cancelled, OR this month is
        -- within the cancellation month (inclusive).
        payment_month  := v_month;
        amount         := v_subtotal * v_multiplier;
        vat_amount     := v_vat      * v_multiplier;
        total_amount   := v_total    * v_multiplier;
        status         := 'projected';
        payment_date   := NULL;
        payment_method := NULL;
        invoice_no     := NULL;
        payment_id     := NULL;
        is_projected   := TRUE;
        RETURN NEXT;
      END IF;
      -- If cancelled and past cutoff_month with no real row: emit nothing.

    END IF;

    v_month := (v_month + (v_interval_months || ' months')::INTERVAL)::DATE;
  END LOOP;

END;
$$;

-- Allow all authenticated users to call this function
-- (mirrors the SELECT RLS on subscription_payments: authenticated = true)
GRANT EXECUTE ON FUNCTION get_subscription_year_schedule(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- DOWN (rollback)
-- DROP FUNCTION IF EXISTS get_subscription_year_schedule(UUID, INTEGER);
-- ============================================================================
