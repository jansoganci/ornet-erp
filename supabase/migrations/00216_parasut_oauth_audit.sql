-- Migration: 00216_parasut_oauth_audit
-- Description: Paraşüt OAuth token store, audit log, and idempotency cache

CREATE TABLE IF NOT EXISTS public.parasut_oauth_tokens (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  refresh_lock_until TIMESTAMPTZ,
  refresh_locked_by TEXT,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parasut_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL,
  erp_record_id UUID,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'succeeded', 'failed')),
  request_hash TEXT,
  response_snapshot JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parasut_idempotency_operation
  ON public.parasut_idempotency (operation_type, erp_record_id);

CREATE TABLE IF NOT EXISTS public.parasut_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  erp_record_id UUID,
  parasut_id TEXT,
  idempotency_key TEXT,
  http_method TEXT,
  endpoint TEXT,
  http_status INTEGER,
  duration_ms INTEGER,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  actor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parasut_audit_log_correlation
  ON public.parasut_audit_log (correlation_id);

CREATE INDEX IF NOT EXISTS idx_parasut_audit_log_operation_created
  ON public.parasut_audit_log (operation, created_at DESC);

DROP TRIGGER IF EXISTS update_parasut_oauth_tokens_updated_at
  ON public.parasut_oauth_tokens;
CREATE TRIGGER update_parasut_oauth_tokens_updated_at
  BEFORE UPDATE ON public.parasut_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_parasut_idempotency_updated_at
  ON public.parasut_idempotency;
CREATE TRIGGER update_parasut_idempotency_updated_at
  BEFORE UPDATE ON public.parasut_idempotency
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.parasut_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parasut_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parasut_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parasut_oauth_tokens_no_client_access" ON public.parasut_oauth_tokens;
DROP POLICY IF EXISTS "parasut_idempotency_select_admin" ON public.parasut_idempotency;
DROP POLICY IF EXISTS "parasut_audit_log_select_admin" ON public.parasut_audit_log;

-- OAuth tokens are service-role only. No authenticated client policy is defined.
CREATE POLICY "parasut_oauth_tokens_no_client_access"
  ON public.parasut_oauth_tokens FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "parasut_idempotency_select_admin"
  ON public.parasut_idempotency FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "parasut_audit_log_select_admin"
  ON public.parasut_audit_log FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

GRANT SELECT ON public.parasut_oauth_tokens TO authenticated;
GRANT SELECT ON public.parasut_idempotency TO authenticated;
GRANT SELECT ON public.parasut_audit_log TO authenticated;
