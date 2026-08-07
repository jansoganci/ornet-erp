-- Migration: 00258_drop_subscription_alarm_center_fields
-- Description: Phase 3 — drop legacy subscriptions.alarm_center / alarm_center_account.
--   Site fields (customer_sites) remain the sole source of truth.
-- Depends on: 00257_site_alarm_acc_backfill_and_import
-- Rollback risk: HIGH — columns are dropped permanently; restore only from backup.
-- Do not apply before 00257 is applied on the target database.
--
-- SAFETY GUARD: this migration refuses to run (RAISE EXCEPTION, whole tx rolled
-- back) if any subscription still holds a non-null legacy Merkez/ACC value.
-- 00257 already clears placeholder ('MERKEZ YOK') and site-matching copies, so
-- anything left at this point is a TRUE unresolved conflict — see
-- docs/active/ALARM_ACC_SITE_CONFLICTS.md. Resolve each one manually (decide the
-- correct site value, update customer_sites if needed, then
-- `UPDATE subscriptions SET alarm_center = NULL, alarm_center_account = NULL
--  WHERE id = '<resolved-subscription-id>'`) before re-running this migration.

BEGIN;

-- ============================================================================
-- 1. Guard: abort if any unresolved legacy Merkez/ACC values remain
-- ============================================================================

DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM subscriptions
  WHERE alarm_center IS NOT NULL
     OR alarm_center_account IS NOT NULL;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'Cannot drop subscriptions.alarm_center*: % subscription(s) still hold unresolved legacy Merkez/ACC values that differ from their site. Resolve each conflict manually (see docs/active/ALARM_ACC_SITE_CONFLICTS.md), null the subscription copy, then re-run this migration.',
      v_remaining;
  END IF;
END $$;

-- ============================================================================
-- 2. Drop view before dropping columns (view used sub.* including those cols)
-- ============================================================================

DROP VIEW IF EXISTS subscriptions_detail;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS alarm_center;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS alarm_center_account;

-- ============================================================================
-- 3. Recreate subscriptions_detail (site Merkez/ACC only)
-- ============================================================================

CREATE VIEW subscriptions_detail AS
SELECT
  sub.*,
  (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee + sub.sim_amount) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee + sub.sim_amount) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee + sub.sim_amount) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  ROUND(
    (sub.base_price + sub.sms_fee + sub.line_fee + sub.static_ip_fee + sub.sim_amount) * (1 + sub.vat_rate / 100)
    - sub.cost - sub.static_ip_cost,
    2
  ) AS profit,
  (
    SELECT ip_address
    FROM sim_static_ips
    WHERE sim_card_id = sub.sim_card_id
      AND cancelled_at IS NULL
    LIMIT 1
  ) AS static_ip_address,
  EXISTS (
    SELECT 1 FROM subscription_payments sp
    WHERE sp.subscription_id = sub.id
      AND sp.status = 'pending'
      AND sp.payment_month < date_trunc('month', CURRENT_DATE)::date
  ) AS has_overdue_pending,
  s.account_no,
  s.alarm_center AS site_alarm_center,
  s.site_name,
  s.address       AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  c.id            AS customer_id,
  c.company_name,
  c.phone         AS customer_phone,
  c.tax_number,
  normalize_tr_for_search(c.company_name) AS company_name_search,
  normalize_tr_for_search(s.account_no) AS account_no_search,
  normalize_tr_for_search(s.site_name) AS site_name_search,
  pm.method_type  AS pm_type,
  pm.card_last4   AS pm_card_last4,
  pm.card_brand   AS pm_card_brand,
  pm.card_holder  AS pm_card_holder,
  pm.bank_name    AS pm_bank_name,
  pm.iban         AS pm_iban,
  pm.label        AS pm_label,
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name,
  cash_collector.full_name AS cash_collector_name,
  sc.phone_number AS sim_phone_number,
  COALESCE(sc.sale_price, 0) AS sim_tl
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id
LEFT JOIN profiles cash_collector ON sub.cash_collector_id = cash_collector.id
LEFT JOIN sim_cards sc ON sub.sim_card_id = sc.id;

