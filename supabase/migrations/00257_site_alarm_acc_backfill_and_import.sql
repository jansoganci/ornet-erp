-- Migration: 00257_site_alarm_acc_backfill_and_import
-- Description: Site-owned Merkez/ACC Phase 2
--   1) Backfill empty customer_sites.account_no / alarm_center from subscriptions
--      (real values only — the 'MERKEZ YOK' placeholder is never written to sites)
--   2) Null subscription copies that are the meaningless 'MERKEZ YOK' placeholder
--   3) Null subscription copies that match the resulting site value (no info lost)
--   4) Add site_alarm_center to subscriptions_detail
--   5) bulk_import_subscriptions fills empty site fields; stops writing subscription alarm cols
-- Depends on: 00143 (subscriptions_detail), 00229 (bulk_import_subscriptions), 00204 (security_invoker)
-- Rollback risk: data backfill is not auto-reversible; restore from backup if needed.
--               DROP of subscription alarm columns is NOT in this migration (Phase 3).
--
-- After this migration, subscriptions.alarm_center* still holding a non-null,
-- non-placeholder value that differs from the site are TRUE unresolved conflicts.
-- See docs/active/ALARM_ACC_SITE_CONFLICTS.md — 00258 will refuse to run while any remain.

BEGIN;

-- ============================================================================
-- 1. Backfill empty site account_no — real values only, placeholder excluded
-- ============================================================================

UPDATE customer_sites s
SET account_no = src.acc
FROM (
  SELECT DISTINCT ON (sub.site_id)
    sub.site_id,
    btrim(sub.alarm_center_account) AS acc
  FROM subscriptions sub
  WHERE sub.alarm_center_account IS NOT NULL
    AND btrim(sub.alarm_center_account) <> ''
    AND upper(btrim(sub.alarm_center_account)) <> 'MERKEZ YOK'
  ORDER BY sub.site_id, sub.updated_at DESC NULLS LAST
) src
WHERE s.id = src.site_id
  AND (s.account_no IS NULL OR btrim(s.account_no) = '');

-- ============================================================================
-- 2. Backfill empty site alarm_center — real values only, placeholder excluded
-- ============================================================================

UPDATE customer_sites s
SET alarm_center = src.center
FROM (
  SELECT DISTINCT ON (sub.site_id)
    sub.site_id,
    btrim(sub.alarm_center) AS center
  FROM subscriptions sub
  WHERE sub.alarm_center IS NOT NULL
    AND btrim(sub.alarm_center) <> ''
    AND upper(btrim(sub.alarm_center)) <> 'MERKEZ YOK'
  ORDER BY sub.site_id, sub.updated_at DESC NULLS LAST
) src
WHERE s.id = src.site_id
  AND (s.alarm_center IS NULL OR btrim(s.alarm_center) = '');

-- ============================================================================
-- 3. Null subscription copies that are exactly the 'MERKEZ YOK' placeholder.
--    This carries no real information (it literally means "no center on file")
--    and is dropped regardless of the site's state — nothing is overwritten.
-- ============================================================================

UPDATE subscriptions
SET alarm_center_account = NULL
WHERE alarm_center_account IS NOT NULL
  AND upper(btrim(alarm_center_account)) = 'MERKEZ YOK';

UPDATE subscriptions
SET alarm_center = NULL
WHERE alarm_center IS NOT NULL
  AND upper(btrim(alarm_center)) = 'MERKEZ YOK';

-- ============================================================================
-- 4. Null matching subscription copies (do not touch true conflicts)
-- ============================================================================

UPDATE subscriptions sub
SET alarm_center_account = NULL
FROM customer_sites s
WHERE sub.site_id = s.id
  AND sub.alarm_center_account IS NOT NULL
  AND btrim(sub.alarm_center_account) <> ''
  AND s.account_no IS NOT NULL
  AND btrim(s.account_no) <> ''
  AND normalize_tr_for_search(btrim(sub.alarm_center_account))
    = normalize_tr_for_search(btrim(s.account_no));

UPDATE subscriptions sub
SET alarm_center = NULL
FROM customer_sites s
WHERE sub.site_id = s.id
  AND sub.alarm_center IS NOT NULL
  AND btrim(sub.alarm_center) <> ''
  AND s.alarm_center IS NOT NULL
  AND btrim(s.alarm_center) <> ''
  AND normalize_tr_for_search(btrim(sub.alarm_center))
    = normalize_tr_for_search(btrim(s.alarm_center));

COMMENT ON COLUMN customer_sites.account_no IS
  'Canonical alarm monitoring account number (ACC). Source of truth for Merkez ACC; subscriptions.alarm_center_account is legacy.';
COMMENT ON COLUMN customer_sites.alarm_center IS
  'Canonical alarm monitoring center name (Merkez). Source of truth; subscriptions.alarm_center is legacy.';

-- ============================================================================
-- 5. subscriptions_detail: add site_alarm_center
-- ============================================================================

DROP VIEW IF EXISTS subscriptions_detail;

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
  'security_invoker=true: subscriptions and joined tables enforce RLS per caller. site_alarm_center / account_no from customer_sites (canonical Merkez/ACC).';

GRANT SELECT ON subscriptions_detail TO authenticated;

-- ============================================================================
-- 6. bulk_import_subscriptions: fill empty site Merkez/ACC; do not write subscription copies
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
      v_center := NULLIF(btrim(COALESCE(v_row->>'alarm_center', '')), '');
      v_acc := NULLIF(btrim(COALESCE(v_row->>'alarm_center_account', '')), '');

      -- Fill empty site fields only — never overwrite existing site Merkez/ACC
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
  'Bulk-create subscriptions. MERKEZ/ACC in payload fill empty customer_sites fields only; not stored on subscriptions.';

COMMIT;
