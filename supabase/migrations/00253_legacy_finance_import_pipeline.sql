-- 00253_legacy_finance_import_pipeline.sql
--
-- Audited staging and idempotent posting for the 2026 legacy finance ledger.
-- Each source line posts one income row and, when COGS is positive, one linked
-- material expense row. This matches the existing finance ledger contract:
-- revenue retains cogs_try for collection reporting while P&L and input VAT
-- derive from the paired expense row.

BEGIN;

-- Legacy rows whose collection state is not known must not become receivables
-- or be treated as paid. They remain accrual ledger entries until resolved.
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_payment_status_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_payment_status_check
  CHECK (payment_status = ANY (ARRAY['unpaid', 'partial', 'paid', 'unknown']));

COMMENT ON COLUMN public.financial_transactions.payment_status IS
  'Collection state: paid, unpaid, partial, or unknown. Unknown is excluded from receivables and collection views.';

-- Only legacy references are protected, avoiding a behavioral change for
-- existing non-legacy records while making a rerun idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_legacy_reference_unique
  ON public.financial_transactions (reference_no)
  WHERE deleted_at IS NULL
    AND reference_no LIKE 'LEGACY-%';

CREATE TABLE public.finance_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key TEXT NOT NULL UNIQUE,
  source_file_name TEXT NOT NULL,
  mapping_file_name TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  mapping_checksum TEXT NOT NULL,
  source_row_count INTEGER NOT NULL CHECK (source_row_count > 0),
  status TEXT NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'reviewed', 'posted', 'failed')),
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  posting_summary JSONB,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE TABLE public.customer_import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.finance_import_batches(id) ON DELETE RESTRICT,
  customer_raw TEXT NOT NULL,
  matched_customer_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'ambiguous')),
  match_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, customer_raw)
);

CREATE TABLE public.finance_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.finance_import_batches(id) ON DELETE RESTRICT,
  source_row INTEGER NOT NULL CHECK (source_row > 0),
  transaction_date DATE NOT NULL,
  customer_raw TEXT NOT NULL,
  matched_customer_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  income_type TEXT NOT NULL,
  service_category public.service_category_enum NOT NULL,
  amount_try NUMERIC(14,2) NOT NULL CHECK (amount_try >= 0),
  cogs_try NUMERIC(14,2) NOT NULL CHECK (cogs_try >= 0),
  input_vat NUMERIC(14,2) NOT NULL CHECK (input_vat >= 0),
  output_vat NUMERIC(14,2) NOT NULL CHECK (output_vat >= 0),
  collection_status TEXT NOT NULL CHECK (collection_status IN ('collected', 'unknown')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),
  payment_date DATE,
  source_note TEXT,
  donem_raw TEXT NOT NULL,
  isin_cinsi_raw TEXT NOT NULL,
  toplam_raw NUMERIC(14,2) NOT NULL,
  kar_raw NUMERIC(14,2) NOT NULL,
  kdv_raw NUMERIC(14,2) NOT NULL,
  raw_payload JSONB NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(validation_errors) = 'array'),
  row_status TEXT NOT NULL DEFAULT 'staged'
    CHECK (row_status IN ('staged', 'reviewed', 'posted', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source_row)
);

CREATE TABLE public.finance_import_transaction_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.finance_import_batches(id) ON DELETE RESTRICT,
  import_row_id UUID NOT NULL REFERENCES public.finance_import_rows(id) ON DELETE RESTRICT,
  income_transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  cogs_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.financial_transaction_payments(id) ON DELETE SET NULL,
  income_reference_no TEXT NOT NULL,
  cogs_reference_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_row_id),
  UNIQUE (income_transaction_id),
  UNIQUE (cogs_transaction_id),
  UNIQUE (income_reference_no),
  UNIQUE (cogs_reference_no)
);

CREATE INDEX idx_customer_import_mappings_batch ON public.customer_import_mappings (batch_id);
CREATE INDEX idx_customer_import_mappings_customer ON public.customer_import_mappings (customer_id);
CREATE INDEX idx_finance_import_rows_batch ON public.finance_import_rows (batch_id, source_row);
CREATE INDEX idx_finance_import_rows_customer ON public.finance_import_rows (customer_id);
CREATE INDEX idx_finance_import_links_batch ON public.finance_import_transaction_links (batch_id);

