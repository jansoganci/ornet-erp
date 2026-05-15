# Finance Module — Hybrid Payment Implementation Plan

> Status: APPROVED — ready to implement  
> Scope: Bug fixes (G1/G2/G5) + payment lifecycle (receivables tracking) + WO completion modal

---

## What We're Solving

The current finance module has three data-integrity bugs and no payment lifecycle. Completing a work order records revenue as instantly "paid" with no tracking of how or when money was actually collected. This plan:

1. Fixes the three P&L bugs
2. Adds a `payment_status` column to `financial_transactions` to distinguish paid vs. pending documents
3. Adds a `financial_transaction_payments` ledger table for partial payment events
4. Adds a WO Completion Modal that routes cash/card to "paid" immediately, bank transfer to "unpaid" (appears on a new Receivables screen)
5. Adds a `/finance/receivables` screen for tracking and recording bank transfer collections

---

## Part 1 — Database

### Migration 00207 — P&L View Fix + Hybrid Schema

**File:** `supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql`

#### Bug G1 — Double-counting subscription revenue

`v_profit_and_loss` has a `UNION ALL` branch that reads directly from `subscription_payments`. But `trg_subscription_payment_to_finance` also inserts those same payments into `financial_transactions`. Subscription income is counted twice.

**Fix:** Drop the `subscription_payments` UNION branch entirely. Rows in `financial_transactions` written by the trigger are the single source of truth.

#### Bug G2 — Soft-deleted rows leaking into reports

Both income and expense sides of `v_profit_and_loss` are missing `WHERE deleted_at IS NULL`.

**Fix:** Add `AND ft.deleted_at IS NULL` to both WHERE clauses.

#### Bug G5 — COGS multiplier

Already fixed in migration 00201 on the trigger side. Removing the `subscription_payments` UNION branch (G1) also removes the broken CASE statement that reproduced the bug in the old view.

---

#### Schema addition — `payment_status` on `financial_transactions`

```sql
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
  CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid'));
```

All historical rows default to `'paid'` — no data migration needed.

---

#### New table — `financial_transaction_payments`

```
id              UUID        PRIMARY KEY DEFAULT gen_random_uuid()
transaction_id  UUID        NOT NULL → financial_transactions(id) ON DELETE CASCADE
amount_try      DECIMAL     NOT NULL CHECK (amount_try > 0)
payment_method  TEXT        NOT NULL CHECK IN ('cash','card','bank_transfer')
paid_at         DATE        NOT NULL DEFAULT CURRENT_DATE
notes           TEXT        nullable
created_by      UUID        → auth.users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at      TIMESTAMPTZ nullable  (soft-delete)
```

**Trigger `fn_update_transaction_payment_status`:**  
Fires AFTER INSERT / UPDATE / DELETE on `financial_transaction_payments`. Sums all non-deleted payment rows for the affected `transaction_id` and recalculates `financial_transactions.payment_status`:

- sum = 0               → `'unpaid'`
- 0 < sum < amount_try  → `'partially_paid'`
- sum >= amount_try     → `'paid'`

**RLS:**
- SELECT: authenticated, `deleted_at IS NULL`
- INSERT / UPDATE: admin or accountant role only

---

### Migration 00208 — WO Completion RPC

**File:** `supabase/migrations/00208_complete_work_order_with_payment_rpc.sql`

**Function signature:**
```sql
fn_complete_work_order_with_payment(
  p_work_order_id   UUID,
  p_payment_method  TEXT,
  p_collection_date DATE    DEFAULT CURRENT_DATE,
  p_vat_rate        NUMERIC DEFAULT NULL   -- NULL = use WO's stored vat_rate
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
```

**Logic:**
1. Validate `auth.uid()` is not null
2. Validate `p_payment_method IN ('cash', 'card', 'bank_transfer')`
3. Fetch work order; validate `status = 'in_progress'`
4. `UPDATE work_orders SET status = 'completed', completed_at = p_collection_date`  
   → This fires the existing `auto_record_work_order_revenue` trigger, which inserts the income row into `financial_transactions` using the WO's stored `vat_rate`
5. If `proposal_id IS NOT NULL` → return `{ status: 'completed_proposal_linked' }` (proposal trigger handles revenue; no payment row needed)
6. Find the newly inserted income transaction (`work_order_id = p_work_order_id`, `direction = 'income'`, most recent)
7. If `p_vat_rate IS NOT NULL AND p_vat_rate != workorder.vat_rate`:  
   Recalculate and UPDATE the finance row: `output_vat = amount_try * p_vat_rate / 100`, `vat_rate = p_vat_rate`
