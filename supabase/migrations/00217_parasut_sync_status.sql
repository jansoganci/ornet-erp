-- Migration: 00217_parasut_sync_status
-- Description: Paraşüt invoice sync state for financial transaction income rows

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS parasut_e_document_id TEXT,
  ADD COLUMN IF NOT EXISTS parasut_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS parasut_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parasut_error TEXT,
  ADD COLUMN IF NOT EXISTS parasut_trackable_job_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_transactions_parasut_sync_status_check'
      AND conrelid = 'public.financial_transactions'::regclass
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_parasut_sync_status_check
      CHECK (
        parasut_sync_status IS NULL OR parasut_sync_status IN (
          'not_required', 'ready', 'draft', 'sent', 'confirmed', 'failed'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ft_parasut_sync_status
  ON public.financial_transactions (parasut_sync_status)
  WHERE parasut_sync_status IN ('ready', 'draft', 'sent');

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_parasut_invoice_required_unique
  ON public.financial_transactions (id)
  WHERE direction = 'income'
    AND should_invoice = true
    AND parasut_sync_status IS DISTINCT FROM 'not_required';

CREATE OR REPLACE FUNCTION public.fn_set_subscription_parasut_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_official_invoice BOOLEAN;
BEGIN
  IF NEW.direction <> 'income' THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_payment_id IS NULL THEN
    IF COALESCE(NEW.should_invoice, true)
      AND (NEW.proposal_id IS NOT NULL OR NEW.work_order_id IS NOT NULL) THEN
      NEW.parasut_sync_status := COALESCE(NEW.parasut_sync_status, 'ready');
    ELSE
      NEW.parasut_sync_status := COALESCE(NEW.parasut_sync_status, 'not_required');
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.official_invoice, true)
  INTO v_official_invoice
  FROM public.subscription_payments sp
  JOIN public.subscriptions s ON s.id = sp.subscription_id
  WHERE sp.id = NEW.subscription_payment_id;

  IF COALESCE(NEW.should_invoice, true) AND COALESCE(v_official_invoice, true) THEN
    NEW.parasut_sync_status := COALESCE(NEW.parasut_sync_status, 'ready');
  ELSE
    NEW.parasut_sync_status := COALESCE(NEW.parasut_sync_status, 'not_required');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_subscription_parasut_ready
  ON public.financial_transactions;
CREATE TRIGGER trg_set_subscription_parasut_ready
  BEFORE INSERT OR UPDATE OF should_invoice, subscription_payment_id
  ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_subscription_parasut_ready();

UPDATE public.financial_transactions ft
SET parasut_sync_status = CASE
  WHEN ft.direction = 'income'
    AND ft.subscription_payment_id IS NOT NULL
    AND COALESCE(ft.should_invoice, true)
    AND COALESCE(s.official_invoice, true)
    THEN 'ready'
  WHEN ft.direction = 'income'
    AND (ft.proposal_id IS NOT NULL OR ft.work_order_id IS NOT NULL)
    AND COALESCE(ft.should_invoice, true)
    THEN 'ready'
  ELSE 'not_required'
END
FROM public.subscription_payments sp
JOIN public.subscriptions s ON s.id = sp.subscription_id
WHERE ft.subscription_payment_id = sp.id
  AND ft.parasut_sync_status IS NULL;

UPDATE public.financial_transactions ft
SET parasut_sync_status = CASE
  WHEN ft.direction = 'income'
    AND (ft.proposal_id IS NOT NULL OR ft.work_order_id IS NOT NULL)
    AND COALESCE(ft.should_invoice, true)
    THEN 'ready'
  ELSE 'not_required'
END
WHERE ft.subscription_payment_id IS NULL
  AND ft.parasut_sync_status IS NULL;

UPDATE public.financial_transactions
SET parasut_sync_status = 'not_required'
WHERE parasut_sync_status IS NULL;