ALTER TABLE public.finance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_import_transaction_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_import_batches_select ON public.finance_import_batches
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'accountant'));

CREATE POLICY customer_import_mappings_select ON public.customer_import_mappings
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'accountant'));

CREATE POLICY finance_import_rows_select ON public.finance_import_rows
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'accountant'));

CREATE POLICY finance_import_transaction_links_select ON public.finance_import_transaction_links
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'accountant'));

GRANT SELECT ON public.finance_import_batches TO authenticated;
GRANT SELECT ON public.customer_import_mappings TO authenticated;
GRANT SELECT ON public.finance_import_rows TO authenticated;
GRANT SELECT ON public.finance_import_transaction_links TO authenticated;
GRANT ALL ON public.finance_import_batches TO service_role;
GRANT ALL ON public.customer_import_mappings TO service_role;
GRANT ALL ON public.finance_import_rows TO service_role;
GRANT ALL ON public.finance_import_transaction_links TO service_role;

-- Unknown collection-state rows are ledger entries, not receivables. Keeping
-- them out of these views prevents them from becoming overdue or receiving an
-- accidental collection action.
CREATE OR REPLACE VIEW public.v_collection_documents AS
WITH payment_totals AS (
  SELECT
    ftp.transaction_id,
    COALESCE(SUM(COALESCE(ftp.amount, ftp.amount_try)), 0) AS total_collected
  FROM public.financial_transaction_payments ftp
  WHERE ftp.deleted_at IS NULL
  GROUP BY ftp.transaction_id
)
SELECT
  ft.id AS transaction_id,
  c.id AS customer_id,
  c.company_name AS customer_name,
  ft.service_category,
  ft.income_type,
  ft.transaction_date,
  ft.description,
  ft.amount_try AS sale_price_net,
  ft.output_vat AS vat_amount,
  ft.amount_try + COALESCE(ft.output_vat, 0) AS total_with_vat,
  ft.cogs_try AS cost,
  ft.amount_try - COALESCE(ft.cogs_try, 0) AS profit,
  ft.original_currency,
  ft.amount_original,
  ft.payment_status,
  COALESCE(pt.total_collected, 0) AS total_collected,
  (ft.amount_try + COALESCE(ft.output_vat, 0)) - COALESCE(pt.total_collected, 0) AS remaining,
  ft.work_order_id,
  ft.proposal_id,
  ft.subscription_payment_id,
  ft.created_at
FROM public.financial_transactions ft
LEFT JOIN public.customers c ON c.id = ft.customer_id
LEFT JOIN payment_totals pt ON pt.transaction_id = ft.id
WHERE ft.direction = 'income'
  AND ft.deleted_at IS NULL
  AND ft.payment_status <> 'unknown'
ORDER BY ft.transaction_date DESC;

