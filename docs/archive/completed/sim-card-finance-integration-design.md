# SIM Card Finance Integration — Design Research

**Status:** Research Complete  
**Date:** 2025-02-12

---

## 1. Current `sim_cards` Table Structure

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `phone_number` | TEXT | UNIQUE NOT NULL |
| `imsi` | TEXT | UNIQUE |
| `iccid` | TEXT | GPRS/EBS Serial No |
| `operator` | sim_operator | TURKCELL, VODAFONE, TURK_TELEKOM |
| `capacity` | TEXT | e.g. '100MB', '1GB' |
| `account_no` | TEXT | AİM Account No |
| `status` | sim_card_status | **available, active, inactive, sold** |
| `customer_id` | UUID | FK → customers(id) |
| `site_id` | UUID | FK → customer_sites(id) |
| `cost_price` | DECIMAL(12,2) | Monthly operator cost (default 0) |
| `sale_price` | DECIMAL(12,2) | Monthly sale price (default 0) |
| `currency` | TEXT | Default 'TRY' |
| `activation_date` | TIMESTAMPTZ | |
| `deactivation_date` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**Relevant columns for finance:**
- `status` — drives when to create transactions
- `customer_id`, `site_id` — link to financial_transactions
- `cost_price`, `sale_price`, `currency` — amounts

---

## 2. Current `financial_transactions` Structure

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `direction` | TEXT | 'income' \| 'expense' |
| `income_type` | TEXT | **'sim_rental'** already supported |
| `amount_original` | DECIMAL(12,2) | NET (KDV haric) |
| `original_currency` | TEXT | 'TRY' \| 'USD' |
| `amount_try` | DECIMAL(12,2) | |
| `exchange_rate` | DECIMAL(10,4) | |
| `transaction_date` | DATE | Required |
| `customer_id` | UUID | FK → customers |
| `site_id` | UUID | FK → customer_sites |
| `description` | TEXT | |
| `payment_method` | TEXT | card, cash, bank_transfer |
| `work_order_id` | UUID | Optional |
| `proposal_id` | UUID | Optional |
| `subscription_payment_id` | UUID | Optional |
| `expense_category_id` | UUID | For expense rows |
| `should_invoice` | BOOLEAN | Income only |
| `has_invoice` | BOOLEAN | Expense only |
| `vat_rate`, `output_vat`, `input_vat` | | |
| `cogs_try` | DECIMAL | For income (links to expense) |

**Missing for SIM traceability:** `sim_card_id` — recommend adding for attribution.

---

## 3. Existing Triggers on `sim_cards`

| Trigger | Event | Purpose |
|---------|-------|---------|
| `update_sim_cards_updated_at` | BEFORE UPDATE | Sets `updated_at` |
| `log_sim_card_history_trigger` | AFTER INSERT OR UPDATE | Writes to `sim_card_history` when `status`, `customer_id`, or `site_id` changes |

**Important:** `log_sim_card_history` fires on status/assignment change. No finance trigger exists yet.

---

## 4. Detecting “Subscription Customer” vs “Wholesale”

**Business rule:** Revenue only for wholesale customers. Subscription customers already have revenue (via `subscription` income_type + `line_fee`).

**There is no `customer_type` or `wholesale` flag** on `customers`. Detection must be done via **subscriptions**:

```
Site has active subscription → Subscription customer → Do NOT create sim_rental income
Site has NO active subscription → Wholesale customer → Create sim_rental income
```

**SQL to check if site has active subscription:**

```sql
SELECT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.site_id = :site_id
  AND s.status = 'active'
) AS has_active_subscription;
```

**Multi-service note:** After migration 00036, a site can have multiple active subscriptions (one per `service_type`: alarm_only, camera_only, internet_only). A single `EXISTS` is enough — any active subscription means “subscription customer.”

---

## 5. Recommended Trigger Implementation Approach

### Option A: Trigger on Status Change (Recommended)

**When:** `AFTER UPDATE ON sim_cards` when `status` changes.

**Logic:**

| Transition | Expense (cost_price) | Income (sale_price) |
|------------|----------------------|----------------------|
| → **active** | Yes (always) | Yes only if site has NO active subscription |
| → **inactive** | Yes (SIM still incurs operator cost) | No |
| → **sold** | No | No |
| → **available** | No | No |

**Details:**
- Create transactions for the **current month** (1st of month as `transaction_date` for consistency).
- Use `expense_categories.code = 'sim_operator'` for SIM cost expense (already exists).
- Add `sim_card_id` to `financial_transactions` for traceability (new column).
- Idempotency: use `sim_card_id` + `period` to avoid duplicates when trigger runs multiple times.

**Pros:** Clear, event-driven, matches “trigger on status change.”
**Cons:** Only creates one month’s worth per status change. Recurring monthly needs a cron.

### Option B: Monthly Cron (Recurring)

A scheduled job runs each month and creates transactions for all SIMs with `status IN ('active','inactive')` for that period. Revenue only for sites without active subscription.

**Pros:** Handles recurring monthly correctly.
**Cons:** Requires cron/scheduler setup; not “trigger on status change.”

### Hybrid (Recommended)

1. **Trigger on status change** — creates initial transaction for the month of the change.
2. **Monthly cron** — creates transactions for all active/inactive SIMs for the current month (with idempotency).

Start with **Option A** (trigger only) for simplicity; add cron later for full recurring.

---

## 6. Example SQL for Trigger Logic