ALTER VIEW subscriptions_detail SET (security_invoker = true);
COMMENT ON VIEW subscriptions_detail IS
  'security_invoker=true. Merkez/ACC only from customer_sites (site_alarm_center, account_no).';

GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 4. bulk_import: dual-read site_* and legacy alarm_* JSON keys for site fill
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_import_subscriptions(
  items jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row        jsonb;
  v_sub_id     uuid;
  v_site_id    uuid;
  v_idx        integer := 0;
  v_created    integer := 0;
  v_failed     integer := 0;
  v_errors     jsonb   := '[]'::jsonb;
  v_row_num    integer;
  v_role       TEXT;
  v_center     TEXT;
  v_acc        TEXT;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot bulk import subscriptions', v_role;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_idx := v_idx + 1;
    v_row_num := COALESCE((v_row->>'row_num')::integer, v_idx + 1);

    BEGIN
      v_site_id := (v_row->>'site_id')::uuid;

      -- Prefer site_* keys; fall back to legacy alarm_* for one-sprint compatibility
      v_center := NULLIF(btrim(COALESCE(
        NULLIF(v_row->>'site_alarm_center', ''),
        v_row->>'alarm_center',
        ''
      )), '');
      v_acc := NULLIF(btrim(COALESCE(
        NULLIF(v_row->>'site_account_no', ''),
        v_row->>'alarm_center_account',
        ''
      )), '');

      IF v_site_id IS NOT NULL AND (v_center IS NOT NULL OR v_acc IS NOT NULL) THEN
        UPDATE customer_sites
        SET
          alarm_center = CASE
            WHEN (alarm_center IS NULL OR btrim(alarm_center) = '') AND v_center IS NOT NULL
              THEN v_center
            ELSE alarm_center
          END,
          account_no = CASE
            WHEN (account_no IS NULL OR btrim(account_no) = '') AND v_acc IS NOT NULL
              THEN v_acc
            ELSE account_no
          END
        WHERE id = v_site_id;
      END IF;

      INSERT INTO subscriptions (
        site_id,
        start_date,
        billing_day,
        base_price,
        sim_amount,
        sms_fee,
        line_fee,
        cost,
        vat_rate,
        currency,
        billing_frequency,
        payment_start_month,
        service_type,
        official_invoice,
        notes,
        setup_notes,
        subscriber_title,
        created_by
      ) VALUES (
        v_site_id,
        (v_row->>'start_date')::date,
        COALESCE((v_row->>'billing_day')::integer, 1),
        COALESCE((v_row->>'base_price')::decimal, 0),
        COALESCE((v_row->>'sim_amount')::decimal, 0),
        COALESCE((v_row->>'sms_fee')::decimal, 0),
        COALESCE((v_row->>'line_fee')::decimal, 0),
        COALESCE((v_row->>'cost')::decimal, 0),
        COALESCE((v_row->>'vat_rate')::decimal, 20),
        COALESCE(v_row->>'currency', 'TRY'),
        COALESCE(v_row->>'billing_frequency', 'monthly'),
        (v_row->>'payment_start_month')::integer,
        NULLIF(v_row->>'service_type', ''),
        COALESCE((v_row->>'official_invoice')::boolean, true),
        NULLIF(v_row->>'notes', ''),
        NULLIF(v_row->>'setup_notes', ''),
        NULLIF(v_row->>'subscriber_title', ''),
        p_user_id
      )
      RETURNING id INTO v_sub_id;

      PERFORM generate_subscription_payments(v_sub_id);

      INSERT INTO audit_logs (table_name, record_id, action, new_values, user_id, description)
      VALUES (
        'subscriptions',
        v_sub_id,
        'insert',
        v_row,
        p_user_id,
        'Toplu içe aktarma ile oluşturuldu'
      );

      v_created := v_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_row_num,
        'message', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'failed',  v_failed,
    'errors',  v_errors
  );
END;
$$;

COMMENT ON FUNCTION bulk_import_subscriptions(jsonb, uuid) IS
  'Bulk-create subscriptions. site_alarm_center/site_account_no (or legacy alarm_*) fill empty customer_sites only.';

COMMIT;
