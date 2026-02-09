-- ============================================================
-- ORNET ERP - Complete Database Schema
-- ============================================================
-- Single-tenant CRM for service/installation management
-- Run this entire file in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Order of execution:
-- 1. Profiles (extends auth.users)
-- 2. Customers
-- 3. Work Orders (servis/montaj)
-- 4. Tasks (yapilacak isler)
-- 5. Dashboard functions
-- ============================================================


-- ############################################################
-- PART 1: PROFILES TABLE
-- ############################################################

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'field_worker'
    CHECK (role IN ('admin', 'field_worker', 'accountant')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'field_worker')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper: Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ############################################################
-- PART 2: CUSTOMERS TABLE
-- ############################################################

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  phone_secondary TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_created ON customers(created_at DESC);
CREATE INDEX idx_customers_city ON customers(city) WHERE city IS NOT NULL;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Account number generator
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(account_number, '^M-' || current_year || '-', ''), account_number)::INT), 0) + 1
  INTO next_number
  FROM customers
  WHERE account_number LIKE 'M-' || current_year || '-%';
  RETURN 'M-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
END;
$$;

-- RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_authenticated"
  ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "customers_insert_authenticated"
  ON customers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "customers_update_authenticated"
  ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "customers_delete_admin"
  ON customers FOR DELETE TO authenticated USING (get_my_role() = 'admin');


-- ############################################################
-- PART 3: WORK ORDERS TABLE
-- ############################################################

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('service', 'installation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_date DATE,
  scheduled_time TIME,
  assigned_to UUID REFERENCES profiles(id),
  title TEXT,
  description TEXT,
  panel_number TEXT,
  materials TEXT,
  amount DECIMAL(12, 2),
  currency TEXT DEFAULT 'TRY',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_type ON work_orders(type);
CREATE INDEX idx_work_orders_scheduled ON work_orders(scheduled_date, scheduled_time);
CREATE INDEX idx_work_orders_created ON work_orders(created_at DESC);
CREATE INDEX idx_work_orders_assigned_status ON work_orders(assigned_to, status);

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set completed_at/cancelled_at
CREATE OR REPLACE FUNCTION set_work_order_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
  END IF;
  IF NEW.status != 'completed' THEN NEW.completed_at = NULL; END IF;
  IF NEW.status != 'cancelled' THEN NEW.cancelled_at = NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_status_change
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_work_order_completed_at();

-- RLS for work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_orders_select"
  ON work_orders FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'accountant') OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "work_orders_insert"
  ON work_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "work_orders_update"
  ON work_orders FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin' OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (get_my_role() = 'admin' OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "work_orders_delete_admin"
  ON work_orders FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- View with joined data
CREATE VIEW work_orders_with_customer AS
SELECT wo.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, p.full_name AS assigned_to_name
FROM work_orders wo
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN profiles p ON wo.assigned_to = p.id;

GRANT SELECT ON work_orders_with_customer TO authenticated;