CREATE OR REPLACE VIEW public.v_collection_customer_summary AS
WITH payment_totals AS (
  SELECT
    ftp.transaction_id,
    COALESCE(SUM(COALESCE(ftp.amount, ftp.amount_try)), 0) AS total_collected
  FROM public.financial_transaction_payments ftp
  WHERE ftp.deleted_at IS NULL
  GROUP BY ftp.transaction_id
),
income_docs AS (
  SELECT
    ft.id,
    ft.customer_id,
    ft.amount_try,
    ft.output_vat,
    ft.cogs_try,
    ft.payment_status,
    COALESCE(pt.total_collected, 0) AS total_collected
  FROM public.financial_transactions ft
  LEFT JOIN payment_totals pt ON pt.transaction_id = ft.id
  WHERE ft.direction = 'income'
    AND ft.deleted_at IS NULL
    AND ft.payment_status <> 'unknown'
),
customer_agg AS (
  SELECT
    customer_id,
    COUNT(id) AS document_count,
    COALESCE(SUM(amount_try + COALESCE(output_vat, 0)), 0) AS total_billed,
    COALESCE(SUM(output_vat), 0) AS total_vat,
    COALESCE(SUM(cogs_try), 0) AS total_cost,
    COALESCE(SUM(total_collected), 0) AS total_collected,
    COALESCE(SUM((amount_try + COALESCE(output_vat, 0)) - total_collected), 0) AS outstanding,
    COUNT(id) FILTER (WHERE payment_status = 'unpaid') AS unpaid_count,
    COUNT(id) FILTER (WHERE payment_status = 'partial') AS partial_count,
    COUNT(id) FILTER (WHERE payment_status = 'paid') AS paid_count,
    COALESCE(SUM(amount_try - COALESCE(cogs_try, 0)), 0) AS total_profit
  FROM income_docs
  GROUP BY customer_id
)
SELECT
  c.id AS customer_id,
  c.company_name AS customer_name,
  ca.document_count,
  ca.total_billed,
  ca.total_vat,
  ca.total_cost,
  ca.total_collected,
  ca.outstanding,
  ca.unpaid_count,
  ca.partial_count,
  ca.paid_count,
  ca.total_profit
FROM public.customers c
JOIN customer_agg ca ON ca.customer_id = c.id
WHERE c.deleted_at IS NULL
ORDER BY ca.outstanding DESC;

ALTER VIEW public.v_collection_documents SET (security_invoker = true);
ALTER VIEW public.v_collection_customer_summary SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.post_finance_import_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.finance_import_batches%ROWTYPE;
  v_material_category_id UUID;
  v_row_count INTEGER;
  v_collected_count INTEGER;
  v_unknown_count INTEGER;
  v_zero_gross_collected_count INTEGER;
  v_expected_payment_count INTEGER;
  v_income_transaction_count INTEGER;
  v_cogs_transaction_count INTEGER;
  v_link_count INTEGER;
  v_payment_count INTEGER;
  v_total_net NUMERIC(14,2);
  v_total_output_vat NUMERIC(14,2);
  v_total_input_vat NUMERIC(14,2);
  v_total_cogs NUMERIC(14,2);
  v_total_gross NUMERIC(14,2);
  v_collected_gross NUMERIC(14,2);
  v_summary JSONB;