8. UPDATE `payment_method` on the transaction row to `p_payment_method`
9. **Cash or Card:** INSERT into `financial_transaction_payments` with full amount → trigger recalculates `payment_status = 'paid'`
10. **Bank Transfer:** UPDATE `financial_transactions SET payment_status = 'unpaid'`
11. Return `{ status: 'completed', transaction_id, payment_status }`

**Grant:** `EXECUTE ON FUNCTION ... TO authenticated`

---

## Part 2 — Backend / API Layer

All Supabase calls live in `api.js` files. No direct Supabase calls in components.

### 2.1 `src/features/finance/api.js` — additions

**Query key factories:**
```js
export const receivableKeys = {
  all: ['receivables'],
  lists: () => [...receivableKeys.all, 'list'],
  list: (filters) => [...receivableKeys.lists(), filters],
};

export const transactionPaymentKeys = {
  all: ['transaction_payments'],
  byTransaction: (id) => [...transactionPaymentKeys.all, id],
};
```

**New functions:**
- `fetchReceivables(filters)` — queries `financial_transactions` where `direction = 'income'` AND `payment_status IN ('unpaid', 'partially_paid')`, joins customer name and work order `form_no`. Optional `search` filter on customer name or form_no.
- `fetchTransactionPayments(transactionId)` — queries `financial_transaction_payments` where `transaction_id = X` and `deleted_at IS NULL`, ordered by `paid_at DESC`
- `createTransactionPayment({ transactionId, amountTry, paymentMethod, paidAt, notes })` — INSERT into `financial_transaction_payments` with `created_by = auth.uid()`

### 2.2 `src/features/finance/hooks.js` — additions

- `useReceivables(filters)` — `staleTime: 60_000`
- `useTransactionPayments(transactionId)` — `enabled: !!transactionId`
- `useCreateTransactionPayment()`:
  - On success invalidates: `receivableKeys.lists()`, `transactionPaymentKeys.byTransaction(variables.transactionId)`, `transactionKeys.lists()`, `financeDashboardKeys.all`, `dashboardV2Keys.all`
  - Toast on success: `t('finance:receivables.addPayment.confirmButton')` (reuses the button label)

### 2.3 `src/features/workOrders/api.js` — addition

```js
export async function completeWorkOrderWithPayment({
  workOrderId,
  paymentMethod,
  collectionDate,
  vatRate,         // effective rate chosen in modal (number or null)
}) {
  const { data, error } = await supabase.rpc('fn_complete_work_order_with_payment', {
    p_work_order_id:   workOrderId,
    p_payment_method:  paymentMethod,
    p_collection_date: collectionDate,
    p_vat_rate:        vatRate ?? null,
  });
  if (error) throw error;
  return data;
}
```

### 2.4 `src/features/workOrders/hooks.js` — addition

```js
export function useCompleteWorkOrderWithPayment() {
  // On success invalidates:
  // workOrderKeys.detail(id), workOrderKeys.auditLogs(id), workOrderKeys.lists(),
  // operationsApi.keys.all,
  // financeDashboardKeys.all, transactionKeys.lists(), profitAndLossKeys.all,
  // financeHealthKeys.all, receivableKeys.lists()
}
```

---

## Part 3 — Frontend

### 3.1 New Component: `WorkOrderCompletionModal`

**File:** `src/features/workOrders/components/WorkOrderCompletionModal.jsx`

**When it appears:** User clicks "Tamamla" on a **standalone** work order (`proposal_id IS NULL`).  
Proposal-linked WOs keep the existing simple confirmation modal — no change.

**Props:** `{ open, onClose, workOrder }`

#### Fields

| Field | Type | Default | Notes |
|---|---|---|---|
| Tamamlanma / Tahsilat Tarihi | `<input type="date">` | today (`YYYY-MM-DD`) | Required |
| KDV Dahil mi? | checkbox | `workOrder.vat_rate > 0` | Toggles VAT on/off |
| Ödeme Yöntemi | radio group | `cash` | 3 options: Nakit / Kredi Kartı / Havale·EFT |

#### Amount Summary (read-only, dynamic)

Derived from work order materials. Recalculates when the VAT checkbox is toggled.

```
Net Tutar   = grandTotal  (subtotal after discount — never changes)
KDV         = vatCheckbox ? grandTotal * (workOrder.vat_rate / 100) : 0
Toplam      = Net + KDV
```

`grandTotal` is computed the same way as `WorkOrderDetailPage` does it (reduce materials, apply discount).

