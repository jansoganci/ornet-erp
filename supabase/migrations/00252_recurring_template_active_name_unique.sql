-- 00252_recurring_template_active_name_unique.sql
-- Enforce unique active recurring template names (case/whitespace insensitive).
-- Soft-deleted rows are excluded so the same name may be reused after delete.

-- ============================================================================
-- 1. PRE-MIGRATION AUDIT — resolve duplicate active names before unique index
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  suffix INT;
BEGIN
  FOR r IN
    SELECT
      lower(trim(name)) AS norm_name,
      array_agg(id ORDER BY created_at ASC, id ASC) AS ids,
      array_agg(name ORDER BY created_at ASC, id ASC) AS names
    FROM public.recurring_expense_templates
    WHERE deleted_at IS NULL
    GROUP BY lower(trim(name))
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE
      'recurring_expense_templates: deduplicating active name "%" (% rows)',
      r.norm_name,
      array_length(r.ids, 1);

    suffix := 2;
    FOR i IN 2..array_length(r.ids, 1) LOOP
      UPDATE public.recurring_expense_templates
      SET name = r.names[i] || ' (' || suffix::text || ')'
      WHERE id = r.ids[i];
      suffix := suffix + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 2. PARTIAL UNIQUE INDEX — active templates only
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ret_name_active
  ON public.recurring_expense_templates (lower(trim(name)))
  WHERE deleted_at IS NULL;

-- Rollback:
-- DROP INDEX IF EXISTS public.idx_ret_name_active;
