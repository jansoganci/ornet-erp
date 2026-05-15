-- Migration: 00218_parasut_payment_meta
-- Description: Paraşüt payment sync metadata for financial transaction payments

ALTER TABLE public.financial_transaction_payments
  ADD COLUMN IF NOT EXISTS parasut_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS parasut_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS parasut_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ftp_parasut_payment
  ON public.financial_transaction_payments (parasut_payment_id)
  WHERE parasut_payment_id IS NOT NULL;