#### Bank Transfer hint

When `bank_transfer` radio is selected, show an info callout:  
*"Havale / EFT seçilirse tahsilat, 'Bekleyen Tahsilatlar' ekranında takip edilir."*

#### VAT toggle effect on RPC

When the checkbox is unchecked (VAT toggled off), the modal sends `vatRate: 0` to the API.  
When checked, it sends `vatRate: workOrder.vat_rate` (the stored rate).  
The RPC corrects the finance row's `output_vat` accordingly (step 7 in the RPC logic).

#### Submit

Calls `useCompleteWorkOrderWithPayment`. On success: `onClose()` — the cache invalidation refreshes the detail page.

**i18n namespace:** `workOrders:completion.*`

---

### 3.2 Update: `WorkOrderStatusActions`

**File:** `src/features/workOrders/components/WorkOrderStatusActions.jsx`

Add `onComplete` prop (optional). When provided, the "Tamamla" button calls `onComplete()` instead of `setStatusToUpdate('completed')`.

```jsx
// before
onClick={() => setStatusToUpdate('completed')}

// after
onClick={() => onComplete ? onComplete() : setStatusToUpdate('completed')}
```

No other changes. The component does not know whether the WO is standalone — that decision lives in `WorkOrderDetailPage`.

---

### 3.3 Update: `WorkOrderDetailPage`

**File:** `src/features/workOrders/WorkOrderDetailPage.jsx`

Changes:
1. Add `showCompletionModal` state (`false`)
2. Detect standalone: `const isStandalone = !workOrder.proposal_id`
3. Pass `onComplete` to `WorkOrderStatusActions` only for standalone WOs:
   ```jsx
   <WorkOrderStatusActions
     workOrder={workOrder}
     setStatusToUpdate={setStatusToUpdate}
     onComplete={isStandalone ? () => setShowCompletionModal(true) : undefined}
   />
   ```
4. Same logic for mobile FAB "Tamamla" button
5. Render `<WorkOrderCompletionModal open={showCompletionModal} onClose={() => setShowCompletionModal(false)} workOrder={workOrder} />`
6. Keep existing `statusToUpdate` modal for: Start, Cancel, and proposal-linked completions — no change to those paths

---

### 3.4 New Page: `ReceivablesPage`

**File:** `src/features/finance/ReceivablesPage.jsx`

**Route:** `/finance/receivables` (behind `RoleRoute`)

**What it shows:** Income documents with `payment_status IN ('unpaid', 'partially_paid')`.

#### Table columns

| Column | Source field |
|---|---|
| Müşteri | joined customer name |
| İş Emri | `form_no` as a link (ExternalLink icon) → `/work-orders/:work_order_id` |
| Net Tutar | `amount_try` |
| KDV | `output_vat` |
| Toplam | `amount_try + output_vat` |
| Durum | `payment_status` badge (Ödenmedi / Kısmi Ödeme) |
| Tarih | `transaction_date` |
| — | "Tahsilat Ekle" button |

**State:** `selectedTransactionId` — set when user clicks "Tahsilat Ekle"; drives `AddPaymentModal`.

**Empty state:** When no receivables exist, show an empty state card.

---

### 3.5 New Component: `AddPaymentModal`

**File:** `src/features/finance/components/AddPaymentModal.jsx`

**Props:** `{ open, transactionId, transactionData, onClose }`

**Shows at top (read-only):** Document total breakdown (Net / KDV / Toplam).

#### Fields

| Field | Type | Default |
|---|---|---|
| Tahsilat Tutarı (TRY) | number input | remaining balance = `amount_try + output_vat - sum(existing payments)` |
| Ödeme Yöntemi | select | `bank_transfer` |
| Tahsilat Tarihi | date | today |
| Not | textarea | empty |

**Submit:** Calls `useCreateTransactionPayment`. Cache invalidation from hook refreshes the table. On success: toast + `onClose()`.

---

## Part 4 — Routing & Navigation

### 4.1 `src/App.jsx`

Add import:
```js
import { ReceivablesPage } from './features/finance';
```

Add route (alongside other `/finance/*` routes):
```jsx
<Route path="finance/receivables" element={<RoleRoute><ReceivablesPage /></RoleRoute>} />
```

### 4.2 `src/features/finance/index.js`

```js
export { ReceivablesPage } from './ReceivablesPage';
```

### 4.3 `src/components/layout/navItems.js`

