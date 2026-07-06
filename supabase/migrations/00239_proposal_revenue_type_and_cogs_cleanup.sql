-- 00239_proposal_revenue_type_and_cogs_cleanup.sql
--
-- Phase 2 scope:
-- 1. Add proposal_items.revenue_type for internal revenue classification.
-- 2. Extend fn_save_proposal_package() to persist revenue_type.
-- 3. Clean auto_record_proposal_revenue() so planned labor/shipping/misc
--    never enter ledger COGS or cogs_try.

ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS revenue_type TEXT;

UPDATE proposal_items
SET revenue_type = 'material'
WHERE revenue_type IS NULL
   OR BTRIM(revenue_type) = '';

ALTER TABLE proposal_items
  ALTER COLUMN revenue_type SET DEFAULT 'material';

ALTER TABLE proposal_items
  ALTER COLUMN revenue_type SET NOT NULL;

ALTER TABLE proposal_items
  DROP CONSTRAINT IF EXISTS proposal_items_revenue_type_check;

ALTER TABLE proposal_items
  ADD CONSTRAINT proposal_items_revenue_type_check
  CHECK (revenue_type IN ('material', 'labor_service', 'other'));

CREATE OR REPLACE FUNCTION fn_save_proposal_package(
  p_proposal_id UUID DEFAULT NULL,
  p_proposal JSONB DEFAULT '{}'::jsonb,
  p_sections JSONB DEFAULT '[]'::jsonb,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_annual_fixed_costs JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role             TEXT;
  v_proposal_id      UUID;
  v_now              TIMESTAMPTZ := now();
  v_currency         TEXT;
  v_total_amount     NUMERIC(12,2) := 0;
  v_total_amount_usd NUMERIC(12,2) := 0;
BEGIN
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Unauthorized: role % cannot save proposal package', v_role;
  END IF;

  IF jsonb_typeof(COALESCE(p_proposal, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'p_proposal must be a JSON object';
  END IF;

  IF jsonb_typeof(COALESCE(p_sections, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_sections must be a JSON array';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  IF jsonb_typeof(COALESCE(p_annual_fixed_costs, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_annual_fixed_costs must be a JSON array';
  END IF;

  v_currency := UPPER(COALESCE(NULLIF(p_proposal->>'currency', ''), 'USD'));
  IF v_currency NOT IN ('TRY', 'USD') THEN
    RAISE EXCEPTION 'Unsupported proposal currency %', v_currency;
  END IF;

  IF p_proposal_id IS NULL THEN
    INSERT INTO proposals (
      proposal_no,
      site_id,
      title,
      notes,
      scope_of_work,
      currency,
      total_amount,
      total_amount_usd,
      status,
      created_by,
      proposal_date,
      survey_date,
      authorized_person,
      installation_date,
      customer_representative,
      completion_date,
      terms_engineering,
      terms_pricing,
      terms_warranty,
      terms_other,
      terms_attachments,
      vat_rate,
      has_tevkifat
    ) VALUES (
      generate_proposal_no(),
      NULLIF(p_proposal->>'site_id', '')::uuid,
      COALESCE(p_proposal->>'title', ''),
      NULLIF(p_proposal->>'notes', ''),
      NULLIF(p_proposal->>'scope_of_work', ''),
      v_currency,
      0,
      0,
      COALESCE(NULLIF(p_proposal->>'status', ''), 'draft'),
      auth.uid(),
      NULLIF(p_proposal->>'proposal_date', '')::date,
      NULLIF(p_proposal->>'survey_date', '')::date,
      NULLIF(p_proposal->>'authorized_person', ''),
      NULLIF(p_proposal->>'installation_date', '')::date,
      NULLIF(p_proposal->>'customer_representative', ''),
      NULLIF(p_proposal->>'completion_date', '')::date,
      NULLIF(p_proposal->>'terms_engineering', ''),
      NULLIF(p_proposal->>'terms_pricing', ''),
      NULLIF(p_proposal->>'terms_warranty', ''),
      NULLIF(p_proposal->>'terms_other', ''),
      NULLIF(p_proposal->>'terms_attachments', ''),
      COALESCE(NULLIF(p_proposal->>'vat_rate', '')::numeric, 0),
      COALESCE(NULLIF(p_proposal->>'has_tevkifat', '')::boolean, false)
    )
    RETURNING id INTO v_proposal_id;
  ELSE
    UPDATE proposals
    SET
      site_id = NULLIF(p_proposal->>'site_id', '')::uuid,
      title = COALESCE(p_proposal->>'title', title),
      notes = NULLIF(p_proposal->>'notes', ''),
      scope_of_work = NULLIF(p_proposal->>'scope_of_work', ''),
      currency = v_currency,
      status = COALESCE(NULLIF(p_proposal->>'status', ''), status),
      proposal_date = NULLIF(p_proposal->>'proposal_date', '')::date,
      survey_date = NULLIF(p_proposal->>'survey_date', '')::date,
      authorized_person = NULLIF(p_proposal->>'authorized_person', ''),
      installation_date = NULLIF(p_proposal->>'installation_date', '')::date,
      customer_representative = NULLIF(p_proposal->>'customer_representative', ''),
      completion_date = NULLIF(p_proposal->>'completion_date', '')::date,
      terms_engineering = NULLIF(p_proposal->>'terms_engineering', ''),
      terms_pricing = NULLIF(p_proposal->>'terms_pricing', ''),
      terms_warranty = NULLIF(p_proposal->>'terms_warranty', ''),
      terms_other = NULLIF(p_proposal->>'terms_other', ''),
      terms_attachments = NULLIF(p_proposal->>'terms_attachments', ''),
      vat_rate = COALESCE(NULLIF(p_proposal->>'vat_rate', '')::numeric, 0),
      has_tevkifat = COALESCE(NULLIF(p_proposal->>'has_tevkifat', '')::boolean, false),
      total_amount = 0,
      total_amount_usd = 0,
      updated_at = v_now
    WHERE id = p_proposal_id
      AND deleted_at IS NULL
    RETURNING id INTO v_proposal_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Proposal % not found or deleted', p_proposal_id;
    END IF;
  END IF;

  CREATE TEMP TABLE tmp_proposal_section_input (
    local_id TEXT,
    title TEXT,
    discount_percent NUMERIC(5,2),
    sort_order INTEGER
  ) ON COMMIT DROP;

  INSERT INTO tmp_proposal_section_input (local_id, title, discount_percent, sort_order)
  SELECT
    NULLIF(local_id, ''),
    COALESCE(title, ''),
    LEAST(GREATEST(COALESCE(discount_percent, 0), 0), 100),
    sort_order
  FROM jsonb_to_recordset(COALESCE(p_sections, '[]'::jsonb)) AS s(
    local_id TEXT,
    title TEXT,
    discount_percent NUMERIC,
    sort_order INTEGER
  );

  CREATE TEMP TABLE tmp_proposal_section_map (
    local_id TEXT,
    section_id UUID
  ) ON COMMIT DROP;

  DELETE FROM proposal_items WHERE proposal_id = v_proposal_id;
  DELETE FROM proposal_sections WHERE proposal_id = v_proposal_id;
  DELETE FROM proposal_annual_fixed_costs WHERE proposal_id = v_proposal_id;

  WITH inserted_sections AS (
    INSERT INTO proposal_sections (
      proposal_id,
      title,
      sort_order,
      discount_percent
    )
    SELECT
      v_proposal_id,
      title,
      sort_order,
      discount_percent
    FROM tmp_proposal_section_input
    ORDER BY sort_order
    RETURNING id, sort_order
  )
  INSERT INTO tmp_proposal_section_map (local_id, section_id)
  SELECT tsi.local_id, ins.id
  FROM inserted_sections ins
  JOIN tmp_proposal_section_input tsi
    ON tsi.sort_order = ins.sort_order;

  INSERT INTO proposal_items (
    proposal_id,
    sort_order,
    section_id,
    description,
    quantity,
    unit,
    unit_price,
    unit_price_usd,
    material_id,
    revenue_type,
    cost,
    cost_usd,
    margin_percent,
    product_cost,
    product_cost_usd,
    labor_cost,
    labor_cost_usd,
    shipping_cost,
    shipping_cost_usd,
    material_cost,
    material_cost_usd,
    misc_cost,
    misc_cost_usd
  )
  SELECT
    v_proposal_id,
    i.sort_order,
    sm.section_id,
    COALESCE(NULLIF(BTRIM(i.description), ''), '—'),
    COALESCE(NULLIF(i.quantity, 0), 1),
    COALESCE(NULLIF(BTRIM(i.unit), ''), 'adet'),
    i.unit_price,
    i.unit_price_usd,
    i.material_id,
    CASE
      WHEN i.revenue_type IN ('material', 'labor_service', 'other') THEN i.revenue_type
      ELSE 'material'
    END,
    i.cost,
    i.cost_usd,
    i.margin_percent,
    i.product_cost,
    i.product_cost_usd,
    i.labor_cost,
    i.labor_cost_usd,
    i.shipping_cost,
    i.shipping_cost_usd,
    i.material_cost,
    i.material_cost_usd,
    i.misc_cost,
    i.misc_cost_usd
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS i(
    sort_order INTEGER,
    section_local_id TEXT,
    description TEXT,
    quantity NUMERIC,
    unit TEXT,
    unit_price NUMERIC,
    unit_price_usd NUMERIC,
    material_id UUID,
    revenue_type TEXT,
    cost NUMERIC,
    cost_usd NUMERIC,
    margin_percent NUMERIC,
    product_cost NUMERIC,
    product_cost_usd NUMERIC,
    labor_cost NUMERIC,
    labor_cost_usd NUMERIC,
    shipping_cost NUMERIC,
    shipping_cost_usd NUMERIC,
    material_cost NUMERIC,
    material_cost_usd NUMERIC,
    misc_cost NUMERIC,
    misc_cost_usd NUMERIC
  )
  LEFT JOIN tmp_proposal_section_map sm
    ON sm.local_id = NULLIF(i.section_local_id, '')
  ORDER BY i.sort_order;

  INSERT INTO proposal_annual_fixed_costs (
    proposal_id,
    sort_order,
    description,
    quantity,
    unit,
    unit_price,
    currency
  )
  SELECT
    v_proposal_id,
    af.sort_order,
    BTRIM(af.description),
    COALESCE(NULLIF(af.quantity, 0), 1),
    COALESCE(NULLIF(BTRIM(af.unit), ''), 'adet'),
    COALESCE(af.unit_price, 0),
    COALESCE(NULLIF(UPPER(af.currency), ''), 'TRY')
  FROM jsonb_to_recordset(COALESCE(p_annual_fixed_costs, '[]'::jsonb)) AS af(
    sort_order INTEGER,
    description TEXT,
    quantity NUMERIC,
    unit TEXT,
    unit_price NUMERIC,
    currency TEXT
  )
  WHERE LENGTH(BTRIM(COALESCE(af.description, ''))) > 0
  ORDER BY af.sort_order;

  WITH section_subtotals AS (
    SELECT
      COALESCE(ps.discount_percent, 0) AS discount_percent,
      COALESCE(SUM(
        CASE
          WHEN v_currency = 'USD' THEN COALESCE(NULLIF(pi.total_usd, 0), COALESCE(pi.unit_price_usd, 0) * COALESCE(pi.quantity, 0))
          ELSE COALESCE(NULLIF(pi.line_total, 0), COALESCE(pi.unit_price, 0) * COALESCE(pi.quantity, 0))
        END
      ), 0) AS subtotal
    FROM proposal_sections ps
    LEFT JOIN proposal_items pi
      ON pi.section_id = ps.id
    WHERE ps.proposal_id = v_proposal_id
    GROUP BY ps.id, ps.discount_percent
  ),
  ungrouped_subtotal AS (
    SELECT
      COALESCE(SUM(
        CASE
          WHEN v_currency = 'USD' THEN COALESCE(NULLIF(pi.total_usd, 0), COALESCE(pi.unit_price_usd, 0) * COALESCE(pi.quantity, 0))
          ELSE COALESCE(NULLIF(pi.line_total, 0), COALESCE(pi.unit_price, 0) * COALESCE(pi.quantity, 0))
        END
      ), 0) AS subtotal
    FROM proposal_items pi
    WHERE pi.proposal_id = v_proposal_id
      AND pi.section_id IS NULL
  )
  SELECT
    CASE WHEN v_currency = 'USD' THEN 0 ELSE COALESCE(ROUND(SUM(section_total), 2), 0) END,
    CASE WHEN v_currency = 'USD' THEN COALESCE(ROUND(SUM(section_total), 2), 0) ELSE 0 END
  INTO v_total_amount, v_total_amount_usd
  FROM (
    SELECT ROUND(subtotal - ROUND(subtotal * LEAST(GREATEST(discount_percent, 0), 100) / 100, 2), 2) AS section_total
    FROM section_subtotals
    UNION ALL
    SELECT ROUND(subtotal, 2) AS section_total
    FROM ungrouped_subtotal
  ) totals;

  UPDATE proposals
  SET
    total_amount = v_total_amount,
    total_amount_usd = v_total_amount_usd,
    updated_at = v_now
  WHERE id = v_proposal_id;

  RETURN v_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_save_proposal_package(UUID, JSONB, JSONB, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id         UUID;
  v_site_id             UUID;
  v_currency            TEXT;
  v_total_usd           DECIMAL(12,2);
  v_cogs_usd            DECIMAL(12,2) := 0;
  v_rate                DECIMAL(10,4);
  v_amount_try          DECIMAL(12,2);
  v_cogs_try            DECIMAL(12,2);
  v_revenue_try         DECIMAL(12,2);
  v_cogs_total_try      DECIMAL(12,2) := 0;
  v_vat_rate            DECIMAL(5,2);
  v_output_vat          DECIMAL(12,2);
  v_input_vat           DECIMAL(12,2);
  v_net_income          DECIMAL(12,2);
  v_item                RECORD;
  v_has_detail          BOOLEAN;
  v_item_cogs           DECIMAL(12,2);
  v_expense_category_id UUID;
  v_transaction_date    DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount_try), 0)
  INTO v_net_income
  FROM financial_transactions
  WHERE proposal_id = NEW.id
    AND direction   = 'income'
    AND deleted_at  IS NULL;
  IF v_net_income > 0 THEN RETURN NEW; END IF;

  v_currency := UPPER(COALESCE(NEW.currency, 'USD'));
  v_vat_rate := COALESCE(NEW.vat_rate, 20);
  v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

  IF v_currency = 'TRY' THEN
    v_revenue_try := ROUND(COALESCE(NEW.total_amount, 0), 2);
    IF v_revenue_try <= 0 OR NEW.site_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
    FROM customer_sites cs WHERE cs.id = NEW.site_id;
    IF v_site_id IS NULL THEN RETURN NEW; END IF;

    FOR v_item IN
      SELECT pi.quantity, pi.cost, pi.product_cost, pi.material_cost
      FROM proposal_items pi
      WHERE pi.proposal_id = NEW.id
    LOOP
      v_has_detail :=
        (v_item.product_cost  IS NOT NULL AND v_item.product_cost  <> 0) OR
        (v_item.material_cost IS NOT NULL AND v_item.material_cost <> 0);

      IF v_has_detail THEN
        v_item_cogs :=
          COALESCE(v_item.product_cost,  0) +
          COALESCE(v_item.material_cost, 0);
      ELSE
        v_item_cogs := COALESCE(v_item.cost, 0);
      END IF;

      v_cogs_total_try := v_cogs_total_try + (v_item_cogs * COALESCE(v_item.quantity, 1));
    END LOOP;

    IF v_cogs_total_try = 0 THEN
      v_cogs_total_try := COALESCE(NEW.cost_usd, 0);
    END IF;

    v_output_vat := ROUND(v_revenue_try * v_vat_rate / 100, 2);
    v_input_vat  := CASE WHEN v_cogs_total_try > 0
                         THEN ROUND(v_cogs_total_try * v_vat_rate / 100, 2)
                         ELSE NULL END;

    INSERT INTO financial_transactions (
      direction, income_type, proposal_id,
      amount_original, original_currency, amount_try, exchange_rate,
      cogs_try, should_invoice, output_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      service_category,
      payment_status,
      created_at, updated_at
    ) VALUES (
      'income', 'sale', NEW.id,
      v_revenue_try, 'TRY', v_revenue_try, NULL,
      CASE WHEN v_cogs_total_try > 0 THEN v_cogs_total_try ELSE NULL END,
      true, v_output_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      'montaj',
      'unpaid',
      now(), now()
    );

    IF v_cogs_total_try > 0 THEN
      SELECT id INTO v_expense_category_id
      FROM expense_categories WHERE code = 'material' LIMIT 1;

      -- Do not swallow mirrored expense failures: proposal completion must roll back
      -- rather than leaving income rows without the matching material expense row.
      INSERT INTO financial_transactions (
        direction, proposal_id, expense_category_id,
        amount_original, original_currency, amount_try, exchange_rate,
        has_invoice, input_vat, vat_rate,
        transaction_date, customer_id, site_id, payment_method,
        created_at, updated_at
      ) VALUES (
        'expense', NEW.id, v_expense_category_id,
        v_cogs_total_try, 'TRY', v_cogs_total_try, NULL,
        true, v_input_vat, v_vat_rate,
        v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
        now(), now()
      );
    END IF;

    RETURN NEW;
  END IF;

  v_total_usd := COALESCE(NEW.total_amount_usd, 0);
  IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
  FROM customer_sites cs WHERE cs.id = NEW.site_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  FOR v_item IN
    SELECT pi.quantity, pi.cost_usd, pi.product_cost_usd, pi.material_cost_usd
    FROM proposal_items pi
    WHERE pi.proposal_id = NEW.id
  LOOP
    v_has_detail :=
      (v_item.product_cost_usd  IS NOT NULL AND v_item.product_cost_usd  <> 0) OR
      (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0);

    IF v_has_detail THEN
      v_item_cogs :=
        COALESCE(v_item.product_cost_usd,  0) +
        COALESCE(v_item.material_cost_usd, 0);
    ELSE
      v_item_cogs := COALESCE(v_item.cost_usd, 0);
    END IF;

    v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
  END LOOP;

  IF v_cogs_usd = 0 THEN
    v_cogs_usd := COALESCE(NEW.cost_usd, 0);
  END IF;

  IF NEW.completion_exchange_rate IS NOT NULL AND NEW.completion_exchange_rate > 0 THEN
    v_rate := NEW.completion_exchange_rate;
  ELSE
    SELECT effective_rate INTO v_rate
    FROM exchange_rates
    WHERE currency = 'USD'
      AND rate_date <= v_transaction_date
    ORDER BY rate_date DESC
    LIMIT 1;

    IF v_rate IS NULL OR v_rate = 0 THEN
      RAISE WARNING
        'auto_record_proposal_revenue: no USD rate on or before % for proposal %. '
        'Finance entry skipped.',
        v_transaction_date, NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  v_amount_try := ROUND(v_total_usd * v_rate, 2);
  v_cogs_try   := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
  v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);
  v_input_vat  := CASE WHEN v_cogs_try IS NOT NULL AND v_cogs_try > 0
                       THEN ROUND(v_cogs_try * v_vat_rate / 100, 2)
                       ELSE NULL END;

  INSERT INTO financial_transactions (
    direction, income_type, proposal_id,
    amount_original, original_currency, amount_try, exchange_rate,
    cogs_try, should_invoice, output_vat, vat_rate,
    transaction_date, customer_id, site_id, payment_method,
    service_category,
    payment_status,
    created_at, updated_at
  ) VALUES (
    'income', 'sale', NEW.id,
    v_total_usd, 'USD', v_amount_try, v_rate,
    v_cogs_try, true, v_output_vat, v_vat_rate,
    v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
    'montaj',
    'unpaid',
    now(), now()
  );

  IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
    SELECT id INTO v_expense_category_id
    FROM expense_categories WHERE code = 'material' LIMIT 1;

    -- Do not swallow mirrored expense failures: proposal completion must roll back
    -- rather than leaving income rows without the matching material expense row.
    INSERT INTO financial_transactions (
      direction, proposal_id, expense_category_id,
      amount_original, original_currency, amount_try, exchange_rate,
      has_invoice, input_vat, vat_rate,
      transaction_date, customer_id, site_id, payment_method,
      created_at, updated_at
    ) VALUES (
      'expense', NEW.id, v_expense_category_id,
      v_cogs_usd, 'USD', v_cogs_try, v_rate,
      true, v_input_vat, v_vat_rate,
      v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
      now(), now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- REVERT
-- CREATE OR REPLACE FUNCTION fn_save_proposal_package(
--   p_proposal_id UUID DEFAULT NULL,
--   p_proposal JSONB DEFAULT '{}'::jsonb,
--   p_sections JSONB DEFAULT '[]'::jsonb,
--   p_items JSONB DEFAULT '[]'::jsonb,
--   p_annual_fixed_costs JSONB DEFAULT '[]'::jsonb
-- )
-- RETURNS UUID
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $revert_fn_save$
-- DECLARE
--   v_role             TEXT;
--   v_proposal_id      UUID;
--   v_now              TIMESTAMPTZ := now();
--   v_currency         TEXT;
--   v_total_amount     NUMERIC(12,2) := 0;
--   v_total_amount_usd NUMERIC(12,2) := 0;
-- BEGIN
--   v_role := get_my_role();
--   IF v_role IS NULL OR v_role NOT IN ('admin', 'accountant') THEN
--     RAISE EXCEPTION 'Unauthorized: role % cannot save proposal package', v_role;
--   END IF;
--
--   IF jsonb_typeof(COALESCE(p_proposal, '{}'::jsonb)) <> 'object' THEN
--     RAISE EXCEPTION 'p_proposal must be a JSON object';
--   END IF;
--
--   IF jsonb_typeof(COALESCE(p_sections, '[]'::jsonb)) <> 'array' THEN
--     RAISE EXCEPTION 'p_sections must be a JSON array';
--   END IF;
--
--   IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
--     RAISE EXCEPTION 'p_items must be a JSON array';
--   END IF;
--
--   IF jsonb_typeof(COALESCE(p_annual_fixed_costs, '[]'::jsonb)) <> 'array' THEN
--     RAISE EXCEPTION 'p_annual_fixed_costs must be a JSON array';
--   END IF;
--
--   v_currency := UPPER(COALESCE(NULLIF(p_proposal->>'currency', ''), 'USD'));
--   IF v_currency NOT IN ('TRY', 'USD') THEN
--     RAISE EXCEPTION 'Unsupported proposal currency %', v_currency;
--   END IF;
--
--   IF p_proposal_id IS NULL THEN
--     INSERT INTO proposals (
--       proposal_no,
--       site_id,
--       title,
--       notes,
--       scope_of_work,
--       currency,
--       total_amount,
--       total_amount_usd,
--       status,
--       created_by,
--       proposal_date,
--       survey_date,
--       authorized_person,
--       installation_date,
--       customer_representative,
--       completion_date,
--       terms_engineering,
--       terms_pricing,
--       terms_warranty,
--       terms_other,
--       terms_attachments,
--       vat_rate,
--       has_tevkifat
--     ) VALUES (
--       generate_proposal_no(),
--       NULLIF(p_proposal->>'site_id', '')::uuid,
--       COALESCE(p_proposal->>'title', ''),
--       NULLIF(p_proposal->>'notes', ''),
--       NULLIF(p_proposal->>'scope_of_work', ''),
--       v_currency,
--       0,
--       0,
--       COALESCE(NULLIF(p_proposal->>'status', ''), 'draft'),
--       auth.uid(),
--       NULLIF(p_proposal->>'proposal_date', '')::date,
--       NULLIF(p_proposal->>'survey_date', '')::date,
--       NULLIF(p_proposal->>'authorized_person', ''),
--       NULLIF(p_proposal->>'installation_date', '')::date,
--       NULLIF(p_proposal->>'customer_representative', ''),
--       NULLIF(p_proposal->>'completion_date', '')::date,
--       NULLIF(p_proposal->>'terms_engineering', ''),
--       NULLIF(p_proposal->>'terms_pricing', ''),
--       NULLIF(p_proposal->>'terms_warranty', ''),
--       NULLIF(p_proposal->>'terms_other', ''),
--       NULLIF(p_proposal->>'terms_attachments', ''),
--       COALESCE(NULLIF(p_proposal->>'vat_rate', '')::numeric, 0),
--       COALESCE(NULLIF(p_proposal->>'has_tevkifat', '')::boolean, false)
--     )
--     RETURNING id INTO v_proposal_id;
--   ELSE
--     UPDATE proposals
--     SET
--       site_id = NULLIF(p_proposal->>'site_id', '')::uuid,
--       title = COALESCE(p_proposal->>'title', title),
--       notes = NULLIF(p_proposal->>'notes', ''),
--       scope_of_work = NULLIF(p_proposal->>'scope_of_work', ''),
--       currency = v_currency,
--       status = COALESCE(NULLIF(p_proposal->>'status', ''), status),
--       proposal_date = NULLIF(p_proposal->>'proposal_date', '')::date,
--       survey_date = NULLIF(p_proposal->>'survey_date', '')::date,
--       authorized_person = NULLIF(p_proposal->>'authorized_person', ''),
--       installation_date = NULLIF(p_proposal->>'installation_date', '')::date,
--       customer_representative = NULLIF(p_proposal->>'customer_representative', ''),
--       completion_date = NULLIF(p_proposal->>'completion_date', '')::date,
--       terms_engineering = NULLIF(p_proposal->>'terms_engineering', ''),
--       terms_pricing = NULLIF(p_proposal->>'terms_pricing', ''),
--       terms_warranty = NULLIF(p_proposal->>'terms_warranty', ''),
--       terms_other = NULLIF(p_proposal->>'terms_other', ''),
--       terms_attachments = NULLIF(p_proposal->>'terms_attachments', ''),
--       vat_rate = COALESCE(NULLIF(p_proposal->>'vat_rate', '')::numeric, 0),
--       has_tevkifat = COALESCE(NULLIF(p_proposal->>'has_tevkifat', '')::boolean, false),
--       total_amount = 0,
--       total_amount_usd = 0,
--       updated_at = v_now
--     WHERE id = p_proposal_id
--       AND deleted_at IS NULL
--     RETURNING id INTO v_proposal_id;
--
--     IF NOT FOUND THEN
--       RAISE EXCEPTION 'Proposal % not found or deleted', p_proposal_id;
--     END IF;
--   END IF;
--
--   CREATE TEMP TABLE tmp_proposal_section_input (
--     local_id TEXT,
--     title TEXT,
--     discount_percent NUMERIC(5,2),
--     sort_order INTEGER
--   ) ON COMMIT DROP;
--
--   INSERT INTO tmp_proposal_section_input (local_id, title, discount_percent, sort_order)
--   SELECT
--     NULLIF(local_id, ''),
--     COALESCE(title, ''),
--     LEAST(GREATEST(COALESCE(discount_percent, 0), 0), 100),
--     sort_order
--   FROM jsonb_to_recordset(COALESCE(p_sections, '[]'::jsonb)) AS s(
--     local_id TEXT,
--     title TEXT,
--     discount_percent NUMERIC,
--     sort_order INTEGER
--   );
--
--   CREATE TEMP TABLE tmp_proposal_section_map (
--     local_id TEXT,
--     section_id UUID
--   ) ON COMMIT DROP;
--
--   DELETE FROM proposal_items WHERE proposal_id = v_proposal_id;
--   DELETE FROM proposal_sections WHERE proposal_id = v_proposal_id;
--   DELETE FROM proposal_annual_fixed_costs WHERE proposal_id = v_proposal_id;
--
--   WITH inserted_sections AS (
--     INSERT INTO proposal_sections (
--       proposal_id,
--       title,
--       sort_order,
--       discount_percent
--     )
--     SELECT
--       v_proposal_id,
--       title,
--       sort_order,
--       discount_percent
--     FROM tmp_proposal_section_input
--     ORDER BY sort_order
--     RETURNING id, sort_order
--   )
--   INSERT INTO tmp_proposal_section_map (local_id, section_id)
--   SELECT tsi.local_id, ins.id
--   FROM inserted_sections ins
--   JOIN tmp_proposal_section_input tsi
--     ON tsi.sort_order = ins.sort_order;
--
--   INSERT INTO proposal_items (
--     proposal_id,
--     sort_order,
--     section_id,
--     description,
--     quantity,
--     unit,
--     unit_price,
--     unit_price_usd,
--     material_id,
--     cost,
--     cost_usd,
--     margin_percent,
--     product_cost,
--     product_cost_usd,
--     labor_cost,
--     labor_cost_usd,
--     shipping_cost,
--     shipping_cost_usd,
--     material_cost,
--     material_cost_usd,
--     misc_cost,
--     misc_cost_usd
--   )
--   SELECT
--     v_proposal_id,
--     i.sort_order,
--     sm.section_id,
--     COALESCE(NULLIF(BTRIM(i.description), ''), '—'),
--     COALESCE(NULLIF(i.quantity, 0), 1),
--     COALESCE(NULLIF(BTRIM(i.unit), ''), 'adet'),
--     i.unit_price,
--     i.unit_price_usd,
--     i.material_id,
--     i.cost,
--     i.cost_usd,
--     i.margin_percent,
--     i.product_cost,
--     i.product_cost_usd,
--     i.labor_cost,
--     i.labor_cost_usd,
--     i.shipping_cost,
--     i.shipping_cost_usd,
--     i.material_cost,
--     i.material_cost_usd,
--     i.misc_cost,
--     i.misc_cost_usd
--   FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS i(
--     sort_order INTEGER,
--     section_local_id TEXT,
--     description TEXT,
--     quantity NUMERIC,
--     unit TEXT,
--     unit_price NUMERIC,
--     unit_price_usd NUMERIC,
--     material_id UUID,
--     cost NUMERIC,
--     cost_usd NUMERIC,
--     margin_percent NUMERIC,
--     product_cost NUMERIC,
--     product_cost_usd NUMERIC,
--     labor_cost NUMERIC,
--     labor_cost_usd NUMERIC,
--     shipping_cost NUMERIC,
--     shipping_cost_usd NUMERIC,
--     material_cost NUMERIC,
--     material_cost_usd NUMERIC,
--     misc_cost NUMERIC,
--     misc_cost_usd NUMERIC
--   )
--   LEFT JOIN tmp_proposal_section_map sm
--     ON sm.local_id = NULLIF(i.section_local_id, '')
--   ORDER BY i.sort_order;
--
--   INSERT INTO proposal_annual_fixed_costs (
--     proposal_id,
--     sort_order,
--     description,
--     quantity,
--     unit,
--     unit_price,
--     currency
--   )
--   SELECT
--     v_proposal_id,
--     af.sort_order,
--     BTRIM(af.description),
--     COALESCE(NULLIF(af.quantity, 0), 1),
--     COALESCE(NULLIF(BTRIM(af.unit), ''), 'adet'),
--     COALESCE(af.unit_price, 0),
--     COALESCE(NULLIF(UPPER(af.currency), ''), 'TRY')
--   FROM jsonb_to_recordset(COALESCE(p_annual_fixed_costs, '[]'::jsonb)) AS af(
--     sort_order INTEGER,
--     description TEXT,
--     quantity NUMERIC,
--     unit TEXT,
--     unit_price NUMERIC,
--     currency TEXT
--   )
--   WHERE LENGTH(BTRIM(COALESCE(af.description, ''))) > 0
--   ORDER BY af.sort_order;
--
--   WITH section_subtotals AS (
--     SELECT
--       COALESCE(ps.discount_percent, 0) AS discount_percent,
--       COALESCE(SUM(
--         CASE
--           WHEN v_currency = 'USD' THEN COALESCE(NULLIF(pi.total_usd, 0), COALESCE(pi.unit_price_usd, 0) * COALESCE(pi.quantity, 0))
--           ELSE COALESCE(NULLIF(pi.line_total, 0), COALESCE(pi.unit_price, 0) * COALESCE(pi.quantity, 0))
--         END
--       ), 0) AS subtotal
--     FROM proposal_sections ps
--     LEFT JOIN proposal_items pi
--       ON pi.section_id = ps.id
--     WHERE ps.proposal_id = v_proposal_id
--     GROUP BY ps.id, ps.discount_percent
--   ),
--   ungrouped_subtotal AS (
--     SELECT
--       COALESCE(SUM(
--         CASE
--           WHEN v_currency = 'USD' THEN COALESCE(NULLIF(pi.total_usd, 0), COALESCE(pi.unit_price_usd, 0) * COALESCE(pi.quantity, 0))
--           ELSE COALESCE(NULLIF(pi.line_total, 0), COALESCE(pi.unit_price, 0) * COALESCE(pi.quantity, 0))
--         END
--       ), 0) AS subtotal
--     FROM proposal_items pi
--     WHERE pi.proposal_id = v_proposal_id
--       AND pi.section_id IS NULL
--   )
--   SELECT
--     CASE WHEN v_currency = 'USD' THEN 0 ELSE COALESCE(ROUND(SUM(section_total), 2), 0) END,
--     CASE WHEN v_currency = 'USD' THEN COALESCE(ROUND(SUM(section_total), 2), 0) ELSE 0 END
--   INTO v_total_amount, v_total_amount_usd
--   FROM (
--     SELECT ROUND(subtotal - ROUND(subtotal * LEAST(GREATEST(discount_percent, 0), 100) / 100, 2), 2) AS section_total
--     FROM section_subtotals
--     UNION ALL
--     SELECT ROUND(subtotal, 2) AS section_total
--     FROM ungrouped_subtotal
--   ) totals;
--
--   UPDATE proposals
--   SET
--     total_amount = v_total_amount,
--     total_amount_usd = v_total_amount_usd,
--     updated_at = v_now
--   WHERE id = v_proposal_id;
--
--   RETURN v_proposal_id;
-- END;
-- $revert_fn_save$;
--
-- GRANT EXECUTE ON FUNCTION fn_save_proposal_package(UUID, JSONB, JSONB, JSONB, JSONB) TO authenticated;
--
-- CREATE OR REPLACE FUNCTION auto_record_proposal_revenue()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $revert_auto_record$
-- DECLARE
--   v_customer_id         UUID;
--   v_site_id             UUID;
--   v_currency            TEXT;
--   v_total_usd           DECIMAL(12,2);
--   v_cogs_usd            DECIMAL(12,2) := 0;
--   v_rate                DECIMAL(10,4);
--   v_amount_try          DECIMAL(12,2);
--   v_cogs_try            DECIMAL(12,2);
--   v_revenue_try         DECIMAL(12,2);
--   v_cogs_total_try      DECIMAL(12,2) := 0;
--   v_vat_rate            DECIMAL(5,2);
--   v_output_vat          DECIMAL(12,2);
--   v_input_vat           DECIMAL(12,2);
--   v_net_income          DECIMAL(12,2);
--   v_item                RECORD;
--   v_has_detail          BOOLEAN;
--   v_item_cogs           DECIMAL(12,2);
--   v_expense_category_id UUID;
--   v_transaction_date    DATE;
-- BEGIN
--   IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
--     RETURN NEW;
--   END IF;
--
--   SELECT COALESCE(SUM(amount_try), 0)
--   INTO v_net_income
--   FROM financial_transactions
--   WHERE proposal_id = NEW.id
--     AND direction   = 'income'
--     AND deleted_at  IS NULL;
--   IF v_net_income > 0 THEN RETURN NEW; END IF;
--
--   v_currency := UPPER(COALESCE(NEW.currency, 'USD'));
--   v_vat_rate := COALESCE(NEW.vat_rate, 20);
--   v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);
--
--   IF v_currency = 'TRY' THEN
--     v_revenue_try := ROUND(COALESCE(NEW.total_amount, 0), 2);
--     IF v_revenue_try <= 0 OR NEW.site_id IS NULL THEN
--       RETURN NEW;
--     END IF;
--
--     SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
--     FROM customer_sites cs WHERE cs.id = NEW.site_id;
--     IF v_site_id IS NULL THEN RETURN NEW; END IF;
--
--     FOR v_item IN
--       SELECT pi.quantity, pi.cost,
--              pi.product_cost, pi.labor_cost,
--              pi.material_cost, pi.shipping_cost, pi.misc_cost
--       FROM proposal_items pi
--       WHERE pi.proposal_id = NEW.id
--     LOOP
--       v_has_detail :=
--         (v_item.product_cost  IS NOT NULL AND v_item.product_cost  <> 0) OR
--         (v_item.labor_cost    IS NOT NULL AND v_item.labor_cost    <> 0) OR
--         (v_item.material_cost IS NOT NULL AND v_item.material_cost <> 0) OR
--         (v_item.shipping_cost IS NOT NULL AND v_item.shipping_cost <> 0) OR
--         (v_item.misc_cost     IS NOT NULL AND v_item.misc_cost     <> 0);
--
--       IF v_has_detail THEN
--         v_item_cogs :=
--           COALESCE(v_item.product_cost,  0) +
--           COALESCE(v_item.labor_cost,    0) +
--           COALESCE(v_item.material_cost, 0) +
--           COALESCE(v_item.shipping_cost, 0) +
--           COALESCE(v_item.misc_cost,     0);
--       ELSE
--         v_item_cogs := COALESCE(v_item.cost, 0);
--       END IF;
--
--       v_cogs_total_try := v_cogs_total_try + (v_item_cogs * COALESCE(v_item.quantity, 1));
--     END LOOP;
--
--     IF v_cogs_total_try = 0 THEN
--       v_cogs_total_try := COALESCE(NEW.cost_usd, 0);
--     END IF;
--
--     v_output_vat := ROUND(v_revenue_try * v_vat_rate / 100, 2);
--     v_input_vat  := CASE WHEN v_cogs_total_try > 0
--                          THEN ROUND(v_cogs_total_try * v_vat_rate / 100, 2)
--                          ELSE NULL END;
--
--     BEGIN
--       INSERT INTO financial_transactions (
--         direction, income_type, proposal_id,
--         amount_original, original_currency, amount_try, exchange_rate,
--         cogs_try, should_invoice, output_vat, vat_rate,
--         transaction_date, customer_id, site_id, payment_method,
--         service_category,
--         payment_status,
--         created_at, updated_at
--       ) VALUES (
--         'income', 'sale', NEW.id,
--         v_revenue_try, 'TRY', v_revenue_try, NULL,
--         CASE WHEN v_cogs_total_try > 0 THEN v_cogs_total_try ELSE NULL END,
--         true, v_output_vat, v_vat_rate,
--         v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--         'montaj',
--         'unpaid',
--         now(), now()
--       );
--     EXCEPTION WHEN OTHERS THEN
--       RAISE WARNING 'auto_record_proposal_revenue (income TRY) failed for proposal %: %', NEW.id, SQLERRM;
--       RETURN NEW;
--     END;
--
--     IF v_cogs_total_try > 0 THEN
--       SELECT id INTO v_expense_category_id
--       FROM expense_categories WHERE code = 'material' LIMIT 1;
--
--       BEGIN
--         INSERT INTO financial_transactions (
--           direction, proposal_id, expense_category_id,
--           amount_original, original_currency, amount_try, exchange_rate,
--           has_invoice, input_vat, vat_rate,
--           transaction_date, customer_id, site_id, payment_method,
--           created_at, updated_at
--         ) VALUES (
--           'expense', NEW.id, v_expense_category_id,
--           v_cogs_total_try, 'TRY', v_cogs_total_try, NULL,
--           true, v_input_vat, v_vat_rate,
--           v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--           now(), now()
--         );
--       EXCEPTION WHEN OTHERS THEN
--         RAISE WARNING 'auto_record_proposal_revenue (COGS TRY) failed for proposal %: %', NEW.id, SQLERRM;
--       END;
--     END IF;
--
--     RETURN NEW;
--   END IF;
--
--   v_total_usd := COALESCE(NEW.total_amount_usd, 0);
--   IF v_total_usd <= 0 OR NEW.site_id IS NULL THEN
--     RETURN NEW;
--   END IF;
--
--   SELECT cs.customer_id, NEW.site_id INTO v_customer_id, v_site_id
--   FROM customer_sites cs WHERE cs.id = NEW.site_id;
--   IF v_site_id IS NULL THEN RETURN NEW; END IF;
--
--   FOR v_item IN
--     SELECT pi.quantity, pi.cost_usd,
--            pi.product_cost_usd, pi.labor_cost_usd,
--            pi.material_cost_usd, pi.shipping_cost_usd, pi.misc_cost_usd
--     FROM proposal_items pi
--     WHERE pi.proposal_id = NEW.id
--   LOOP
--     v_has_detail :=
--       (v_item.product_cost_usd  IS NOT NULL AND v_item.product_cost_usd  <> 0) OR
--       (v_item.labor_cost_usd    IS NOT NULL AND v_item.labor_cost_usd    <> 0) OR
--       (v_item.material_cost_usd IS NOT NULL AND v_item.material_cost_usd <> 0) OR
--       (v_item.shipping_cost_usd IS NOT NULL AND v_item.shipping_cost_usd <> 0) OR
--       (v_item.misc_cost_usd     IS NOT NULL AND v_item.misc_cost_usd     <> 0);
--
--     IF v_has_detail THEN
--       v_item_cogs :=
--         COALESCE(v_item.product_cost_usd,  0) +
--         COALESCE(v_item.labor_cost_usd,    0) +
--         COALESCE(v_item.material_cost_usd, 0) +
--         COALESCE(v_item.shipping_cost_usd, 0) +
--         COALESCE(v_item.misc_cost_usd,     0);
--     ELSE
--       v_item_cogs := COALESCE(v_item.cost_usd, 0);
--     END IF;
--
--     v_cogs_usd := v_cogs_usd + (v_item_cogs * COALESCE(v_item.quantity, 1));
--   END LOOP;
--
--   IF v_cogs_usd = 0 THEN
--     v_cogs_usd := COALESCE(NEW.cost_usd, 0);
--   END IF;
--
--   IF NEW.completion_exchange_rate IS NOT NULL AND NEW.completion_exchange_rate > 0 THEN
--     v_rate := NEW.completion_exchange_rate;
--   ELSE
--     SELECT effective_rate INTO v_rate
--     FROM exchange_rates
--     WHERE currency = 'USD'
--       AND rate_date <= v_transaction_date
--     ORDER BY rate_date DESC
--     LIMIT 1;
--
--     IF v_rate IS NULL OR v_rate = 0 THEN
--       RAISE WARNING
--         'auto_record_proposal_revenue: no USD rate on or before % for proposal %. '
--         'Finance entry skipped.',
--         v_transaction_date, NEW.id;
--       RETURN NEW;
--     END IF;
--   END IF;
--
--   v_amount_try := ROUND(v_total_usd * v_rate, 2);
--   v_cogs_try   := CASE WHEN v_cogs_usd > 0 THEN ROUND(v_cogs_usd * v_rate, 2) ELSE NULL END;
--   v_output_vat := ROUND(v_amount_try * v_vat_rate / 100, 2);
--   v_input_vat  := CASE WHEN v_cogs_try IS NOT NULL AND v_cogs_try > 0
--                        THEN ROUND(v_cogs_try * v_vat_rate / 100, 2)
--                        ELSE NULL END;
--
--   BEGIN
--     INSERT INTO financial_transactions (
--       direction, income_type, proposal_id,
--       amount_original, original_currency, amount_try, exchange_rate,
--       cogs_try, should_invoice, output_vat, vat_rate,
--       transaction_date, customer_id, site_id, payment_method,
--       service_category,
--       payment_status,
--       created_at, updated_at
--     ) VALUES (
--       'income', 'sale', NEW.id,
--       v_total_usd, 'USD', v_amount_try, v_rate,
--       v_cogs_try, true, v_output_vat, v_vat_rate,
--       v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--       'montaj',
--       'unpaid',
--       now(), now()
--     );
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'auto_record_proposal_revenue (income USD) failed for proposal %: %', NEW.id, SQLERRM;
--     RETURN NEW;
--   END;
--
--   IF v_cogs_try IS NOT NULL AND v_cogs_try > 0 THEN
--     SELECT id INTO v_expense_category_id
--     FROM expense_categories WHERE code = 'material' LIMIT 1;
--
--     BEGIN
--       INSERT INTO financial_transactions (
--         direction, proposal_id, expense_category_id,
--         amount_original, original_currency, amount_try, exchange_rate,
--         has_invoice, input_vat, vat_rate,
--         transaction_date, customer_id, site_id, payment_method,
--         created_at, updated_at
--       ) VALUES (
--         'expense', NEW.id, v_expense_category_id,
--         v_cogs_usd, 'USD', v_cogs_try, v_rate,
--         true, v_input_vat, v_vat_rate,
--         v_transaction_date, v_customer_id, v_site_id, 'bank_transfer',
--         now(), now()
--       );
--     EXCEPTION WHEN OTHERS THEN
--       RAISE WARNING 'auto_record_proposal_revenue (COGS USD) failed for proposal %: %', NEW.id, SQLERRM;
--     END;
--   END IF;
--
--   RETURN NEW;
-- END;
-- $revert_auto_record$;
--
-- ALTER TABLE proposal_items DROP CONSTRAINT IF EXISTS proposal_items_revenue_type_check;
-- ALTER TABLE proposal_items DROP COLUMN IF EXISTS revenue_type;
