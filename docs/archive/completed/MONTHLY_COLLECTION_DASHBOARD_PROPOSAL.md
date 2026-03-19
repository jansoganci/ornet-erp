# Monthly Collection Dashboard & Deep Linking — Technical Proposal

> **Status:** Research / Architecture  
> **Date:** 2026-03-19  
> **Scope:** Subscription payment collection workflow, notification deep linking, VAT display

---

## 1. Executive Summary

The user wants a dedicated "Collection Desk" experience: when the 25th-of-month notification ("Bu ay X aboneliğin ödemesi henüz alınmadı") is clicked, they should land on a filtered list of **current-period pending payments** with the ability to record payments directly from the list, without navigating into each subscription's detail page.

---

## 2. DB/API Analysis

### 2.1 Current Data Structure

| Table / RPC | Relevant Fields | Notes |
|-------------|-----------------|-------|
| `subscription_payments` | `id`, `subscription_id`, `payment_month`, `status`, `amount`, `vat_amount`, `total_amount`, `should_invoice` | `payment_month` is always 1st of month; `amount` = net, `total_amount` = gross |
| `subscriptions` | `official_invoice`, `vat_rate`, `billing_frequency` | `official_invoice` (default true) = will need invoice when paid |
| `subscriptions_detail` | View joining sub + site + customer | Has `has_overdue_pending` (past months), but **no** "pending this month" flag |
| `fn_record_payment` | RPC: `p_payment_id`, `p_payment_date`, `p_payment_method`, `p_should_invoice`, `p_vat_rate`, ... | Atomic; no changes needed |

### 2.2 "Current Period" Logic

- **Billing cycles:** `monthly`, `3_month`, `6_month`, `yearly`
- Each `subscription_payment` row has `payment_month` (e.g. `2025-03-01` for March).
- "Current period" = `payment_month` falls in the **current calendar month**:
  - `payment_month >= date_trunc('month', CURRENT_DATE)::DATE`
  - `payment_month < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE`

This matches the logic in `fn_create_pending_payments_summary_notification()` (migration 00149).

### 2.3 Can We Fetch "This Month's Due List" Efficiently?

**Yes.** The existing schema is sufficient. Recommended approach:

**Option A — New RPC (recommended):**

```sql
-- Returns one row per pending payment in current month, with subscription + customer info
CREATE OR REPLACE FUNCTION get_pending_payments_collection(p_year INT, p_month INT)
RETURNS TABLE (
  payment_id UUID,
  subscription_id UUID,
  payment_month DATE,
  amount DECIMAL,
  vat_amount DECIMAL,
  total_amount DECIMAL,
  official_invoice BOOLEAN,
  vat_rate DECIMAL,
  company_name TEXT,
  site_name TEXT,
  account_no TEXT,
  billing_frequency TEXT,
  ...
)
```

- Single query, indexed on `(status, payment_month)`.
- `subscriptions_detail` already has `idx_sub_payments_status` and `idx_sub_payments_month`.

**Option B — Client-side filter:**

- Fetch `subscription_payments` with `status = 'pending'` and `payment_month` in current month.
- Join with `subscriptions_detail` in a second query or via a view.
- Less efficient (two round-trips, more data).

**Recommendation:** Add `get_pending_payments_collection(year, month)` RPC. It can reuse existing indexes and return exactly the columns needed for the Collection table.

### 2.4 `fn_record_payment` — No Changes Needed

The existing RPC accepts `p_payment_id` and payment data. A "Quick Pay" action from the Collection list would:

1. Open `PaymentRecordModal` (or a slim inline variant) with `payment` pre-filled.
2. Call `recordPayment(paymentId, data)` from `paymentsApi.js`.
3. Invalidate the collection query and subscription queries on success.

---

## 3. UX Proposal

### 3.1 Route: New Page vs. Collection Mode Toggle

| Option | Pros | Cons |
|--------|------|------|
| **A. New page `/finance/collection`** | Clear mental model; dedicated URL; easy to deep-link; fits "Collection Desk" metaphor | Extra nav item; possible duplication of subscription list logic |
| **B. Subscriptions + `?view=collection`** | Reuses existing page; no new route | Mixes two use cases; filters/state can conflict; harder to maintain |
| **C. Subscriptions + `?pending=this_month`** | Minimal change; reuses list | Same as B; filter semantics less clear |

**Recommendation: Option A — New page `/finance/collection`**

- Aligns with user vision: "Collection Desk" as a distinct workflow.
- Deep link is clean: `/finance/collection`.
- Separation of concerns: Subscriptions list = manage subscriptions; Collection = collect payments.
- Finance module already has `/finance`, `/finance/expenses`, etc.; Collection fits naturally under Finance.

### 3.2 Navigation Placement

- Add under **Finans** group: "Tahsilat Masası" / "Collection Desk" → `/finance/collection`.
- Role: Admin + Accountant only (same as subscription payments).

### 3.3 "Quick Pay" Row Actions

| Approach | Description |
|----------|-------------|
| **Inline button** | "Öde" / "Record" button per row → opens `PaymentRecordModal` with that payment |
| **Expandable row** | Row expands to show payment form (method, date, invoice toggle) — more compact but denser |
| **Bulk select + batch modal** | Select multiple rows, "Record selected" → opens a batch flow (more complex) |

