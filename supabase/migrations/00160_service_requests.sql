-- Migration: 00160_service_requests
-- Description: Create service_requests table, detail view, and RPCs for Operations Board
-- Part of Operations Board (Operasyon Merkezi) implementation
-- Blueprint: docs/active/OPERATIONS_BOARD_BLUEPRINT.md

-- ============================================================================
-- 1. Table: service_requests
-- ============================================================================
-- Service requests are lightweight phone-call records that track customer
-- problems from first contact through scheduling. They convert to work_orders
-- only when confirmed and a date is assigned.

CREATE TABLE service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core (captured during phone call)
  customer_id       UUID NOT NULL REFERENCES customers(id),
  site_id           UUID REFERENCES customer_sites(id),
  description       TEXT NOT NULL,

  -- Classification
  region            TEXT NOT NULL DEFAULT 'istanbul_europe'
                    CHECK (region IN (
                      'istanbul_europe',
                      'istanbul_anatolia',
                      'outside_istanbul'
                    )),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  work_type         TEXT NOT NULL DEFAULT 'service'
                    CHECK (work_type IN (
                      'survey', 'installation', 'service', 'maintenance', 'other'
                    )),

  -- Contact tracking (traffic light)
  contact_status    TEXT NOT NULL DEFAULT 'not_contacted'
                    CHECK (contact_status IN (
                      'not_contacted',
                      'no_answer',
                      'confirmed',
                      'cancelled'
                    )),
  contact_attempts  INT NOT NULL DEFAULT 0,
  last_contact_at   TIMESTAMPTZ,
  contact_notes     TEXT,

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN (
                      'open',
                      'scheduled',
                      'completed',
                      'failed',
                      'cancelled'
                    )),

  -- Work Order link (set on conversion)
  work_order_id     UUID REFERENCES work_orders(id),

  -- Scheduling (set when confirmed + date assigned)
  scheduled_date    DATE,
  scheduled_time    TIME,

  -- Failure / Rescheduling
  failure_reason    TEXT,
  reschedule_count  INT NOT NULL DEFAULT 0,

  -- Metadata
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Pool queries: open requests filtered by region, contact status
CREATE INDEX idx_sr_status_open
  ON service_requests(status)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX idx_sr_region
  ON service_requests(region)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX idx_sr_contact_status
  ON service_requests(contact_status)
  WHERE deleted_at IS NULL AND status = 'open';

-- Calendar tab: scheduled requests by date
CREATE INDEX idx_sr_scheduled_date
  ON service_requests(scheduled_date)
  WHERE status = 'scheduled';

-- Customer lookup
CREATE INDEX idx_sr_customer
  ON service_requests(customer_id)
  WHERE deleted_at IS NULL;

-- Work order link
CREATE INDEX idx_sr_work_order
  ON service_requests(work_order_id)
  WHERE work_order_id IS NOT NULL;

-- ============================================================================
-- 3. Auto-update timestamp trigger
-- ============================================================================

CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. RLS Policies
-- ============================================================================

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_requests_select"
  ON service_requests FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "service_requests_insert"
  ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'accountant')
    )
  );

CREATE POLICY "service_requests_update"
  ON service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'accountant')
    )
  );

-- ============================================================================
-- 5. View: service_requests_detail
-- ============================================================================

CREATE OR REPLACE VIEW service_requests_detail AS
SELECT
  sr.id,
  sr.customer_id,
  sr.site_id,
  sr.description,
  sr.region,
  sr.priority,
  sr.work_type,
  sr.contact_status,
  sr.contact_attempts,
  sr.last_contact_at,
  sr.contact_notes,
  sr.status,
  sr.work_order_id,
  sr.scheduled_date,
  sr.scheduled_time,
  sr.failure_reason,
  sr.reschedule_count,
  sr.created_by,
  sr.created_at,
  sr.updated_at,
  -- Joined fields
  c.company_name   AS customer_name,
  c.phone          AS customer_phone,
  cs.site_name,
  cs.account_no,
  cs.city,
  cs.district,
  cs.contact_phone AS site_contact_phone,
  p.full_name      AS created_by_name,
  wo.form_no       AS work_order_form_no,
  wo.status        AS work_order_status
FROM service_requests sr
LEFT JOIN customers c       ON c.id = sr.customer_id
LEFT JOIN customer_sites cs ON cs.id = sr.site_id
LEFT JOIN profiles p        ON p.id = sr.created_by
LEFT JOIN work_orders wo    ON wo.id = sr.work_order_id
WHERE sr.deleted_at IS NULL;

-- ============================================================================
-- 6. RPC: fn_convert_request_to_work_order
-- ============================================================================
-- Atomically converts a confirmed service request into a work order.
-- Guards: request must be 'open' and contact_status must be 'confirmed'.
-- Creates a WO with scheduled status and links it back to the request.

