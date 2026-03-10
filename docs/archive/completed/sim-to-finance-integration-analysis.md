# SIM-to-Finance Integration — Analysis & Recommendations

**Date:** 2025-02-12  
**Status:** Analysis complete, ready for implementation

---

## Part 1: Current State

### 1.1 `financial_transactions` Schema

**Source:** `supabase/migrations/00040_financial_transactions.sql`, `00041_expense_categories.sql`, `00050_subscription_payment_to_finance.sql`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | |
| `direction` | TEXT | Yes | 'income' \| 'expense' |
| `income_type` | TEXT | No | **'sim_rental'** in enum |
| `amount_original` | DECIMAL | Yes | NET |
| `original_currency` | TEXT | Yes | 'TRY' \| 'USD' |
| `amount_try` | DECIMAL | Yes | |
| `exchange_rate` | DECIMAL | No | |
| `transaction_date` | DATE | Yes | |
| `period` | TEXT | Generated | YYYY-MM from transaction_date |
| `customer_id` | UUID | No | FK customers |
| `site_id` | UUID | No | FK customer_sites |
| `description` | TEXT | No | |
| `payment_method` | TEXT | No | card, cash, bank_transfer |
| `work_order_id` | UUID | No | |
| `proposal_id` | UUID | No | |
| `subscription_payment_id` | UUID | No | Added in 00050 |
| `expense_category_id` | UUID | No | For expenses |
| `should_invoice` | BOOLEAN | No | Income only |
| `has_invoice` | BOOLEAN | No | Expense only |
| `vat_rate`, `output_vat`, `input_vat` | | | |
| `cogs_try` | DECIMAL | No | For income |
| `sim_card_id` | UUID | **No** | **Not added yet** — design doc recommends |

**Income types enum:** `subscription`, `sim_rental`, `sale`, `service`, `installation`, `maintenance`, `other`

### 1.2 Expense Categories

**`sim_operator`** exists: code `sim_operator`, name_tr "Operator Faturaları", name_en "SIM Card Operator Bills"

### 1.3 Finance Module Capabilities

- **IncomePage:** Lists income transactions, shows `income_type` column, supports `sim_rental` in dropdown
- **ExpensesPage:** Lists expenses by category
- **API:** `fetchTransactions` — no `income_type` filter in API (would need to add for filtering by sim_rental)
- **v_profit_and_loss:** Union of subscription_payments + financial_transactions; includes `income_type` for income rows
- **Transactions created manually** via QuickEntryModal or API; no automatic SIM creation

### 1.4 Existing Design Doc

**File:** `docs/archived/sim-card-finance-integration-design.md`

- Full trigger logic and SQL examples
- Helper `site_has_active_subscription(p_site_id)`
- Idempotency: `sim_card_id` + `period` to avoid duplicates
- Wholesale vs subscription: only create `sim_rental` income if site has NO active subscription

---

## Part 2: Scenario Recommendations

### Scenario A: SIM becomes active (wholesale rental)

**When:** SIM status: `available` → `active`, customer and site assigned

**Create:**
1. **Expense** — `direction='expense'`, `expense_category_id=sim_operator`, `amount_try=cost_price`, `sim_card_id`, `customer_id`, `site_id`
2. **Income** — `direction='income'`, `income_type='sim_rental'`, `amount_try=sale_price`, `sim_card_id`, `customer_id`, `site_id`, **only if** site has NO active subscription (wholesale)

**Trigger:** `AFTER UPDATE ON sim_cards` when `status` changes  
**Recurring:** One-time for current month on status change. Monthly recurring needs cron (Phase 2).

### Scenario B: SIM becomes inactive or available

**When:** SIM status: `active` → `inactive` or `available`

**Create:**
- **Inactive:** Expense only (operator cost still incurred) — one-time for current month
- **Available:** Nothing (SIM freed, no cost/revenue)

**Trigger:** Same `AFTER UPDATE` trigger

### Scenario C: SIM linked to subscription

**When:** SIM status: `available` → `subscription` (via subscription form)

**Create:** **Nothing.** Subscription revenue comes from `subscription_payments` (line_fee, etc.), not from SIM module. The subscription_payment_to_finance trigger already creates income when payment is marked paid.

**Logic:** Trigger only processes `status IN ('active', 'inactive')`. Subscription status is skipped.

### Scenario D: Monthly recurring revenue

**When:** SIM status: `active` (ongoing), every month

**Create:** Same as Scenario A — income + expense for each active SIM, each month

**Approach:** **Cron job** (pg_cron or external scheduler) runs monthly, creates transactions for all `status IN ('active','inactive')` SIMs with idempotency (`sim_card_id` + `period`).

**Phase:** Build in Phase 2; Phase 1 is trigger-only (one month per status change).

---

## Part 3: Implementation Approach

### Phase 1: Trigger on Status Change (Recommended First)

**Complexity:** Medium

**Steps:**
1. **Migration:** Add `sim_card_id` to `financial_transactions`
2. **Migration:** Create `site_has_active_subscription(p_site_id)` helper
3. **Migration:** Create `fn_sim_card_to_finance()` trigger function
4. **Migration:** Create `trg_sim_card_to_finance` on `sim_cards` AFTER UPDATE

**Handles:**
- available → active: income (wholesale only) + expense
- active → inactive: expense only
- active → available, active → sold: nothing
- subscription: skipped (revenue via subscription_payments)

**Limitation:** Only creates transactions for the **month of the status change**. A SIM that stays active for 3 months will only have 1 month's transactions until Phase 2 cron exists.

### Phase 2: Monthly Cron (Recurring)

**Complexity:** Medium-High

**Steps:**
1. Create cron job (e.g. 1st of each month)
2. Query all SIMs with `status IN ('active','inactive')`
3. For each SIM: check idempotency (`sim_card_id` + `period`), insert if missing
4. Wholesale check for income (no subscription on site)

**Requires:** pg_cron or GitHub Actions / external scheduler

### Phase 3: Finance UI Enhancements (Optional)

- Add `income_type` filter to IncomePage (filter by sim_rental)
- Add `sim_card_id` link to SIM detail from transaction
- Dashboard breakdown by income type

---

## Part 4: Design Doc Adjustments

The design doc's trigger uses `period` in the idempotency check. The `financial_transactions.period` is a GENERATED column — it exists and can be used. The doc's example references `period` in the INSERT — but `period` is auto-generated from `transaction_date`, so we do NOT include it in INSERT.

**Also:** The design doc trigger handles `→ inactive` but not `→ subscription`. We should explicitly skip `subscription` (logic: only process `status IN ('active','inactive')` — so subscription is already skipped).

**INSERT handling:** The design doc is UPDATE-only. If a SIM is created with `status='active'` directly (e.g. via Excel import), we'd need `AFTER INSERT OR UPDATE` and handle INSERT. For now, UPDATE-only is fine (most SIMs are created as available, then updated to active).

---

## Summary

| Scenario | Income | Expense | Trigger/Cron |
|----------|--------|---------|--------------|
| A: available → active (wholesale) | Yes | Yes | Trigger |
| A: available → active (subscription site) | No | Yes | Trigger |
| B: active → inactive | No | Yes | Trigger |
| B: active → available | No | No | Trigger |
| C: → subscription | No | No | Skip |
| D: Monthly (active ongoing) | Yes | Yes | Cron (Phase 2) |

**Next step:** Implement Phase 1 migration (sim_card_id, trigger function, trigger).