BEGIN
  SELECT *
  INTO v_batch
  FROM public.finance_import_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'finance_import_batch_not_found: %', p_batch_id;
  END IF;

  IF v_batch.status = 'posted' THEN
    RETURN jsonb_build_object(
      'status', 'already_posted',
      'batch_id', v_batch.id,
      'summary', COALESCE(v_batch.posting_summary, '{}'::jsonb)
    );
  END IF;

  IF v_batch.status <> 'reviewed' THEN
    RAISE EXCEPTION 'finance_import_batch_not_reviewed: %', v_batch.status;
  END IF;

  SELECT id
  INTO v_material_category_id
  FROM public.expense_categories
  WHERE code = 'material'
    AND is_active = true
  ORDER BY sort_order, id
  LIMIT 1;

  IF v_material_category_id IS NULL THEN
    RAISE EXCEPTION 'finance_import_material_expense_category_not_found';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE collection_status = 'collected'),
    COUNT(*) FILTER (WHERE collection_status = 'unknown'),
    COUNT(*) FILTER (
      WHERE collection_status = 'collected'
        AND amount_try + output_vat = 0
    ),
    COUNT(*) FILTER (
      WHERE collection_status = 'collected'
        AND amount_try + output_vat > 0
    ),
    COALESCE(SUM(amount_try), 0),
    COALESCE(SUM(output_vat), 0),
    COALESCE(SUM(input_vat), 0),
    COALESCE(SUM(cogs_try), 0),
    COALESCE(SUM(amount_try + output_vat), 0),
    COALESCE(SUM(amount_try + output_vat) FILTER (WHERE collection_status = 'collected'), 0)
  INTO
    v_row_count,
    v_collected_count,
    v_unknown_count,
    v_zero_gross_collected_count,
    v_expected_payment_count,
    v_total_net,
    v_total_output_vat,
    v_total_input_vat,
    v_total_cogs,
    v_total_gross,
    v_collected_gross
  FROM public.finance_import_rows
  WHERE batch_id = p_batch_id;

  IF v_row_count <> v_batch.source_row_count THEN
    RAISE EXCEPTION 'finance_import_row_count_mismatch: expected %, found %',
      v_batch.source_row_count,
      v_row_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_import_rows r
    LEFT JOIN public.customer_import_mappings m
      ON m.batch_id = r.batch_id
     AND m.customer_raw = r.customer_raw
    LEFT JOIN public.customers c
      ON c.id = r.customer_id
     AND c.deleted_at IS NULL
    WHERE r.batch_id = p_batch_id
      AND (
        r.row_status <> 'reviewed'
        OR r.customer_id IS NULL
        OR c.id IS NULL
        OR c.company_name_search <> public.normalize_tr_for_search(r.matched_customer_name)
        OR m.match_status <> 'matched'
        OR m.customer_id IS DISTINCT FROM r.customer_id
        OR r.matched_customer_name IS DISTINCT FROM m.matched_customer_name
        OR jsonb_array_length(r.validation_errors) > 0
      )
  ) THEN
    RAISE EXCEPTION 'finance_import_unresolved_or_invalid_rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_import_rows r
    WHERE r.batch_id = p_batch_id
      AND (
        ABS((r.amount_try + r.output_vat) - r.toplam_raw) > 0.01
        OR ABS((r.amount_try - r.cogs_try) - r.kar_raw) > 0.01
        OR ABS((r.output_vat - r.input_vat) - r.kdv_raw) > 0.01
        OR (r.collection_status = 'collected' AND r.payment_date IS NULL)
        OR (r.collection_status = 'unknown' AND r.payment_date IS NOT NULL)
        OR (r.cogs_try = 0 AND r.input_vat > 0)
      )
  ) THEN
    RAISE EXCEPTION 'finance_import_reconciliation_or_collection_validation_failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_import_rows r
    JOIN public.financial_transactions ft
      ON ft.deleted_at IS NULL
     AND (
       ft.reference_no = format('LEGACY-2026-%s', r.source_row)
       OR (
         r.cogs_try > 0
         AND ft.reference_no = format('LEGACY-2026-%s-COGS', r.source_row)
       )
     )
    WHERE r.batch_id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'finance_import_legacy_reference_conflict';
  END IF;

  INSERT INTO public.financial_transactions (
    direction,
    income_type,
    amount_original,
    original_currency,
    amount_try,
    exchange_rate,
    should_invoice,
    has_invoice,
    output_vat,
    input_vat,
    vat_rate,
    cogs_try,
    transaction_date,
    customer_id,
    description,
    payment_method,
    reference_no,
    created_by,
    status,
    payment_status,
    service_category,
    parasut_sync_status
  )
  SELECT
    'income',
    r.income_type,
    r.amount_try,
    'TRY',
    r.amount_try,
    NULL,
    TRUE,
    NULL,
    r.output_vat,
    NULL,
    CASE
      WHEN r.amount_try > 0 AND r.output_vat > 0
        THEN ROUND((r.output_vat / r.amount_try) * 100, 2)
      ELSE 0
    END,
    CASE WHEN r.cogs_try > 0 THEN r.cogs_try ELSE NULL END,
    r.transaction_date,
    r.customer_id,
    concat_ws(
      ' | ',
      'Legacy 2026',
      NULLIF(regexp_replace(r.customer_raw, E'[\\r\\n]+', ' ', 'g'), ''),
      NULLIF(regexp_replace(r.source_note, E'[\\r\\n]+', ' ', 'g'), '')
    ),
    r.payment_method,
    format('LEGACY-2026-%s', r.source_row),
    v_batch.created_by,
    'confirmed',
    CASE WHEN r.collection_status = 'collected' THEN 'paid' ELSE 'unknown' END,
    r.service_category,
    'not_required'
  FROM public.finance_import_rows r
  WHERE r.batch_id = p_batch_id
  ORDER BY r.source_row;

  GET DIAGNOSTICS v_income_transaction_count = ROW_COUNT;

  IF v_income_transaction_count <> v_row_count THEN
    RAISE EXCEPTION 'finance_import_income_transaction_count_mismatch: expected %, inserted %',
      v_row_count,
      v_income_transaction_count;
  END IF;

  INSERT INTO public.finance_import_transaction_links (
    batch_id,
    import_row_id,
    income_transaction_id,
    income_reference_no
  )
  SELECT
    p_batch_id,
    r.id,
    ft.id,
    ft.reference_no
  FROM public.finance_import_rows r
  JOIN public.financial_transactions ft
    ON ft.reference_no = format('LEGACY-2026-%s', r.source_row)
   AND ft.deleted_at IS NULL
  WHERE r.batch_id = p_batch_id;

  GET DIAGNOSTICS v_link_count = ROW_COUNT;

  IF v_link_count <> v_row_count THEN
    RAISE EXCEPTION 'finance_import_link_count_mismatch: expected %, inserted %',
      v_row_count,
      v_link_count;
  END IF;

  INSERT INTO public.financial_transactions (
    direction,
    amount_original,
    original_currency,
    amount_try,
    exchange_rate,
    should_invoice,
    has_invoice,
    output_vat,
    input_vat,
    vat_rate,
    cogs_try,
    transaction_date,
    customer_id,
    description,
    payment_method,
    reference_no,
    expense_category_id,
    created_by,
    status,
    payment_status,
    parasut_sync_status
  )
  SELECT
    'expense',
    r.cogs_try,
    'TRY',
    r.cogs_try,
    NULL,
    NULL,
    TRUE,
    NULL,
    CASE WHEN r.input_vat > 0 THEN r.input_vat ELSE NULL END,
    CASE
      WHEN r.cogs_try > 0 AND r.input_vat > 0
        THEN ROUND((r.input_vat / r.cogs_try) * 100, 2)
      ELSE 0
    END,
    NULL,
    r.transaction_date,
    r.customer_id,
    concat_ws(
      ' | ',
      'Legacy 2026 COGS',
      NULLIF(regexp_replace(r.customer_raw, E'[\\r\\n]+', ' ', 'g'), ''),
      NULLIF(regexp_replace(r.source_note, E'[\\r\\n]+', ' ', 'g'), '')
    ),
    r.payment_method,
    format('LEGACY-2026-%s-COGS', r.source_row),
    v_material_category_id,
    v_batch.created_by,
    'confirmed',
    'paid',
    'not_required'
  FROM public.finance_import_rows r
  WHERE r.batch_id = p_batch_id
    AND r.cogs_try > 0
  ORDER BY r.source_row;

  GET DIAGNOSTICS v_cogs_transaction_count = ROW_COUNT;

  IF v_cogs_transaction_count <> (
    SELECT COUNT(*)
    FROM public.finance_import_rows
    WHERE batch_id = p_batch_id
      AND cogs_try > 0
  ) THEN
    RAISE EXCEPTION 'finance_import_cogs_transaction_count_mismatch';
  END IF;

  UPDATE public.finance_import_transaction_links l
  SET
    cogs_transaction_id = ft.id,
    cogs_reference_no = ft.reference_no
  FROM public.finance_import_rows r
  JOIN public.financial_transactions ft
    ON ft.reference_no = format('LEGACY-2026-%s-COGS', r.source_row)
   AND ft.deleted_at IS NULL
  WHERE l.batch_id = p_batch_id
    AND l.import_row_id = r.id
    AND r.cogs_try > 0;

  GET DIAGNOSTICS v_link_count = ROW_COUNT;

  IF v_link_count <> v_cogs_transaction_count THEN
    RAISE EXCEPTION 'finance_import_cogs_link_count_mismatch: expected %, linked %',
      v_cogs_transaction_count,
      v_link_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_import_rows r
    JOIN public.finance_import_transaction_links l ON l.import_row_id = r.id
    LEFT JOIN public.financial_transactions ft ON ft.id = l.cogs_transaction_id
    WHERE r.batch_id = p_batch_id
      AND (
        (r.cogs_try > 0 AND (
          ft.id IS NULL
          OR ft.direction <> 'expense'
          OR ft.amount_try <> r.cogs_try
          OR COALESCE(ft.input_vat, 0) <> r.input_vat
          OR ft.expense_category_id <> v_material_category_id
        ))
        OR (r.cogs_try = 0 AND l.cogs_transaction_id IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'finance_import_cogs_transaction_validation_failed';
  END IF;

  WITH inserted_payments AS (
    INSERT INTO public.financial_transaction_payments (
      transaction_id,
      amount_try,
      payment_method,
      paid_at,
      notes,
      created_by
    )
    SELECT
      l.income_transaction_id,
      r.amount_try + r.output_vat,
      r.payment_method,
      r.payment_date,
      format('Legacy 2026 import %s', l.income_reference_no),
      v_batch.created_by
    FROM public.finance_import_transaction_links l
    JOIN public.finance_import_rows r ON r.id = l.import_row_id
    WHERE l.batch_id = p_batch_id
      AND r.collection_status = 'collected'
      AND r.amount_try + r.output_vat > 0
    RETURNING id, transaction_id
  )
  UPDATE public.finance_import_transaction_links l
  SET payment_id = p.id
  FROM inserted_payments p
  WHERE l.batch_id = p_batch_id
    AND l.income_transaction_id = p.transaction_id;

  GET DIAGNOSTICS v_payment_count = ROW_COUNT;

  IF v_payment_count <> v_expected_payment_count THEN
    RAISE EXCEPTION 'finance_import_payment_count_mismatch: expected %, inserted %',
      v_expected_payment_count,
      v_payment_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_import_rows r
    JOIN public.finance_import_transaction_links l ON l.import_row_id = r.id
    JOIN public.financial_transactions ft ON ft.id = l.income_transaction_id
    LEFT JOIN public.financial_transaction_payments ftp
      ON ftp.id = l.payment_id
     AND ftp.deleted_at IS NULL
    WHERE r.batch_id = p_batch_id
      AND (
        (r.collection_status = 'collected' AND ft.payment_status <> 'paid')
        OR (r.collection_status = 'unknown' AND ft.payment_status <> 'unknown')
        OR (r.collection_status = 'unknown' AND l.payment_id IS NOT NULL)
        OR (
          r.collection_status = 'collected'
          AND r.amount_try + r.output_vat = 0
          AND l.payment_id IS NOT NULL
        )
        OR (
          r.collection_status = 'collected'
          AND r.amount_try + r.output_vat > 0
          AND (
            ftp.id IS NULL
            OR ftp.amount_try <> r.amount_try + r.output_vat
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'finance_import_payment_status_validation_failed';
  END IF;

  UPDATE public.finance_import_rows
  SET row_status = 'posted', updated_at = now()
  WHERE batch_id = p_batch_id;

  v_summary := jsonb_build_object(
    'row_count', v_row_count,
    'income_transaction_count', v_income_transaction_count,
    'cogs_transaction_count', v_cogs_transaction_count,
    'ledger_transaction_count', v_income_transaction_count + v_cogs_transaction_count,
    'payment_count', v_payment_count,
    'collected_count', v_collected_count,
    'unknown_count', v_unknown_count,
    'zero_gross_collected_count', v_zero_gross_collected_count,
    'net_total_try', v_total_net,
    'output_vat_total_try', v_total_output_vat,
    'input_vat_total_try', v_total_input_vat,
    'cogs_total_try', v_total_cogs,
    'gross_total_try', v_total_gross,
    'collected_gross_total_try', v_collected_gross
  );

  UPDATE public.finance_import_batches
  SET
    status = 'posted',
    posted_at = now(),
    posting_summary = v_summary
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'status', 'posted',
    'batch_id', p_batch_id,
    'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_finance_import_batch(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_finance_import_batch(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.post_finance_import_batch(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.post_finance_import_batch(UUID) TO service_role;

COMMIT;