-- ############################################################
-- PART 4: TASKS TABLE
-- ############################################################

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES profiles(id),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  due_date DATE,
  due_time TIME,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_work_order ON tasks(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due_status ON tasks(due_date, status) WHERE status != 'completed';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN NEW.completed_at = now(); END IF;
  IF NEW.status != 'completed' THEN NEW.completed_at = NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_status_change
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- RLS for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT TO authenticated
  USING (get_my_role() = 'admin' OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin' OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (get_my_role() = 'admin' OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "tasks_delete_admin"
  ON tasks FOR DELETE TO authenticated USING (get_my_role() = 'admin');

CREATE VIEW tasks_with_details AS
SELECT t.*, p.full_name AS assigned_to_name, wo.title AS work_order_title, c.name AS customer_name
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
LEFT JOIN work_orders wo ON t.work_order_id = wo.id
LEFT JOIN customers c ON wo.customer_id = c.id;

GRANT SELECT ON tasks_with_details TO authenticated;


-- ############################################################
-- PART 5: DASHBOARD FUNCTIONS
-- ############################################################

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := get_my_role();

  SELECT json_build_object(
    'today_work_orders', (SELECT COUNT(*) FROM work_orders WHERE scheduled_date = CURRENT_DATE AND status NOT IN ('completed', 'cancelled') AND (user_role = 'admin' OR assigned_to = user_id)),
    'pending_work_orders', (SELECT COUNT(*) FROM work_orders WHERE status = 'pending' AND (user_role = 'admin' OR assigned_to = user_id)),
    'in_progress_work_orders', (SELECT COUNT(*) FROM work_orders WHERE status = 'in_progress' AND (user_role = 'admin' OR assigned_to = user_id)),
    'completed_this_week', (SELECT COUNT(*) FROM work_orders WHERE status = 'completed' AND completed_at >= date_trunc('week', CURRENT_DATE) AND (user_role = 'admin' OR assigned_to = user_id)),
    'open_tasks', (SELECT COUNT(*) FROM tasks WHERE status NOT IN ('completed', 'cancelled') AND (user_role = 'admin' OR assigned_to = user_id)),
    'overdue_tasks', (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'cancelled') AND (user_role = 'admin' OR assigned_to = user_id)),
    'total_customers', (SELECT COUNT(*) FROM customers),
    'user_role', user_role
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION get_today_schedule()
RETURNS TABLE (id UUID, customer_name TEXT, customer_phone TEXT, customer_address TEXT, type TEXT, status TEXT, scheduled_time TIME, title TEXT, priority TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := get_my_role();
  RETURN QUERY
  SELECT wo.id, c.name, c.phone, c.address, wo.type, wo.status, wo.scheduled_time, wo.title, wo.priority
  FROM work_orders wo
  JOIN customers c ON wo.customer_id = c.id
  WHERE wo.scheduled_date = CURRENT_DATE AND wo.status NOT IN ('completed', 'cancelled') AND (user_role = 'admin' OR wo.assigned_to = user_id)
  ORDER BY wo.scheduled_time NULLS LAST, wo.priority DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_schedule() TO authenticated;

CREATE OR REPLACE FUNCTION get_my_pending_tasks(limit_count INT DEFAULT 10)
RETURNS TABLE (id UUID, title TEXT, due_date DATE, priority TEXT, work_order_title TEXT, customer_name TEXT, is_overdue BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  user_role := get_my_role();
  RETURN QUERY
  SELECT t.id, t.title, t.due_date, t.priority, wo.title, c.name, (t.due_date < CURRENT_DATE)
  FROM tasks t
  LEFT JOIN work_orders wo ON t.work_order_id = wo.id
  LEFT JOIN customers c ON wo.customer_id = c.id
  WHERE t.status NOT IN ('completed', 'cancelled') AND (user_role = 'admin' OR t.assigned_to = user_id)
  ORDER BY t.due_date NULLS LAST, CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_tasks(INT) TO authenticated;

CREATE OR REPLACE FUNCTION get_customer_work_history(p_customer_id UUID)
RETURNS TABLE (id UUID, type TEXT, status TEXT, title TEXT, scheduled_date DATE, completed_at TIMESTAMPTZ, amount DECIMAL, assigned_to_name TEXT, materials TEXT, panel_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT wo.id, wo.type, wo.status, wo.title, wo.scheduled_date, wo.completed_at, wo.amount, p.full_name, wo.materials, wo.panel_number
  FROM work_orders wo
  LEFT JOIN profiles p ON wo.assigned_to = p.id
  WHERE wo.customer_id = p_customer_id
  ORDER BY wo.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_work_history(UUID) TO authenticated;


-- ############################################################
-- DONE! Schema is ready.
-- ############################################################
-- Next steps:
-- 1. Create your first admin user in Supabase Auth
-- 2. Update the profile to set role = 'admin'
-- 3. Start building the frontend!