CREATE OR REPLACE FUNCTION fn_convert_request_to_work_order(
  p_request_id     UUID,
  p_scheduled_date DATE,
  p_scheduled_time TIME    DEFAULT NULL,
  p_work_type      TEXT    DEFAULT NULL,
  p_notes          TEXT    DEFAULT NULL,
  p_user_id        UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request   service_requests%ROWTYPE;
  v_wo_id     UUID;
  v_user      UUID;
BEGIN
  v_user := COALESCE(p_user_id, auth.uid());

  -- Lock and fetch the request
  SELECT * INTO v_request
  FROM service_requests
  WHERE id = p_request_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found: %', p_request_id;
  END IF;

  IF v_request.status != 'open' THEN
    RAISE EXCEPTION 'Request is not open (current: %)', v_request.status;
  END IF;

  IF v_request.contact_status != 'confirmed' THEN
    RAISE EXCEPTION 'Request is not confirmed (current: %)', v_request.contact_status;
  END IF;

  -- Create work order (form_no left empty — user fills in WO detail page)
  INSERT INTO work_orders (
    work_type,
    status,
    site_id,
    description,
    scheduled_date,
    scheduled_time,
    priority,
    notes,
    created_by
  ) VALUES (
    COALESCE(p_work_type, v_request.work_type),
    'scheduled',
    v_request.site_id,
    v_request.description,
    p_scheduled_date,
    p_scheduled_time,
    v_request.priority,
    p_notes,
    v_user
  )
  RETURNING id INTO v_wo_id;

  -- Link request to work order and update status
  UPDATE service_requests
  SET
    status         = 'scheduled',
    work_order_id  = v_wo_id,
    scheduled_date = p_scheduled_date,
    scheduled_time = p_scheduled_time,
    work_type      = COALESCE(p_work_type, v_request.work_type),
    updated_at     = now()
  WHERE id = p_request_id;

  RETURN v_wo_id;
END;
$$;

-- ============================================================================
-- 7. RPC: fn_boomerang_failed_request
-- ============================================================================
-- When a work order fails, this returns the linked service request to the pool.
-- Cancels the linked WO, resets the request to 'open', increments reschedule_count.
-- Auto-escalates to 'urgent' priority after 3 failures.

CREATE OR REPLACE FUNCTION fn_boomerang_failed_request(
  p_request_id     UUID,
  p_failure_reason TEXT    DEFAULT NULL,
  p_user_id        UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request service_requests%ROWTYPE;
BEGIN
  -- Lock and fetch
  SELECT * INTO v_request
  FROM service_requests
  WHERE id = p_request_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found: %', p_request_id;
  END IF;

  IF v_request.status NOT IN ('scheduled', 'failed') THEN
    RAISE EXCEPTION 'Cannot boomerang request from status: %', v_request.status;
  END IF;

  -- Cancel the linked work order (if not already completed)
  IF v_request.work_order_id IS NOT NULL THEN
    UPDATE work_orders
    SET
      status       = 'cancelled',
      cancelled_at = now(),
      notes        = COALESCE(notes, '') ||
        E'\n[Otomatik iptal: Talep yeniden planlanacak - ' ||
        COALESCE(p_failure_reason, 'Belirtilmedi') || ']'
    WHERE id = v_request.work_order_id
      AND status NOT IN ('completed');
  END IF;

  -- Return request to the pool
  UPDATE service_requests
  SET
    status           = 'open',
    contact_status   = 'not_contacted',
    work_order_id    = NULL,
    scheduled_date   = NULL,
    scheduled_time   = NULL,
    failure_reason   = p_failure_reason,
    reschedule_count = reschedule_count + 1,
    updated_at       = now()
  WHERE id = p_request_id;

  -- Auto-escalate to urgent after 3 failures
  UPDATE service_requests
  SET priority = 'urgent'
  WHERE id = p_request_id
    AND reschedule_count >= 3
    AND priority != 'urgent';
END;
$$;

-- ============================================================================
-- 8. RPC: fn_get_operations_stats
-- ============================================================================
-- Returns aggregated stats for the Operations Board Insights tab.
-- Pool stats (current open requests) + period stats (date-filtered).

CREATE OR REPLACE FUNCTION fn_get_operations_stats(
  p_date_from DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_date_to   DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'pool', (
      SELECT json_build_object(
        'total_open', COUNT(*) FILTER (WHERE status = 'open'),
        'not_contacted', COUNT(*) FILTER (WHERE status = 'open' AND contact_status = 'not_contacted'),
        'no_answer', COUNT(*) FILTER (WHERE status = 'open' AND contact_status = 'no_answer'),
        'confirmed', COUNT(*) FILTER (WHERE status = 'open' AND contact_status = 'confirmed'),
        'by_region', json_build_object(
          'istanbul_europe', COUNT(*) FILTER (WHERE status = 'open' AND region = 'istanbul_europe'),
          'istanbul_anatolia', COUNT(*) FILTER (WHERE status = 'open' AND region = 'istanbul_anatolia'),
          'outside_istanbul', COUNT(*) FILTER (WHERE status = 'open' AND region = 'outside_istanbul')
        )
      )
      FROM service_requests
      WHERE deleted_at IS NULL
    ),
    'period', (
      SELECT json_build_object(
        'scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'success_rate', CASE
          WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
            COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) * 100, 1
          )
          ELSE 0
        END,
        'avg_reschedules', COALESCE(
          ROUND(AVG(reschedule_count) FILTER (WHERE status IN ('completed', 'failed')), 1),
          0
        ),
        'total_requests', COUNT(*)
      )
      FROM service_requests
      WHERE deleted_at IS NULL
        AND created_at >= p_date_from
        AND created_at < p_date_to + INTERVAL '1 day'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