### 6.1 Add `sim_card_id` to `financial_transactions`

```sql
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS sim_card_id UUID REFERENCES sim_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ft_sim_card ON financial_transactions(sim_card_id);
```

### 6.2 Helper: Site Has Active Subscription

```sql
CREATE OR REPLACE FUNCTION site_has_active_subscription(p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.site_id = p_site_id
    AND s.status = 'active'
  );
$$;
```

### 6.3 Main Trigger Function

```sql
CREATE OR REPLACE FUNCTION fn_sim_card_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period TEXT;
  v_tx_date DATE;
  v_customer_id UUID;
  v_site_id UUID;
  v_expense_cat_id UUID;
  v_currency TEXT;
  v_rate DECIMAL(10,4);
  v_amount_try DECIMAL(12,2);
  v_exists BOOLEAN;
  v_is_wholesale BOOLEAN;
BEGIN
  -- Only on UPDATE, when status actually changed
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only process transitions to active, inactive (sold/available = no recurring)
  IF NEW.status NOT IN ('active', 'inactive') THEN
    RETURN NEW;
  END IF;

  -- Must have site and customer for attribution
  IF NEW.site_id IS NULL OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_customer_id := NEW.customer_id;
  v_site_id := NEW.site_id;
  v_period := to_char(CURRENT_DATE, 'YYYY-MM');
  v_tx_date := date_trunc('month', CURRENT_DATE)::DATE;
  v_currency := UPPER(COALESCE(TRIM(NEW.currency), 'TRY'));
  IF v_currency NOT IN ('TRY', 'USD') THEN
    v_currency := 'TRY';
  END IF;

  -- Resolve amount_try (sim_cards: TRY default; USD uses exchange_rates.effective_rate)
  IF v_currency = 'USD' THEN
    SELECT effective_rate INTO v_rate FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1;
    v_rate := COALESCE(v_rate, 1);
    v_amount_try := COALESCE(NEW.cost_price, 0) * v_rate;
  ELSE
    v_rate := NULL;
    v_amount_try := COALESCE(NEW.cost_price, 0);
  END IF;

  -- 1. EXPENSE (cost_price) — always for active and inactive
  IF COALESCE(NEW.cost_price, 0) > 0 THEN
    SELECT id INTO v_expense_cat_id FROM expense_categories WHERE code = 'sim_operator' LIMIT 1;

    IF v_expense_cat_id IS NOT NULL THEN
      -- Idempotency: one expense per sim_card per period
      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'expense' LIMIT 1
      ) INTO v_exists;
      IF NOT v_exists THEN
        INSERT INTO financial_transactions (
          direction, expense_category_id, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          has_invoice, input_vat, vat_rate,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'expense', v_expense_cat_id, NEW.id,
          COALESCE(NEW.cost_price, 0), v_currency, v_amount_try, v_rate,
          true, ROUND(COALESCE(NEW.cost_price, 0) * 0.20, 2), 20,
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' (' || NEW.status || ')',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  -- 2. INCOME (sale_price) — only for active, and only if wholesale (no subscription)
  IF NEW.status = 'active' AND COALESCE(NEW.sale_price, 0) > 0 THEN
    v_is_wholesale := NOT site_has_active_subscription(v_site_id);

    IF v_is_wholesale THEN
      v_amount_try := CASE WHEN v_currency = 'USD' THEN COALESCE(NEW.sale_price, 0) * v_rate ELSE COALESCE(NEW.sale_price, 0) END;

      SELECT EXISTS(
        SELECT 1 FROM financial_transactions
        WHERE sim_card_id = NEW.id AND period = v_period AND direction = 'income' LIMIT 1
      ) INTO v_exists;
      IF NOT v_exists THEN
        INSERT INTO financial_transactions (
          direction, income_type, sim_card_id,
          amount_original, original_currency, amount_try, exchange_rate,
          should_invoice, output_vat, vat_rate, cogs_try,
          transaction_date, customer_id, site_id,
          description, created_at, updated_at
        ) VALUES (
          'income', 'sim_rental', NEW.id,
          COALESCE(NEW.sale_price, 0), v_currency, v_amount_try, v_rate,
          true, ROUND(COALESCE(NEW.sale_price, 0) * 0.20, 2), 20,
          COALESCE(NEW.cost_price, 0),  -- cogs_try for P&L
          v_tx_date, v_customer_id, v_site_id,
          'SIM: ' || COALESCE(NEW.phone_number, '') || ' kiralama',
          now(), now()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sim_card_to_finance
  AFTER UPDATE ON sim_cards
  FOR EACH ROW
  EXECUTE FUNCTION fn_sim_card_to_finance();
```

### 6.4 Currency Handling Note

`sim_cards.currency` is TEXT (default 'TRY'). If you add USD support later, integrate with `exchange_rates` like other finance triggers (e.g. `00052_finance_triggers_currency.sql`). The example above uses a simple inline lookup.

---

## 7. Summary

| Question | Answer |
|----------|--------|
| `sim_cards` structure | Has status, customer_id, site_id, cost_price, sale_price, currency |
| `financial_transactions` | Supports income_type='sim_rental', needs sim_card_id |
| Existing triggers | updated_at, log_sim_card_history — no finance trigger |
| Subscription detection | `EXISTS (SELECT 1 FROM subscriptions WHERE site_id = X AND status = 'active')` |
| Recommended approach | Trigger on status change; add monthly cron later for recurring |
| Expense category | `sim_operator` already exists |
