-- Migration: 00064_notifications
-- Description: Notification system - notifications and user_reminders tables
-- Phase 1 of notification-system-progress.md

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  TEXT NOT NULL CHECK (type IN (
    'subscription_cancelled', 'subscription_paused', 'payment_due_soon',
    'renewal_due_soon', 'work_order_assigned', 'task_due_soon', 'user_reminder'
  )),
  title                 TEXT NOT NULL,
  body                  TEXT,
  related_entity_type   TEXT CHECK (related_entity_type IN (
    'work_order', 'proposal', 'subscription', 'subscription_payment', 'task', 'reminder'
  )),
  related_entity_id     UUID,
  target_role           TEXT CHECK (target_role IN ('admin', 'accountant')),
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedup_key             TEXT UNIQUE
);

CREATE INDEX idx_notifications_active ON notifications (resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications (type);
CREATE INDEX idx_notifications_entity ON notifications (related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================================
-- 2. USER_REMINDERS TABLE
-- ============================================================================

CREATE TABLE user_reminders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  content               TEXT,
  remind_date           DATE NOT NULL,
  remind_time           TIME DEFAULT '09:00',
  completed_at          TIMESTAMPTZ,
  notified              BOOLEAN DEFAULT false,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_pending ON user_reminders (remind_date, remind_time)
  WHERE notified = false AND completed_at IS NULL;
CREATE INDEX idx_reminders_created_by ON user_reminders (created_by);

CREATE TRIGGER set_user_reminders_updated_at
  BEFORE UPDATE ON user_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reminders_select" ON user_reminders FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "user_reminders_insert" ON user_reminders FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));
CREATE POLICY "user_reminders_update" ON user_reminders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "user_reminders_delete" ON user_reminders FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR get_my_role() = 'admin');