Add `Landmark` to lucide imports. Add to the `finance` group children:
```js
{ to: '/finance/receivables', icon: Landmark, labelKey: 'nav.finance.receivables', canWriteOnly: true }
```

---

## Part 5 — i18n

### `src/locales/tr/workOrders.json` — add `completion` section

```json
"completion": {
  "title": "İş Emrini Tamamla",
  "collectionDate": "Tamamlanma / Tahsilat Tarihi",
  "vatIncluded": "KDV Dahil",
  "paymentMethods": {
    "cash": "Nakit",
    "card": "Kredi Kartı",
    "bank_transfer": "Havale / EFT"
  },
  "bankTransferHint": "Havale / EFT seçilirse tahsilat, 'Bekleyen Tahsilatlar' ekranında takip edilir.",
  "confirmButton": "Tamamla ve Kaydet",
  "amountSummary": {
    "net": "Net Tutar",
    "vat": "KDV",
    "total": "Ödenecek Toplam"
  }
}
```

### `src/locales/tr/finance.json` — add `receivables` section

```json
"receivables": {
  "title": "Bekleyen Tahsilatlar",
  "subtitle": "Havale / EFT bekleyen iş emirleri",
  "empty": {
    "title": "Bekleyen tahsilat yok",
    "description": "Tüm iş emirleri tahsil edildi."
  },
  "columns": {
    "customer": "Müşteri",
    "workOrder": "İş Emri",
    "netAmount": "Net Tutar",
    "vatAmount": "KDV",
    "totalAmount": "Toplam",
    "status": "Durum",
    "date": "Tarih"
  },
  "status": {
    "unpaid": "Ödenmedi",
    "partially_paid": "Kısmi Ödeme",
    "paid": "Tahsil Edildi"
  },
  "addPayment": {
    "title": "Tahsilat Ekle",
    "documentTotal": "Belge Tutarı",
    "amount": "Tahsilat Tutarı (TRY)",
    "paymentMethod": "Ödeme Yöntemi",
    "paidAt": "Tahsilat Tarihi",
    "notes": "Not",
    "notesPlaceholder": "İsteğe bağlı not...",
    "confirmButton": "Tahsilatı Kaydet"
  }
}
```

### `src/locales/tr/common.json` — add to `nav.finance` object

```json
"receivables": "Bekleyen Tahsilatlar"
```

---

## Implementation Order (Dependency-safe)

```
Step  1  supabase/migrations/00207_fix_pl_view_and_hybrid_payment_schema.sql
Step  2  supabase/migrations/00208_complete_work_order_with_payment_rpc.sql
Step  3  src/locales/tr/workOrders.json         (add completion section)
Step  4  src/locales/tr/finance.json            (add receivables section)
Step  5  src/locales/tr/common.json             (add nav.finance.receivables)
Step  6  src/features/finance/api.js            (receivableKeys, transactionPaymentKeys, fetch/create functions)
Step  7  src/features/finance/hooks.js          (useReceivables, useTransactionPayments, useCreateTransactionPayment)
Step  8  src/features/workOrders/api.js         (completeWorkOrderWithPayment — already done)
Step  9  src/features/workOrders/hooks.js       (useCompleteWorkOrderWithPayment)
Step 10  WorkOrderCompletionModal.jsx           (new component)
Step 11  WorkOrderStatusActions.jsx             (add onComplete prop)
Step 12  WorkOrderDetailPage.jsx               (wire modal + standalone detection)
Step 13  AddPaymentModal.jsx                   (new component)
Step 14  ReceivablesPage.jsx                   (new page)
Step 15  src/features/finance/index.js         (export ReceivablesPage)
Step 16  src/App.jsx                           (add /finance/receivables route)
Step 17  src/components/layout/navItems.js     (add nav entry)
```

---

## What We Are NOT Changing

- `auto_record_work_order_revenue` trigger — we build the RPC on top of it, not replace it
- Proposal-linked WO completion — keeps the existing simple confirmation modal
- Manual income/expense form entries — default to `payment_status = 'paid'`; no change
- Subscription and SIM income paths — fully automated; no payment UI needed
- Any existing finance views or reports — only `v_profit_and_loss` is rewritten to fix bugs

---

## Business Rules Summary

| Payment Method | Immediate status | Where it appears |
|---|---|---|
| Nakit (Cash) | `paid` | History only |
| Kredi Kartı (Card) | `paid` | History only |
| Havale / EFT | `unpaid` | Receivables screen → until payment recorded |
| Partial payment recorded | `partially_paid` | Still on receivables screen |
| Full payment recorded | `paid` | Removed from receivables screen |