**Recommendation:** Inline "Öde" button per row → opens existing `PaymentRecordModal`. Reuse `PaymentRecordModal` as-is; it already supports `payment` prop and `recordPayment`. Minimal new code, consistent UX with Subscription Detail page.

### 3.4 UI Structure (Mockup Description)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tahsilat Masası — Mart 2025                                    [Yıl ▼] [Ay ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Özet: 12 bekleyen ödeme · 8.450 ₺ net · 10.140 ₺ KDV dahil (faturalı)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Müşteri        │ Lokasyon   │ Hesap No │ Dönem    │ Net      │ Toplam   │ İşlem │
│────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────│
│ Acme Ltd       │ Merkez     │ 12345    │ Mar 2025 │ 450 ₺    │ 540 ₺    │ [Öde]│
│ Beta A.Ş.      │ Şube 1     │ 12346    │ Mar 2025 │ 320 ₺    │ 320 ₺    │ [Öde]│
│ ...            │            │          │          │          │          │      │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Columns:** Customer, Site, Account No, Period (month label), Net amount, Total Due (gross if `official_invoice`), Action (Öde).
- **Summary line:** Total pending count, total net, total gross (for invoice-required only).
- **Filters:** Year/month dropdowns (default: current month).
- **Empty state:** "Bu ay bekleyen ödeme yok" when no pending payments.

---

## 4. KDV (VAT) Logic

### 4.1 Net vs. Gross Display

| Subscription Type | `official_invoice` | Display "Total Due" |
|-------------------|--------------------|----------------------|
| Requires invoice  | `true`             | Gross = `amount + vat_amount` (or `total_amount` from payment row) |
| No invoice        | `false`            | Net = `amount` only |

For **pending** payments, `vat_amount` and `total_amount` on `subscription_payments` are pre-calculated at generation time (from subscription `vat_rate`). So we can use:

- **Net:** `payment.amount`
- **Gross (KDV dahil):** `payment.total_amount` (or `amount + amount * vat_rate/100` if we need to recalc)

The payment row already has `total_amount`; for pending rows it reflects the subscription's `vat_rate` at generation. Use `payment.total_amount` when `official_invoice` is true, else `payment.amount`.

### 4.2 Table Column Proposal

| Column       | Logic |
|--------------|-------|
| **Net (₺)**  | `payment.amount` — always shown |
| **Toplam (₺)** | `official_invoice ? payment.total_amount : payment.amount` — "Total Due" |
| **KDV**      | Optional badge/tooltip: "KDV dahil" when `official_invoice`, or "KDV yok" when not |

Alternatively, a single "Tutar" column with:
- `450 ₺` when no invoice
- `450 ₺ + 90 ₺ KDV = 540 ₺` or `540 ₺ (KDV dahil)` when invoice required

**Recommendation:** Two columns — "Net" and "Toplam" — with "Toplam" = gross when `official_invoice`, else same as Net. Keeps the table scannable and avoids ambiguity.

---

## 5. Notification Deep Linking

### 5.1 Current Behavior

- **Source:** `fn_create_pending_payments_summary_notification()` (migration 00149).
- **Schedule:** pg_cron `'0 6 25 * *'` (25th of every month, 06:00 UTC = 09:00 Turkey).
- **Notification:** `type = 'pending_payments_summary'`, `related_entity_type = 'subscription'`, `related_entity_id = NULL`.
- **Frontend:** `NotificationItem.jsx` → `getRoute()` returns `/subscriptions` for `pending_payments_summary`.

### 5.2 Required Change

**File:** `src/features/notifications/components/NotificationItem.jsx`

**Current:**
```js
if (notificationType === 'pending_payments_summary') return '/subscriptions';
```

**Proposed:**
```js
if (notificationType === 'pending_payments_summary') return '/finance/collection';
```

Single-line change. No backend changes needed; the notification already targets the right concept (pending payments). The redirect URL is the only update.

---

## 6. Implementation Checklist (High Level)

| # | Task | Effort |
|---|------|--------|
| 1 | Add RPC `get_pending_payments_collection(year, month)` | Small |
| 2 | Add API `fetchPendingPaymentsCollection(year, month)` + hook | Small |
| 3 | Create `CollectionDeskPage.jsx` at `/finance/collection` | Medium |
| 4 | Add route + nav item "Tahsilat Masası" | Small |
| 5 | Reuse `PaymentRecordModal` for Quick Pay; wire to collection list | Small |
| 6 | Update `NotificationItem.getRoute` for `pending_payments_summary` | Trivial |
| 7 | Add i18n keys for Collection Desk | Small |

---

## 7. Open Questions

1. **Billing frequency display:** Should the table show "Aylık" / "3 Aylık" / etc. for context, or is Period (month) enough?
2. **Overdue in current month:** If a payment from a past month is still pending, it won't appear in "current month" collection. Should we add an "Overdue" section or filter?
3. **Default payment method:** When opening Quick Pay from Collection, should we pre-fill `payment_method` from the subscription's `payment_method_id` (if any)?

---

## 8. References

- Migration 00149: `fn_create_pending_payments_summary_notification`
- Migration 00098: `fn_record_payment`
- `src/features/subscriptions/paymentsApi.js`: `recordPayment`
- `src/features/subscriptions/components/PaymentRecordModal.jsx`
- `src/features/notifications/components/NotificationItem.jsx`: `getRoute`
