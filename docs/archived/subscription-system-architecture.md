# Subscription Management System - Architecture

> Complete technical architecture for the Ornet ERP subscription/billing module.
> Designed for a Turkish security company managing alarm monitoring, camera, and ISP subscriptions.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Business Rules](#2-business-rules)
3. [Database Schema](#3-database-schema)
4. [Views & Functions](#4-views--functions)
5. [Payment Flow](#5-payment-flow)
6. [API Design](#6-api-design)
7. [UI Structure](#7-ui-structure)
8. [Validation Rules](#8-validation-rules)
9. [Security & Compliance](#9-security--compliance)
10. [Excel Migration Strategy](#10-excel-migration-strategy)
11. [Glossary](#11-glossary)

---

## 1. System Overview

### Purpose

Track recurring subscriptions tied to customer sites (alarm monitoring locations). Each site can have **one active subscription**. The system manages monthly billing, payment recording, invoice compliance (Turkish 7-day rule), and provides MRR/churn analytics.

### Relationship to Existing Modules

```
customers (1) ──── (N) customer_sites (1) ──── (1) subscriptions (1) ──── (N) subscription_payments
     │                       │                          │
     │                       │                          │
     └──── (N) payment_methods ◄────────────────────────┘
                                            (payment_method_id)

subscriptions ──→ profiles (sold_by, managed_by, created_by)
audit_logs    ──→ any table (table_name + record_id)
```

### Subscription Types

| Type | Code | Description | Payment Method |
|------|------|-------------|----------------|
| Recurring Card | `recurring_card` | Auto-charge monthly via stored card | Card (Iyzico token) |
| Manual Cash | `manual_cash` | Collected in person by field worker | Cash |
| Manual Bank | `manual_bank` | Customer sends bank transfer | Bank transfer |
| Annual | `annual` | Single payment per year | Any |
| Internet Only | `internet_only` | ISP package subscription | Any |

### Subscription Lifecycle

```
                 ┌──────────────┐
    create ─────→│   ACTIVE     │◄──── reactivate
                 └──────┬───────┘
                        │
               pause    │    cancel
              ┌─────────┼──────────┐
              ▼                    ▼
     ┌────────────────┐   ┌──────────────┐
     │    PAUSED       │   │  CANCELLED   │
     │ (pause_reason)  │   │ (end_date)   │
     └────────────────┘   └──────────────┘
           │                    (terminal)
           │ reactivate
           └──→ ACTIVE
```

- **Active** → Service running, payments expected each month
- **Paused** → Temporarily stopped; future pending payments marked `skipped`; `pause_reason` and `paused_at` set
- **Cancelled** → Terminal state; `end_date`, `cancel_reason`, `cancelled_at` set; unpaid months either kept as `pending` (collectible) or marked `write_off`

---

## 2. Business Rules

### BR-1: One Active Subscription Per Site
A `customer_site` can have at most **one** subscription with `status = 'active'` at any time. Enforced by a partial unique index on `(site_id) WHERE status = 'active'`. Cancelled/paused subscriptions do not block new ones (paused must be cancelled first).

### BR-2: Auto Lifecycle Timestamps
Database triggers automatically set:
- `paused_at` when status changes to `paused`
- `cancelled_at` and `end_date` when status changes to `cancelled`
- Clear `paused_at` and `pause_reason` when reactivated from `paused`

### BR-3: Billing Day (1-28)
Each subscription has a `billing_day` (1-28) indicating when the monthly charge should occur. Day 28 is the maximum to avoid month-length issues (Feb 29-31 edge cases).

### BR-4: VAT Logic
- **`recurring_card`**: 20% KDV (standard rate for security monitoring services)
- **`manual_cash`** and **`manual_bank`**: 0% KDV (simplified - no invoice generated for cash/bank unless explicitly requested)
- **`annual`** and **`internet_only`**: Follow same rules as their payment method implies
- VAT rate stored per-subscription (`vat_rate` field) for flexibility

### BR-5: Single Payment Recording
Payments are recorded one at a time via a modal. No bulk payment UI. Each payment record captures: `payment_date`, `payment_method`, `invoice_no`, `invoice_type`, and `notes`.

### BR-6: Cost Field Admin-Only
The `cost` field (central station fee / maliyet) is stored on every subscription but only visible in the UI to users with `admin` role. Accountants and field workers cannot see cost or profit calculations.

### BR-7: 7-Day Invoice Compliance
Turkish tax law requires invoices to be issued within 7 calendar days of payment. The system:
- Flags any payment with `status = 'paid'` AND `invoice_no IS NULL` AND `payment_date < today - 7 days`
- Shows a `ComplianceAlert` banner on the subscriptions list page when violations exist
- Provides `get_overdue_invoices()` database function for reporting

### BR-8: Audit Log for All Changes
Every state change is logged to `audit_logs`:
- Subscription created/updated/paused/cancelled/reactivated
- Payment recorded (status change from pending → paid)
- Price changes (old and new values in JSONB)
- Fields: `table_name`, `record_id`, `action`, `old_values`, `new_values`, `user_id`, `description`

---

## 3. Database Schema

### Table: `payment_methods`

> Stores tokenized payment information per customer. PCI-DSS compliant — no full card numbers.

```sql
CREATE TABLE payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Type
  method_type     TEXT NOT NULL CHECK (method_type IN ('card', 'bank_transfer', 'cash')),

  -- Card info (display only — NO full card numbers)
  card_last4      TEXT CHECK (char_length(card_last4) = 4),
  card_holder     TEXT,
  card_expiry     TEXT,              -- 'MM/YY' format
  card_brand      TEXT,              -- 'visa', 'mastercard', 'troy'

  -- Bank transfer info
  bank_name       TEXT,
  iban            TEXT,

  -- Future automation (Phase 2)
  iyzico_token    TEXT,              -- encrypted at rest via Supabase Vault

  -- Display
  label           TEXT,              -- e.g. "İş Bankası ****4532"
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,  -- soft delete

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_payment_methods_customer ON payment_methods (customer_id);
CREATE INDEX idx_payment_methods_active ON payment_methods (customer_id) WHERE is_active = true;

-- Auto-update timestamp
CREATE TRIGGER set_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select" ON payment_methods FOR SELECT
  TO authenticated USING (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_insert" ON payment_methods FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_update" ON payment_methods FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "pm_delete" ON payment_methods FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');
```

### Table: `subscriptions`

> Core subscription record. Links to a customer_site (1:1 when active).

```sql
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,

  -- Type & Status
  subscription_type TEXT NOT NULL CHECK (subscription_type IN (
    'recurring_card', 'manual_cash', 'manual_bank', 'annual', 'internet_only'
  )),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled'
  )),

  -- Dates
  start_date        DATE NOT NULL,
  end_date          DATE,
  billing_day       INTEGER DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),

  -- Pricing (DECIMAL, never float)
  base_price        DECIMAL(10,2) NOT NULL,
  sms_fee           DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_fee          DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate          DECIMAL(5,2)  NOT NULL DEFAULT 20.00,
  cost              DECIMAL(10,2) NOT NULL DEFAULT 0,  -- central station cost (admin-only visible)
  currency          TEXT NOT NULL DEFAULT 'TRY',

  -- Payment method (nullable — cash/bank don't need stored method)
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,

  -- Lifecycle metadata
  pause_reason      TEXT,
  cancel_reason     TEXT,
  paused_at         TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  -- Ownership & tracking
  sold_by           UUID REFERENCES profiles(id),      -- who sold the subscription
  managed_by        UUID REFERENCES profiles(id),      -- current account manager
  setup_notes       TEXT,                               -- equipment notes (cameras, panels etc.)
  notes             TEXT,

  -- Timestamps
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRITICAL: One active subscription per site
CREATE UNIQUE INDEX idx_subscriptions_active_site
  ON subscriptions (site_id) WHERE status = 'active';

-- Query indexes
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_type ON subscriptions (subscription_type);
CREATE INDEX idx_subscriptions_status_start ON subscriptions (status, start_date);
CREATE INDEX idx_subscriptions_site ON subscriptions (site_id);
CREATE INDEX idx_subscriptions_managed ON subscriptions (managed_by) WHERE managed_by IS NOT NULL;

-- Auto-update timestamp
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto lifecycle timestamps
CREATE OR REPLACE FUNCTION set_subscription_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paused' AND OLD.status != 'paused' THEN
    NEW.paused_at = now();
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
    NEW.end_date = COALESCE(NEW.end_date, CURRENT_DATE);
  END IF;
  IF NEW.status = 'active' AND OLD.status = 'paused' THEN
    NEW.paused_at = NULL;
    NEW.pause_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_lifecycle
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_subscription_lifecycle_timestamps();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "subscriptions_delete" ON subscriptions FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');
```

### Table: `subscription_payments`

> One record per subscription per month. 12 records auto-generated on subscription creation.

```sql
CREATE TABLE subscription_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- Period (always 1st of month: 2026-01-01, 2026-02-01, ...)
  payment_month       DATE NOT NULL,

  -- Amounts (frozen at generation, recalculated for pending records on price change)
  amount              DECIMAL(10,2) NOT NULL,       -- subtotal before VAT
  vat_amount          DECIMAL(10,2) NOT NULL,       -- VAT portion
  total_amount        DECIMAL(10,2) NOT NULL,       -- amount + vat_amount

  -- Status
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'failed', 'skipped', 'write_off'
  )),

  -- Payment details (filled when recording payment)
  payment_date        DATE,
  payment_method      TEXT CHECK (payment_method IN ('card', 'cash', 'bank_transfer')),

  -- Invoice (Turkish tax compliance)
  invoice_no          TEXT,
  invoice_type        TEXT CHECK (invoice_type IN ('e_fatura', 'e_arsiv')),
  invoice_date        DATE,
  parasut_invoice_id  TEXT,           -- Parasut API reference for audit trail

  -- Dunning (Phase 2 — failed payment retry tracking)
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One payment record per subscription per month
  CONSTRAINT uq_subscription_payment_month UNIQUE (subscription_id, payment_month)
);

-- Indexes
CREATE INDEX idx_sub_payments_subscription ON subscription_payments (subscription_id);
CREATE INDEX idx_sub_payments_status ON subscription_payments (status);
CREATE INDEX idx_sub_payments_month ON subscription_payments (payment_month);

-- Critical: 7-day invoice compliance query
CREATE INDEX idx_sub_payments_overdue_invoice
  ON subscription_payments (payment_date)
  WHERE status = 'paid' AND invoice_no IS NULL;

-- Auto-update timestamp
CREATE TRIGGER set_sub_payments_updated_at
  BEFORE UPDATE ON subscription_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select" ON subscription_payments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "sp_insert" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "sp_update" ON subscription_payments FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('admin', 'accountant'));

CREATE POLICY "sp_delete" ON subscription_payments FOR DELETE
  TO authenticated USING (get_my_role() = 'admin');
```

### Table: `audit_logs`

> Immutable append-only log for financial compliance, fraud detection, and dispute resolution.

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN (
    'insert', 'update', 'delete', 'status_change', 'payment_recorded',
    'price_change', 'pause', 'cancel', 'reactivate'
  )),
  old_values      JSONB,
  new_values      JSONB,
  user_id         UUID REFERENCES profiles(id),
  description     TEXT,             -- human-readable: "Odeme kaydedildi: Ocak 2026"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_table_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs (user_id);

-- RLS: Only admin can read audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  TO authenticated USING (get_my_role() = 'admin');

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);
```

---

## 4. Views & Functions

### View: `subscriptions_detail`

```sql
CREATE OR REPLACE VIEW subscriptions_detail AS
SELECT
  sub.*,
  -- Computed totals
  (sub.base_price + sub.sms_fee + sub.line_fee) AS subtotal,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * sub.vat_rate / 100, 2) AS vat_amount,
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100), 2) AS total_amount,
  -- Profit (admin-only in UI)
  ROUND((sub.base_price + sub.sms_fee + sub.line_fee) * (1 + sub.vat_rate / 100) - sub.cost, 2) AS profit,
  -- Site info
  s.account_no,
  s.site_name,
  s.address       AS site_address,
  s.city,
  s.district,
  s.contact_phone AS site_phone,
  -- Customer info
  c.id            AS customer_id,
  c.company_name,
  c.phone         AS customer_phone,
  c.tax_number,
  -- Payment method info
  pm.method_type  AS pm_type,
  pm.card_last4   AS pm_card_last4,
  pm.card_brand   AS pm_card_brand,
  pm.label        AS pm_label,
  -- Staff names
  mgr.full_name   AS managed_by_name,
  slr.full_name   AS sold_by_name
FROM subscriptions sub
JOIN customer_sites s ON sub.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN payment_methods pm ON sub.payment_method_id = pm.id
LEFT JOIN profiles mgr ON sub.managed_by = mgr.id
LEFT JOIN profiles slr ON sub.sold_by = slr.id;

GRANT SELECT ON subscriptions_detail TO authenticated;
```

### Function: `generate_subscription_payments`

Auto-generates 12 monthly payment records (or 1 for annual) on subscription creation.

```sql
CREATE OR REPLACE FUNCTION generate_subscription_payments(
  p_subscription_id UUID,
  p_start_date DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
  v_month DATE;
  v_subtotal DECIMAL(10,2);
  v_vat DECIMAL(10,2);
  v_total DECIMAL(10,2);
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  v_subtotal := v_sub.base_price + v_sub.sms_fee + v_sub.line_fee;
  v_vat := ROUND(v_subtotal * v_sub.vat_rate / 100, 2);
  v_total := v_subtotal + v_vat;

  IF v_sub.subscription_type = 'annual' THEN
    -- Annual: 1 record for the year
    v_month := date_trunc('month', COALESCE(p_start_date, v_sub.start_date))::DATE;
    INSERT INTO subscription_payments (subscription_id, payment_month, amount, vat_amount, total_amount)
    VALUES (p_subscription_id, v_month, v_subtotal * 12, v_vat * 12, v_total * 12)
    ON CONFLICT (subscription_id, payment_month) DO NOTHING;
  ELSE
    -- Monthly: 12 records
    FOR i IN 0..11 LOOP
      v_month := (date_trunc('month', COALESCE(p_start_date, v_sub.start_date))
                  + (i || ' months')::INTERVAL)::DATE;
      INSERT INTO subscription_payments (subscription_id, payment_month, amount, vat_amount, total_amount)
      VALUES (p_subscription_id, v_month, v_subtotal, v_vat, v_total)
      ON CONFLICT (subscription_id, payment_month) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;
```

### Function: `get_overdue_invoices`

Returns payments that are paid but missing an invoice for more than 7 days (Turkish tax compliance).

```sql
CREATE OR REPLACE FUNCTION get_overdue_invoices()
RETURNS TABLE (
  payment_id UUID,
  subscription_id UUID,
  payment_month DATE,
  payment_date DATE,
  total_amount DECIMAL(10,2),
  days_overdue INTEGER,
  company_name TEXT,
  account_no TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    sp.id,
    sp.subscription_id,
    sp.payment_month,
    sp.payment_date,
    sp.total_amount,
    (CURRENT_DATE - sp.payment_date)::INTEGER,
    c.company_name,
    s.account_no
  FROM subscription_payments sp
  JOIN subscriptions sub ON sp.subscription_id = sub.id
  JOIN customer_sites s ON sub.site_id = s.id
  JOIN customers c ON s.customer_id = c.id
  WHERE sp.status = 'paid'
    AND sp.invoice_no IS NULL
    AND sp.payment_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY sp.payment_date ASC;
$$;
```

### Function: `get_subscription_stats`

Returns dashboard KPI data.

```sql
CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'active_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'paused_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'paused'),
    'cancelled_count', (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled'),
    'mrr', (
      SELECT COALESCE(SUM(
        CASE
          WHEN subscription_type = 'annual'
            THEN ROUND((base_price + sms_fee + line_fee) * (1 + vat_rate / 100) / 12, 2)
          ELSE
            ROUND((base_price + sms_fee + line_fee) * (1 + vat_rate / 100), 2)
        END
      ), 0) FROM subscriptions WHERE status = 'active'
    ),
    'overdue_invoice_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'paid' AND invoice_no IS NULL
        AND payment_date < CURRENT_DATE - INTERVAL '7 days'
    ),
    'unpaid_count', (
      SELECT COUNT(*) FROM subscription_payments
      WHERE status = 'pending' AND payment_month < date_trunc('month', CURRENT_DATE)::DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## 5. Payment Flow

### Flow A: Recurring Card (`recurring_card`)

```
Phase 1 (Manual):
  1. Admin opens subscription detail page
  2. Clicks pending month cell in payment grid
  3. PaymentRecordModal opens pre-filled with card info
  4. Admin confirms → status = 'paid', payment_date = today
  5. Admin enters invoice_no manually (from Parasut)
  6. Audit log created

Phase 2 (Automated):
  1. Monthly cron job runs on billing_day
  2. Calls Iyzico API with stored cardToken
  3. On success → status = 'paid', calls Parasut for invoice
  4. On failure → status = 'failed', retry_count++, next_retry_at set
  5. Dunning: retry on days 1, 3, 7
  6. After day 30 unpaid → auto-pause subscription
```

### Flow B: Manual Cash (`manual_cash`)

```
  1. Field worker collects cash payment from customer
  2. Admin/accountant opens subscription detail page
  3. Clicks pending month cell
  4. PaymentRecordModal: selects payment_method = 'cash', enters date
  5. No invoice generated (0% VAT for cash — BR-4)
  6. status = 'paid', audit log created
```

### Flow C: Manual Bank Transfer (`manual_bank`)

```
  1. Customer sends bank transfer (EFT/havale)
  2. Admin/accountant checks bank statement, confirms receipt
  3. Opens subscription detail page
  4. Clicks pending month cell
  5. PaymentRecordModal: selects payment_method = 'bank_transfer', enters date
  6. Optionally enters invoice_no if invoice issued
  7. status = 'paid', audit log created
```

### Payment Status Transitions

```
pending ──→ paid       (payment recorded)
pending ──→ failed     (card charge failed — Phase 2)
pending ──→ skipped    (subscription paused)
pending ──→ write_off  (bad debt on cancellation)
failed  ──→ paid       (retry succeeded or manual recording)
failed  ──→ write_off  (given up on collection)
```

**Immutability rule:** Once a payment has `status = 'paid'` AND `invoice_no IS NOT NULL`, it cannot be modified except through a formal refund workflow (Phase 3).

---

## 6. API Design

### Subscriptions API (`src/features/subscriptions/api.js`)

| Function | Method | Description |
|----------|--------|-------------|
| `fetchSubscriptions(filters)` | SELECT | List from `subscriptions_detail` view. Filters: `search`, `status`, `type`, `managedBy` |
| `fetchSubscription(id)` | SELECT | Single subscription detail with all joins |
| `createSubscription(data)` | INSERT + RPC | Insert subscription, call `generate_subscription_payments()`, insert audit log |
| `updateSubscription(id, data)` | UPDATE | Update subscription, recalculate pending payment amounts if price changed, insert audit log |
| `pauseSubscription(id, reason)` | UPDATE | Set `status='paused'`, `pause_reason`. Mark future `pending` payments as `skipped` |
| `cancelSubscription(id, reason, writeOffUnpaid)` | UPDATE | Set `status='cancelled'`, `cancel_reason`. Optionally mark pending as `write_off` |
| `reactivateSubscription(id)` | UPDATE | Set `status='active'`. Regenerate pending payments from current month forward |

### Payments API (`src/features/subscriptions/paymentsApi.js`)

| Function | Method | Description |
|----------|--------|-------------|
| `fetchPaymentsBySubscription(id)` | SELECT | 12-month grid data, ordered by `payment_month ASC` |
| `recordPayment(paymentId, data)` | UPDATE | Set `status='paid'`, `payment_date`, `payment_method`, optional `invoice_no`. Insert audit log. Validate immutability rule |
| `fetchOverdueInvoices()` | RPC | Call `get_overdue_invoices()` |
| `fetchSubscriptionStats()` | RPC | Call `get_subscription_stats()` |

### Payment Methods API (`src/features/subscriptions/paymentMethodsApi.js`)

| Function | Method | Description |
|----------|--------|-------------|
| `fetchPaymentMethods(customerId)` | SELECT | Active methods for customer |
| `createPaymentMethod(data)` | INSERT | Create method. If `is_default`, unset other defaults for same customer |
| `updatePaymentMethod(id, data)` | UPDATE | Update display info |
| `deletePaymentMethod(id)` | UPDATE | Soft delete: `SET is_active = false` |

### React Query Keys

```javascript
export const subscriptionKeys = {
  all: ['subscriptions'],
  lists: () => [...subscriptionKeys.all, 'list'],
  list: (filters) => [...subscriptionKeys.lists(), filters],
  details: () => [...subscriptionKeys.all, 'detail'],
  detail: (id) => [...subscriptionKeys.details(), id],
  payments: (id) => [...subscriptionKeys.detail(id), 'payments'],
  stats: () => [...subscriptionKeys.all, 'stats'],
  overdueInvoices: () => [...subscriptionKeys.all, 'overdueInvoices'],
};

export const paymentMethodKeys = {
  all: ['paymentMethods'],
  byCustomer: (customerId) => [...paymentMethodKeys.all, customerId],
};
```

---

## 7. UI Structure

### File Structure

```
src/features/subscriptions/
├── api.js                          # Subscription CRUD
├── paymentsApi.js                  # Payment records API
├── paymentMethodsApi.js            # Payment methods API
├── hooks.js                        # React Query hooks
├── schema.js                       # Zod validation schemas
├── index.js                        # Barrel exports
├── SubscriptionsListPage.jsx       # Main list + filters + KPI cards
├── SubscriptionDetailPage.jsx      # Detail + 12-month grid
├── SubscriptionFormPage.jsx        # Create/Edit form
└── components/
    ├── MonthlyPaymentGrid.jsx      # 12-cell visual grid (core component)
    ├── PaymentRecordModal.jsx      # Record single payment
    ├── PaymentMethodCard.jsx       # Card/bank display chip
    ├── PaymentMethodFormModal.jsx  # Add/edit payment method
    ├── SubscriptionStatusBadge.jsx # Active/Paused/Cancelled badge
    ├── SubscriptionPricingCard.jsx # Price breakdown card
    ├── ComplianceAlert.jsx         # Invoice overdue warning banner
    ├── CancelSubscriptionModal.jsx # Cancel with write-off option
    └── PauseSubscriptionModal.jsx  # Pause with reason
```

### Routes

```javascript
<Route path="subscriptions" element={<SubscriptionsListPage />} />
<Route path="subscriptions/new" element={<SubscriptionFormPage />} />
<Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
<Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />
```

### Navigation

```javascript
{ to: '/subscriptions', icon: CreditCard, labelKey: 'nav.subscriptions' }
```

### Page Layout: SubscriptionsListPage

```
┌─────────────────────────────────────────────────────────┐
│ PageHeader: "Abonelikler"              [+ Yeni Abonelik]│
├─────────────────────────────────────────────────────────┤
│ ComplianceAlert: "3 odeme faturasi 7 gunu gecti!"       │
├─────────────────────────────────────────────────────────┤
│ KPI Cards Row:                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ MRR      │ │ Aktif    │ │ Durakl.  │ │ Geciken  │   │
│ │ ₺124,500 │ │ 156      │ │ 8        │ │ 12       │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│ Filters: [Durum ▾] [Tip ▾] [Arama...]                  │
├─────────────────────────────────────────────────────────┤
│ Table:                                                   │
│ Musteri    | Lokasyon | Hesap No    | Tip  | Aylik |Durm│
│ ──────────────────────────────────────────────────────── │
│ ABC Ltd    | Merkez   | M-2026-001  | Kart | ₺4,140| ●  │
│ XYZ AS     | Sube 1   | M-2025-042  | Nakit| ₺2,400| ●  │
│ DEF Ltd    | Depo     | M-2024-118  | Banka| ₺1,200| ⏸  │
└─────────────────────────────────────────────────────────┘
```

### Page Layout: SubscriptionDetailPage

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Abonelikler > ABC Ltd > Merkez              │
│ Header: [Kart Abonelik] [Aktif ●]    [Duzenle] [...]   │
├─────────────────────────────┬───────────────────────────┤
│ LEFT (2/3):                 │ RIGHT (1/3):              │
│                             │                           │
│ ┌─ Musteri & Lokasyon ────┐ │ ┌─ Fiyatlandirma ──────┐ │
│ │ ABC Ltd                 │ │ │ Baz:     3,300.00 TRY │ │
│ │ Merkez (M-2026-001)    │ │ │ SMS:        50.00 TRY │ │
│ │ Istanbul, Kadikoy      │ │ │ Hat:       100.00 TRY │ │
│ │ Tel: 0532 xxx xx xx    │ │ │ ────────────────────  │ │
│ └─────────────────────────┘ │ │ Ara Toplam: 3,450.00 │ │
│                             │ │ KDV (20%):    690.00  │ │
│ ┌─ 12-Month Payment Grid ┐ │ │ TOPLAM:     4,140.00  │ │
│ │                         │ │ │ ────────────────────  │ │
│ │ Oca [✓] Sub [✓] Mar[◻]│ │ │ Maliyet:     100.00  │ │ ← admin only
│ │ Nis [◻] May [◻] Haz[◻]│ │ │ Kar:       4,040.00  │ │ ← admin only
│ │ Tem [◻] Agu [◻] Eyl[◻]│ │ └───────────────────────┘ │
│ │ Eki [◻] Kas [◻] Ara[◻]│ │                           │
│ │                         │ │ ┌─ Odeme Yontemi ──────┐ │
│ └─────────────────────────┘ │ │ VISA ****4532         │ │
│                             │ │ AHMET YILMAZ  09/28   │ │
│                             │ └───────────────────────┘ │
│                             │                           │
│                             │ ┌─ Aksiyonlar ─────────┐ │
│                             │ │ [⏸ Duraklat]          │ │
│                             │ │ [✕ Iptal Et]          │ │
│                             │ └───────────────────────┘ │
└─────────────────────────────┴───────────────────────────┘
```

### MonthlyPaymentGrid — Color Coding

| Status | Color | Icon | Clickable |
|--------|-------|------|-----------|
| `paid` | Success (green) | Checkmark | Yes (view details) |
| `pending` | Neutral (gray) | Empty circle | Yes (record payment) |
| `failed` | Error (red) | X mark | Yes (retry/record) |
| `skipped` | Neutral dark | Dash | No |
| `write_off` | Warning (amber) | Strikethrough | No |

Each cell displays: **Month abbreviation**, **total amount**, **status icon**.
Clicking a `pending` or `failed` cell opens `PaymentRecordModal`.
Clicking a `paid` cell shows payment details (date, method, invoice).

---

## 8. Validation Rules

### Zod Schema (Subscription Form)

```javascript
subscriptionSchema = z.object({
  site_id:            z.string().uuid(),
  subscription_type:  z.enum(['recurring_card', 'manual_cash', 'manual_bank', 'annual', 'internet_only']),
  start_date:         z.string().min(1),
  billing_day:        z.number().int().min(1).max(28).default(1),
  base_price:         z.preprocess(toNumber, z.number().min(0)),
  sms_fee:            z.preprocess(toNumber, z.number().min(0).default(0)),
  line_fee:           z.preprocess(toNumber, z.number().min(0).default(0)),
  vat_rate:           z.number().default(20),
  cost:               z.preprocess(toNumber, z.number().min(0).default(0)),
  payment_method_id:  z.string().uuid().optional().or(z.literal('')),
  sold_by:            z.string().uuid().optional().or(z.literal('')),
  managed_by:         z.string().uuid().optional().or(z.literal('')),
  notes:              z.string().optional().or(z.literal('')),
  setup_notes:        z.string().optional().or(z.literal('')),
}).refine(data => {
  if (data.subscription_type === 'recurring_card') return !!data.payment_method_id;
  return true;
}, { message: 'Kart abonelik icin odeme yontemi zorunludur', path: ['payment_method_id'] });
```

### Business Validation (API-level)

| Rule | Where | Error |
|------|-------|-------|
| One active sub per site | DB partial unique index | Constraint violation |
| Card sub requires payment method | Zod refine | Form error |
| Paid+invoiced is immutable | `recordPayment()` check | API error |
| Paused payments → skipped | `pauseSubscription()` logic | Auto-applied |
| Cancel with unpaid → warn | `cancelSubscription()` UI | Confirmation modal |
| billing_day 1-28 | DB CHECK + Zod | Validation error |
| start_date required | Zod `.min(1)` | Form error |

---

## 9. Security & Compliance

### RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `subscriptions` | All authenticated | Admin, Accountant | Admin, Accountant | Admin only |
| `subscription_payments` | All authenticated | Admin, Accountant | Admin, Accountant | Admin only |
| `payment_methods` | Admin, Accountant | Admin, Accountant | Admin, Accountant | Admin only |
| `audit_logs` | Admin only | All authenticated | None | None |

### Compliance Checklist

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | Audit every payment change | `audit_logs` INSERT on `recordPayment()` |
| 2 | 7-day invoice flag | `get_overdue_invoices()` + `ComplianceAlert` UI |
| 3 | No plaintext card numbers | Only `card_last4` stored — PCI-DSS safe |
| 4 | Cost field admin-only | UI conditionally renders cost/profit based on role |
| 5 | Immutable paid+invoiced | API rejects updates to finalized payments |
| 6 | Iyzico token encrypted | Phase 2: Supabase Vault |
| 7 | Delete = admin only | RLS on all tables |
| 8 | KVKK (data privacy) | Soft deletes, cascade on customer deletion |

---

## 10. Excel Migration Strategy

### Column Mapping

| Excel Column | Target Table.Field |
|---|---|
| ABONE UNVANI | `customers.company_name` (match or create) |
| MERKEZ | `customer_sites.site_name` |
| HESAP NO | `customer_sites.account_no` |
| BAGLANTI TARIHI | `subscriptions.start_date` |
| TL (aylik) | `subscriptions.base_price` |
| SMS | `subscriptions.sms_fee` |
| HAT | `subscriptions.line_fee` |
| TAKIP TIPI | `subscriptions.subscription_type` |
| KART SON 4 | `payment_methods.card_last4` |
| KART SAHIBI | `payment_methods.card_holder` |
| OCAK-ARALIK (12 cols) | `subscription_payments` x 12 records |

### ETL Process

```
FOR each row in CSV:
  1. Match/create customer by company_name
  2. Match/create site by account_no + customer
  3. Create payment_method if card info exists
  4. Create subscription (type, prices, start_date)
  5. Generate 12 payment records with status from Excel columns
     - Cell has amount/check → status = 'paid'
     - Cell empty → status = 'pending'
     - Cell has dash → status = 'skipped'
```

### Dual-Run Validation (30 days)

| Period | Action |
|--------|--------|
| Day 0 | Full import. Freeze Excel as read-only snapshot. |
| Day 1-7 | Dual entry: all changes in both Excel AND ERP. Daily MRR comparison. |
| Day 8-14 | ERP primary, Excel backup. Daily reconciliation. |
| Day 15-30 | ERP only. Weekly spot-checks. |
| Day 30+ | If 100% match → Archive Excel permanently. |

**Success criteria:** Total MRR, paid count, pending count, and per-customer totals match between Excel and ERP within ±0.01 TRY tolerance for 30 consecutive days.

---

## 11. Glossary

| Term | Turkish | Description |
|------|---------|-------------|
| MRR | Aylik Tekrar Eden Gelir | Monthly Recurring Revenue — sum of all active subscription totals |
| ARR | Yillik Tekrar Eden Gelir | Annual Recurring Revenue = MRR x 12 |
| Churn | Kayip Orani | Percentage of subscriptions cancelled per month |
| KDV | Katma Deger Vergisi | Value Added Tax (VAT) — 20% for security services |
| e-Fatura | Elektronik Fatura | Electronic invoice between registered companies |
| e-Arsiv | Elektronik Arsiv | Electronic archive invoice for B2C |
| Dunning | Odeme Takibi | Process of retrying failed payments |
| Write-off | Silme / Zarar Yazma | Marking uncollectable debt as loss |
| Parasut | Parasut Muhasebe | Cloud accounting software for Turkish businesses |
| Iyzico | Iyzico Odeme | Payment gateway for Turkish market |
