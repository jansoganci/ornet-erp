# Proposal Module — Multi-Currency Data Flow Analysis

> Analyzed: 2026-04-03  
> Scope: TRY vs USD currency support — UI, persistence, Proposal→Work Order bridge, DB schema, lifecycle, and financial recording.

---

## 1. Currency Support in Proposals

### Available Currencies

```
schema.js:11   export const CURRENCIES = ['TRY', 'USD'];
schema.js:73   currency: z.enum(['TRY', 'USD']).default('USD'),
schema.js:154  currency: 'USD',   // default value
```

Users can create proposals in **TRY or USD** only. EUR is not supported for the main proposal currency (it exists only in `annual_fixed_costs`, a separate line-item section that tracks per-row currencies independently).

### Where Currency is Selected in the UI

The currency selector is a `<Select>` rendered in **Step 0** of the proposal form (the "Project Info" step):

```
ProposalFormPage.jsx:534-539
  <Select
    label={t('common:fields.currency')}
    options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
    error={errors.currency?.message}
    {...register('currency')}
  />
```

The selected value is watched and passed down to `<ProposalItemsEditor>`:

```
ProposalFormPage.jsx:173    const selectedCurrency = watch('currency') ?? 'USD';
ProposalFormPage.jsx:633    currency={selectedCurrency}
```

The `ProposalItemsEditor` uses `currency` as a display hint (e.g., currency symbol in column headers). The form schema has a **single** `unit_price` field per item — currency routing to the correct DB column happens at the API layer, not the form layer.

---

## 2. Data Persistence Logic

### Form → API Flow for CREATE

```
User fills form (unit_price field = price in selected currency)
  ↓
handleSubmit(onSubmit) → persistSubmit(data)
  ProposalFormPage.jsx:337-382
  ↓
createMutation.mutateAsync({ ...proposalPayload, items, annual_fixed_costs })
  → proposals/api.js: createProposal()
  ↓
buildProposalItemInsertRow(proposalId, item, index, _currency)
  proposals/api.js:37-76
```

### `buildProposalItemInsertRow` — Currency Routing (api.js:37-76)

This function is the **single point of currency routing** for item persistence. It receives `currency` (the parent proposal's currency) and routes the user-entered `unit_price` and `cost` to the correct dual columns:

```
proposals/api.js:59-74

unit_price:          currency === 'USD' ? 0         : unitPrice   // TRY column
unit_price_usd:      currency === 'USD' ? unitPrice : 0           // USD column
cost:                currency === 'USD' ? null       : cost
cost_usd:            currency === 'USD' ? cost       : null
product_cost:        currency === 'USD' ? null       : productCost
product_cost_usd:    currency === 'USD' ? productCost : null
labor_cost:          currency === 'USD' ? null       : laborCost
labor_cost_usd:      currency === 'USD' ? laborCost  : null
shipping_cost:       currency === 'USD' ? null       : shippingCost
shipping_cost_usd:   currency === 'USD' ? shippingCost : null
material_cost:       currency === 'USD' ? null       : materialCost
material_cost_usd:   currency === 'USD' ? materialCost : null
misc_cost:           currency === 'USD' ? null       : miscCost
misc_cost_usd:       currency === 'USD' ? miscCost   : null
```

**Rule:** Only one side is populated; the other is `0` (for `unit_price`) or `null` (for costs).

### `proposals` Table — `total_amount` Calculation (api.js:279-295)

After inserting items, the total is calculated client-side and written back:

```
proposals/api.js:279-295

const total = items.reduce((sum, i) => sum + lineTotalForProposalItem(i), 0);
// lineTotalForProposalItem = quantity * unit_price  (from FORM value, pre-routing)

if (cur === 'USD') {
  updatePayload.total_amount_usd = total;
  updatePayload.total_amount = 0;
} else {
  updatePayload.total_amount = total;
  updatePayload.total_amount_usd = 0;
}
```

Note: `lineTotalForProposalItem` reads the raw form field `item.unit_price` (the unified form field), not the DB columns, which is correct at this stage.

### Form → API Flow for UPDATE

```
updateItemsMutation.mutateAsync({ proposalId: id, items })
  → proposals/api.js: updateProposalItems(proposalId, items)
  proposals/api.js:332-376
```

`updateProposalItems` re-fetches the proposal's currency from DB before routing:

```
proposals/api.js:341-342
const { data: _cRow } = await supabase.from('proposals').select('currency').eq('id', proposalId).single();
const _currency = _cRow?.currency || 'USD';
```

Then calls `buildProposalItemInsertRow` with the fetched currency. This is correct.

---

## 3. Database Schema — Dual-Column Model

### `proposals` Table (currency columns)

| Column | Type | TRY | USD | Notes |
|--------|------|-----|-----|-------|
| `currency` | TEXT | `'TRY'` | `'USD'` | Controls which amount column is active |
| `total_amount` | DECIMAL(12,2) | filled | `0` | Added in migration 00051 |
| `total_amount_usd` | DECIMAL(12,2) | `0` | filled | Original column (migration 00027) |
| `vat_rate` | DECIMAL(5,2) | — | — | Currency-agnostic percentage |
| `discount_percent` | DECIMAL(5,2) | — | — | Currency-agnostic percentage |

### `proposal_items` Table (dual-column model)

| Column | TRY Proposal | USD Proposal | Generated? |
|--------|-------------|-------------|-----------|
| `unit_price` | filled | `0` | No — added 00051 |
| `unit_price_usd` | `null` | filled | No — original 00027 |
| `line_total` | `quantity × unit_price` | `0` | YES (STORED) — added 00051 |
| `total_usd` | `0` | `quantity × unit_price_usd` | YES (STORED) — original 00027 |
| `cost` | filled | `null` | No |
| `cost_usd` | `null` | filled | No |
| `product_cost` | filled | `null` | No — added 00029 |
| `product_cost_usd` | `null` | filled | No — added 00029 |
| `labor_cost` | filled | `null` | No |
| `labor_cost_usd` | `null` | filled | No |
| `shipping_cost` | filled | `null` | No |
| `shipping_cost_usd` | `null` | filled | No |
| `material_cost` | filled | `null` | No |
| `material_cost_usd` | `null` | filled | No |
| `misc_cost` | filled | `null` | No |
| `misc_cost_usd` | `null` | filled | No |

**DB-level guard (migration 00131):** A trigger `trg_proposal_items_currency_guard` enforces this rule at INSERT/UPDATE: if the parent proposal's currency is `'TRY'`, all `_usd` columns are forced to `NULL`, even if the app incorrectly sends a value.

### `work_orders` Table (currency columns)

| Column | TRY | USD | Notes |
|--------|-----|-----|-------|
| `currency` | `'TRY'` | `'USD'` | Default `'TRY'` |
| `amount` | filled | filled | Single header amount; display only |
| `vat_rate` | — | — | Currency-agnostic |

### `work_order_materials` Table (dual-column model)

| Column | TRY WO | USD WO | Notes |
|--------|--------|--------|-------|
| `unit_price` | filled | `0` | Added 00051, NOT NULL DEFAULT 0 |
| `unit_price_usd` | `0` | filled | Added 00048, NOT NULL DEFAULT 0 |
| `cost` | filled | `null` | Added 00051 |
| `cost_usd` | `null` | filled | Added 00048 |

No generated columns — no `line_total` or `total_usd` equivalents.

---

## 4. Proposal → Work Order Flow

### Trigger Point

The flow is initiated from `CreateWorkOrderFromProposalModal` when the user clicks "Create Work Order" from the Proposal Detail page.

```
CreateWorkOrderFromProposalModal.jsx:26-40

createMutation.mutateAsync({
  proposalId: proposal.id,
  siteId: proposal.site_id,
  workType,
  scheduledDate, scheduledTime, assignedTo,
  amount: proposal.total_amount ?? proposal.total_amount_usd ?? null,
  currency: proposal.currency ?? 'TRY',          // ← proposal currency inherited
  materialsDiscountPercent: proposal.materials_discount_percent ?? proposal.discount_percent ?? 0,
  vatRate: proposal.vat_rate ?? 20,
  description: proposal.title ?? null,
  items,                                          // ← raw DB rows from proposal_items
})
```

`items` here are the raw `proposal_items` rows fetched from DB (including both `unit_price` and `unit_price_usd` columns).

### `createWorkOrderFromProposal` — Item Mapping (workOrders/api.js:302-315)

```
workOrders/api.js:303-314

const rowCurrency = currency || 'TRY';
const materialRows = items.map((item, index) => {
  const resolvedPrice = resolveProposalItemUnitPrice(item, rowCurrency);
  const hasCost = item.cost != null || item.cost_usd != null;
  const resolvedCost = hasCost ? resolveProposalItemCost(item, rowCurrency) : null;
  return {
    work_order_id: created.id,
    sort_order: item.sort_order ?? index,
    description: item.description ?? '',
    quantity: item.quantity ?? 1,
    unit: item.unit || 'adet',
    material_id: item.material_id || null,
    ...splitWorkOrderMaterialAmounts(rowCurrency, resolvedPrice, resolvedCost),
  };
});
```

`resolveProposalItemUnitPrice(item, currency)` reads the correct DB column (`unit_price_usd` for USD, `unit_price` for TRY) via `proposalCalc.js:42-44`. This is correct.

`splitWorkOrderMaterialAmounts(currency, price, cost)` then re-routes to the WO dual-column model using the same pattern as `buildProposalItemInsertRow` (workOrders/api.js:10-34).

### Currency Inheritance Flow

```
proposals.currency  →  CreateWorkOrderFromProposalModal (currency: proposal.currency)
                    →  createWorkOrderFromProposal({ currency })
                    →  work_orders.currency = currency
                    →  splitWorkOrderMaterialAmounts(currency, ...)
                    →  work_order_materials.unit_price / unit_price_usd
```

The Work Order **inherits the Proposal's currency** end-to-end. The item prices are correctly resolved from the appropriate dual column and re-written into the correct WO dual column.

### Data Flow Diagram

```
proposal_items (DB)
  ├── unit_price      [TRY proposals: filled]
  └── unit_price_usd  [USD proposals: filled]
         │
         │  resolveProposalItemUnitPrice(item, proposal.currency)
         │  (proposalCalc.js:42)
         ▼
  resolvedPrice  [a single number in the proposal's currency]
         │
         │  splitWorkOrderMaterialAmounts(currency, resolvedPrice, resolvedCost)
         │  (workOrders/api.js:10)
         ▼
  work_order_materials
  ├── unit_price      [TRY WO: = resolvedPrice, USD WO: = 0]
  └── unit_price_usd  [USD WO: = resolvedPrice, TRY WO: = 0]
```

---

## 5. Findings

### Correct Behavior

- **New proposal creation:** `buildProposalItemInsertRow` correctly routes form prices to the right dual columns.
- **DB-level enforcement:** `trg_proposal_items_currency_guard` prevents incorrect `_usd` values for TRY proposals.
- **WO creation from proposal:** `resolveProposalItemUnitPrice` + `splitWorkOrderMaterialAmounts` correctly read and re-route prices. Currency inheritance is complete.
- **Duplicate proposal:** `duplicateProposal` (api.js:440-453) correctly checks `currency` before reading from `unit_price` vs `unit_price_usd`.
- **Calculation engine:** `proposalCalc.js` (`resolveProposalItemUnitPrice`, `resolveProposalItemLineTotal`) correctly prefers the matching column for the given currency.

---

### Bug 1 — CRITICAL: USD Proposal Items Load as 0 in Edit Mode

**File:** `ProposalFormPage.jsx:192-205`

```js
// BUG: uses ?? (nullish coalescing), which does NOT skip 0
unit_price: item.unit_price ?? item.unit_price_usd ?? 0,
```

For a **USD proposal**, `item.unit_price = 0` (zeroed by `buildProposalItemInsertRow`). Since `0` is not `null` or `undefined`, the `??` operator returns `0` — the TRY placeholder value — and never reads `unit_price_usd`.

**Effect:** When editing a USD proposal, all item price fields display as `0`. On save, `updateProposalItems` writes the user's (now zeroed) values back, effectively **destroying all item prices**.

**Correct pattern** (as used in `duplicateProposal`):
```js
unit_price: currency === 'USD' ? (item.unit_price_usd ?? 0) : (item.unit_price ?? 0),
```

The same `??` pattern affects `product_cost`, `labor_cost`, `shipping_cost`, `material_cost`, `misc_cost`, but those are nullable in both columns, so the fallback (`?? null`) is less harmful — for USD items, `item.product_cost = null`, so `??` does fall through to `item.product_cost_usd` correctly. The **only dangerously broken field is `unit_price`**.

For `cost`: `item.cost = null` for USD proposals (not `0`), so `item.cost ?? item.cost_usd` correctly falls through. Not broken.

---

### Bug 2 — MINOR: Work Order `amount` is 0 for USD Proposals

**File:** `CreateWorkOrderFromProposalModal.jsx:33`

```js
amount: proposal.total_amount ?? proposal.total_amount_usd ?? null,
```

For a **USD proposal**, `proposal.total_amount = 0` (the TRY column is explicitly set to `0`). Because `0 !== null`, `??` returns `0` instead of `proposal.total_amount_usd`.

**Effect:** The created Work Order's header `amount` field is `0` instead of the actual proposal total. This field is informational/display-only on work orders; actual pricing comes from `work_order_materials` rows. The materials are copied correctly (Bug 1 notwithstanding), so **financial calculations are not broken by this bug** — only the WO header `amount` display.

---

### Summary Table

| Area | Status | Notes |
|------|--------|-------|
| New proposal creation | Correct | `buildProposalItemInsertRow` routes properly |
| DB-level currency guard | Correct | `trg_proposal_items_currency_guard` fires on INSERT/UPDATE |
| Edit mode — TRY proposals | Correct | `unit_price` (TRY column) is non-zero, `??` works |
| Edit mode — USD proposals | **BUG** | `unit_price = 0` causes `??` to skip `unit_price_usd`; all prices load as 0 |
| Proposal duplicate | Correct | Explicitly checks `currency` before reading columns |
| WO creation from proposal | Correct | Uses `resolveProposalItemUnitPrice` which handles dual columns |
| WO currency inheritance | Correct | `proposal.currency` passed through end-to-end |
| WO `amount` header field | Minor bug | `total_amount ?? total_amount_usd` evaluates to `0` for USD proposals |
| Calculation engine (PDF/preview) | Correct | `proposalCalc.js` handles dual columns correctly |

---

## 6. Lifecycle Diagrams

### 6.1 Proposal Status Lifecycle

```
[draft] ──────────────────────────────────────────────────── [cancelled]
   │                                                              ↑
   │  updateProposalStatus({ id, status: 'sent' })               │
   │  proposals/api.js:381  → sets sent_at timestamp             │
   ↓                                                              │
[sent] ────────────────────────────────────────────────────── [rejected]
   │                          │                                   ↑
   │  status: 'accepted'      │  status: 'rejected'              │
   │  sets accepted_at        │  sets rejected_at                 │
   ↓                          ↓                                   │
[accepted] ──────────────────────────────────────────────────────┘
   │
   │  (automatic — DB trigger, NOT a direct API call)
   │  trg_check_proposal_completion (on work_orders AFTER UPDATE)
   │  supabase/migrations/00028_proposal_work_orders.sql
   │
   │  When: ALL linked work orders transition to 'completed'
   │  Action: UPDATE proposals SET status='completed' WHERE id=prop_id AND status='accepted'
   ↓
[completed]  ←── trg_auto_record_proposal_revenue fires HERE
                 → inserts 1–2 rows into financial_transactions
```

**Key constraint:** `proposals.status` can only auto-advance to `'completed'` from `'accepted'`. A draft or sent proposal with all WOs completed will NOT be automatically completed (the trigger guard `AND status = 'accepted'` prevents it).

**No UI path to manually set 'completed':** `updateProposalStatus` in `proposals/api.js:381` handles sent/accepted/rejected timestamps but no `completed_at` timestamp — completing a proposal is exclusively automatic via trigger.

### 6.2 Work Order Status Lifecycle

```
[pending]  ←── Created by createWorkOrder() or createWorkOrderFromProposal()
   │             workOrders/api.js:210 / :255
   │
   │  useUpdateWorkOrderStatus() → api.updateWorkOrder({ id, status })
   │  workOrders/hooks.js:29   → workOrders/api.js:337
   ↓
[in_progress]
   │
   │  api.updateWorkOrder({ id, status: 'completed' })
   │  workOrders/api.js:337  → supabase UPDATE work_orders SET status='completed'
   ↓
[completed] ←── Two DB triggers fire on this transition:
   │
   ├── trg_check_proposal_completion (00028)
   │     IF linked to proposal AND all sibling WOs done → set proposal='completed'
   │
   └── trg_auto_record_work_order_revenue (00186, updated by 00191)
         IF proposal_id IS NOT NULL → RETURN NEW  (guard — skips)
         IF proposal_id IS NULL     → INSERT into financial_transactions
```

**`useUpdateWorkOrderStatus` vs `useUpdateWorkOrder`:** Two hooks exist for status updates.
- `useUpdateWorkOrderStatus` (hooks.js:29) — dedicated status-only mutation; invalidates finance keys.
- `useUpdateWorkOrder` (hooks.js:174) — general-purpose update; also invalidates finance/operations keys when `status = 'completed'`.

Both call `api.updateWorkOrder` and both trigger the same DB-level triggers.

### 6.3 Finance — When Does `financial_transactions` Get a New Row?

```
Event                          Trigger                           Rows Created
─────────────────────────────────────────────────────────────────────────────────
Proposal → 'completed'         trg_auto_record_proposal_revenue  1 income (sale)
                               (00191, AFTER UPDATE on proposals) + 1 expense (COGS) if costs > 0

Standalone WO → 'completed'   trg_auto_record_work_order_revenue 1 income (service)
(proposal_id IS NULL)         (00186, AFTER UPDATE on work_orders) + 1 expense (COGS) if costs > 0

Subscription payment recorded  (separate trigger, not in scope)  1 income (subscription)

Manual entry via Finance UI    No trigger; direct INSERT          1 income or expense
```

---

## 7. Full End-to-End Data Flow

This traces the complete lifecycle from proposal acceptance to financial recording.

### Step 1 — User Accepts the Proposal

```
UI: ProposalDetailPage — "Mark as Accepted" button
  → useUpdateProposalStatus().mutate({ id, status: 'accepted' })
     proposals/hooks.js:129
  → updateProposalStatus({ id, status: 'accepted' })
     proposals/api.js:381
  → supabase UPDATE proposals SET status='accepted', accepted_at=now()

DB result:
  proposals.status = 'accepted'
  proposals.accepted_at = <timestamp>

No financial_transactions row created yet.
```

### Step 2 — User Creates Work Order from Accepted Proposal

```
UI: CreateWorkOrderFromProposalModal — "Create Work Order" button
  → useCreateWorkOrderFromProposal().mutate({ proposalId, items, currency, ... })
     workOrders/hooks.js:152
  → createWorkOrderFromProposal({ proposalId, siteId, currency, items, ... })
     workOrders/api.js:255

  a) INSERT into work_orders (status='pending', proposal_id=proposalId, currency=proposal.currency)
  b) For each proposal_item:
       resolveProposalItemUnitPrice(item, currency)   ← reads correct dual column
       splitWorkOrderMaterialAmounts(currency, price, cost)
       INSERT into work_order_materials (unit_price/unit_price_usd correctly split)
  c) INSERT into proposal_work_orders (junction)
  d) UPDATE work_orders SET proposal_id=proposalId

DB result:
  work_orders row: status='pending', proposal_id=<id>, currency=<proposal.currency>
  work_order_materials rows: dual columns correctly populated
  proposal_work_orders row: junction linked

Cache invalidated: workOrderKeys, siteKeys, customerKeys, financeDashboardKeys,
                   transactionKeys, profitAndLossKeys, financeHealthKeys

No financial_transactions row created yet (WO is pending).
```

### Step 3 — User Completes the Work Order

```
UI: WorkOrderDetailPage — "Mark as Completed" button
  → useUpdateWorkOrderStatus().mutate({ id, status: 'completed' })
     workOrders/hooks.js:29
  → api.updateWorkOrder({ id, status: 'completed' })
     workOrders/api.js:337
  → supabase UPDATE work_orders SET status='completed'

DB side effects (in trigger order):

  [Trigger A] trg_auto_record_work_order_revenue (AFTER UPDATE on work_orders)
    00186_fix_wo_and_proposal_finance_triggers.sql
    Fires immediately.
    Guard: IF NEW.proposal_id IS NOT NULL THEN RETURN NEW;  ← SKIPS for proposal WOs
    Result: NO rows inserted into financial_transactions

  [Trigger B] trg_check_proposal_completion (AFTER UPDATE on work_orders)
    00028_proposal_work_orders.sql
    Fires for every WO completion.
    Checks: bool_and(all linked WOs are 'completed')

    → If NOT all WOs done:
        No action. Proposal stays 'accepted'.

    → If ALL WOs done (last WO completes):
        UPDATE proposals SET status='completed' WHERE id=prop_id AND status='accepted'
        ↓
        This UPDATE fires trg_auto_record_proposal_revenue (AFTER UPDATE on proposals)
        00191_proposal_try_revenue_and_wo_usd_backfill.sql

Cache invalidated by hook onSuccess:
  workOrderKeys.detail, workOrderKeys.auditLogs, workOrderKeys.lists,
  operationsApi.keys, financeDashboardKeys, transactionKeys,
  profitAndLossKeys, financeHealthKeys
```

### Step 4 — System Records Finance (Triggered Automatically)

```
trg_auto_record_proposal_revenue fires on proposals UPDATE → status='completed'

Branch: currency = 'TRY'
  reads: NEW.total_amount  (TRY column)
  COGS:  proposal_items.cost / product_cost / labor_cost / ... (TRY columns)
  FX:    none — amount_try = total_amount, exchange_rate = NULL
  INSERT financial_transactions:
    direction='income', income_type='sale', original_currency='TRY'
    amount_original = total_amount, amount_try = total_amount
  If COGS > 0:
    INSERT financial_transactions:
      direction='expense', original_currency='TRY'
      amount_original = cogs_try, amount_try = cogs_try

Branch: currency = 'USD'
  reads: NEW.total_amount_usd  (USD column)
  COGS:  proposal_items.cost_usd / product_cost_usd / ... (USD columns)
  FX:    exchange_rates WHERE rate_date <= completed_at ORDER BY rate_date DESC
         → If no rate found: RAISE WARNING, RETURN NEW (no row created — silent failure)
  INSERT financial_transactions:
    direction='income', income_type='sale', original_currency='USD'
    amount_original = total_amount_usd, amount_try = total_amount_usd * rate
  If COGS > 0:
    INSERT financial_transactions:
      direction='expense', original_currency='USD'
      amount_original = cogs_usd, amount_try = cogs_usd * rate

Idempotency: SUM(amount_try) WHERE direction='income' AND deleted_at IS NULL > 0 → RETURN NEW
```

---

## 8. Code Reference Map

### API Functions

| Operation | Function | File |
|-----------|----------|------|
| Status: sent/accepted/rejected | `updateProposalStatus` | `proposals/api.js:381` |
| Create WO from proposal | `createWorkOrderFromProposal` | `workOrders/api.js:255` |
| Update WO (any field incl. status) | `updateWorkOrder` | `workOrders/api.js:337` |
| Link WO to proposal manually | `linkWorkOrderToProposal` | `proposals/api.js:501` |
| Unlink WO from proposal | `unlinkWorkOrderFromProposal` | `proposals/api.js:523` |

### React Query Hooks

| Hook | File | Invalidates Finance Keys? |
|------|------|--------------------------|
| `useUpdateProposalStatus` | `proposals/hooks.js:129` | No |
| `useCreateWorkOrderFromProposal` | `workOrders/hooks.js:152` | Yes |
| `useUpdateWorkOrderStatus` | `workOrders/hooks.js:29` | Yes |
| `useUpdateWorkOrder` | `workOrders/hooks.js:174` | Yes |
| `useLinkWorkOrder` | `proposals/hooks.js:187` | No |
| `useUnlinkWorkOrder` | `proposals/hooks.js:206` | No |

### Database Triggers

| Trigger Name | Table | Event | Migration |
|-------------|-------|-------|-----------|
| `trg_check_proposal_completion` | `work_orders` | AFTER UPDATE | `00028_proposal_work_orders.sql` |
| `trg_auto_record_proposal_revenue` | `proposals` | AFTER UPDATE | `00191_proposal_try_revenue_and_wo_usd_backfill.sql` (latest) |
| `trg_auto_record_work_order_revenue` | `work_orders` | AFTER UPDATE | `00186_fix_wo_and_proposal_finance_triggers.sql` (latest) |
| `trg_proposal_items_currency_guard` | `proposal_items` | BEFORE INSERT OR UPDATE | `00131_proposal_items_currency_enforcement.sql` |

### Trigger Migration History

The finance triggers have been revised multiple times. The canonical version of each function is in the **latest** migration that redefines it:

```
auto_record_proposal_revenue:
  00045 → 00047 → 00052 → 00154 → 00155 → 00186 → 00190 → 00191 (CURRENT)

auto_record_work_order_revenue:
  00049 → 00052 → 00154 → 00155 → 00186 (CURRENT)
```

---

## 9. Financial Recording — Currency Model Correctness

### Proposal Trigger (00191) — Dual-Column Correctness

| Path | Revenue Source | COGS Source | FX | Correct? |
|------|---------------|-------------|-----|----------|
| TRY proposal | `proposals.total_amount` | `proposal_items.cost` / breakdown TRY cols | None | Yes |
| USD proposal | `proposals.total_amount_usd` | `proposal_items.cost_usd` / breakdown USD cols | `exchange_rates` by `completed_at` date | Yes |

The latest trigger (00191) correctly branches on `proposals.currency` and reads the matching dual column for both revenue and COGS. This is an improvement over 00186, which read only `total_amount_usd` regardless of currency.

### Work Order Trigger (00186) — Dual-Column Correctness

| Path | Revenue Source | COGS Source | Correct? |
|------|---------------|-------------|---------|
| TRY WO | `SUM(quantity * unit_price)` | `SUM(quantity * cost)` | Yes |
| USD WO | `SUM(quantity * unit_price_usd)` | `SUM(quantity * cost_usd)` | Yes |

The trigger correctly branches on `work_orders.currency` and reads the matching column. This was the fix introduced in 00186 (prior versions only read `_usd` columns, breaking TRY work orders).

---

## 10. Additional Findings (Lifecycle & Finance)

### Finding 1 — `useUpdateProposalStatus` Does Not Invalidate Finance Queries

**File:** `proposals/hooks.js:129-144`

```js
// onSuccess only invalidates:
queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
queryClient.invalidateQueries({ queryKey: proposalKeys.detail(data.id) });
```

When a proposal is manually moved to `accepted` via the UI, no finance cache keys are invalidated. This is not harmful today because the finance trigger only fires on `completed` (not `accepted`). However, if the trigger logic ever changes, or if a future path allows manual `completed` status, the finance dashboard would show stale data until the next natural refetch.

Contrast with `useUpdateWorkOrderStatus` (hooks.js:29), which explicitly invalidates `financeDashboardKeys`, `transactionKeys`, `profitAndLossKeys`, and `financeHealthKeys`.

### Finding 2 — TRY Proposal COGS Fallback Reads `cost_usd` (Wrong Column)

**File:** `supabase/migrations/00191_proposal_try_revenue_and_wo_usd_backfill.sql:94-96`

```sql
-- TRY branch of auto_record_proposal_revenue
IF v_cogs_total_try = 0 THEN
  v_cogs_total_try := COALESCE(NEW.cost_usd, 0);  -- reads USD column for a TRY proposal
END IF;
```

When a TRY proposal has no per-item COGS but has a top-level manual cost entered, the trigger falls back to `proposals.cost_usd` — the USD cost field. For a TRY proposal this should be zero (since the dual-column model stores TRY values in the TRY column), so in practice this fallback always evaluates to `COALESCE(NULL, 0) = 0` and no COGS expense row is created. The correct field to fall back to would be a `cost_try` or `total_cost` column, but no such column exists on the proposals table. **Effect: TRY proposals never record COGS via the top-level fallback path**, regardless of whether cost data is present.

### Finding 3 — Silent Finance Failure for USD Proposals Without Historical Exchange Rate

**File:** `supabase/migrations/00191_proposal_try_revenue_and_wo_usd_backfill.sql:198-204`

```sql
IF v_rate IS NULL OR v_rate = 0 THEN
  RAISE WARNING 'auto_record_proposal_revenue: no USD rate on or before % for proposal %. '
    'Finance entry skipped.', v_transaction_date, NEW.id;
  RETURN NEW;
END IF;
```

Migration 00191 tightened the USD path: instead of falling back to `rate = 1` (as in 00186), the trigger now silently skips the entire financial recording if no exchange rate exists on or before `completed_at`. This can happen when:
- A proposal is completed on a weekend or holiday with no rate loaded.
- The exchange rates table has a gap.

The trigger emits a `RAISE WARNING` (visible in Postgres logs), but the UI has no notification mechanism for trigger-level warnings. **The proposal would show `status='completed'` in the UI with no corresponding income row in `financial_transactions`**, causing the finance dashboard to under-report revenue with no visible error to the user.

### Finding 4 — `check_proposal_completion` Requires `status = 'accepted'` to Auto-Complete

**File:** `supabase/migrations/00028_proposal_work_orders.sql:79`

```sql
UPDATE proposals SET status = 'completed' WHERE id = prop_id AND status = 'accepted';
```

If a user creates WOs from a proposal that is still `'draft'` or `'sent'` (by manually linking WOs rather than using the "Create WO from Proposal" flow), and all those WOs complete, the proposal will **not** be auto-completed. The trigger guard `AND status = 'accepted'` prevents it. Revenue will not be recorded. The correct pre-condition for the "Create WO from Proposal" button is that the proposal should already be `accepted` — this is enforced by UI convention but not by database constraint.

### Finding 5 — Double-Counting Guard Is Correctly Implemented

**File:** `supabase/migrations/00186_fix_wo_and_proposal_finance_triggers.sql:45-47`

```sql
IF NEW.proposal_id IS NOT NULL THEN
  RETURN NEW;
END IF;
```

As documented in `docs/CODING-LESSONS.md` Rule 18, the WO revenue trigger immediately exits for any WO linked to a proposal. Revenue for proposal-linked WOs is recorded exclusively by `auto_record_proposal_revenue`. This guard is in place and correctly implemented in the current trigger version (00186).

---

## 11. Updated Summary Table

| Area | Status | Notes |
|------|--------|-------|
| New proposal creation | Correct | `buildProposalItemInsertRow` routes properly |
| DB-level currency guard | Correct | `trg_proposal_items_currency_guard` fires on INSERT/UPDATE |
| Edit mode — TRY proposals | Correct | `unit_price` (TRY column) is non-zero, `??` works |
| Edit mode — USD proposals | **Bug (Critical)** | `unit_price = 0` causes `??` to skip `unit_price_usd`; all prices load as 0 |
| Proposal duplicate | Correct | Explicitly checks `currency` before reading columns |
| WO creation from proposal | Correct | Uses `resolveProposalItemUnitPrice` which handles dual columns |
| WO currency inheritance | Correct | `proposal.currency` passed through end-to-end |
| WO `amount` header field | **Bug (Minor)** | `total_amount ?? total_amount_usd` evaluates to `0` for USD proposals |
| Proposal → auto-complete trigger | Correct | `check_proposal_completion` fires; guard `status='accepted'` required |
| Double-counting prevention | Correct | `proposal_id IS NOT NULL` guard in WO trigger is in place |
| Finance trigger — TRY proposals | Correct | 00191 reads TRY columns for revenue and COGS |
| Finance trigger — USD proposals | Correct | 00191 reads USD columns; uses `completed_at` date for FX |
| Finance trigger — TRY COGS fallback | **Bug (Minor)** | Falls back to `cost_usd` (USD column) for TRY proposals; always 0 |
| Finance trigger — missing USD rate | **Gap** | Silently skips finance recording; no UI notification to user |
| `useUpdateProposalStatus` cache invalidation | Gap | Does not invalidate finance keys on status change |
| Calculation engine (PDF/preview) | Correct | `proposalCalc.js` handles dual columns correctly |

---

## 12. Currency Conversion & Financial Recording Deep-Dive

### 12.1 Currency Inheritance: Proposal → Work Order

#### Is Currency Automatically Inherited?

**Yes — it is automatic and the user cannot change it in the modal.**

`CreateWorkOrderFromProposalModal.jsx:34` passes the proposal's currency directly:
```js
currency: proposal.currency ?? 'TRY',
```

The modal has no currency `<Select>` field — the user chooses only `workType`, `scheduledDate`, `scheduledTime`, and `assignedTo`. The Proposal's currency propagates to `work_orders.currency` without any user interaction.

#### API Function Responsible for Transfer

`createWorkOrderFromProposal` in `workOrders/api.js:255`:

```
proposals.currency ('USD' or 'TRY')
  ↓
CreateWorkOrderFromProposalModal: currency: proposal.currency ?? 'TRY'
  ↓
createWorkOrderFromProposal({ currency })
  workOrders/api.js:284
  workOrderPayload.currency = currency || 'TRY'
  ↓
INSERT work_orders SET currency = payload.currency
  ↓
work_orders.currency = inherited from proposals.currency
```

#### Currency Flow Diagram

```
Proposal (currency = 'USD')
  │
  │  createWorkOrderFromProposal({ currency: 'USD', items })
  │  workOrders/api.js:300  rowCurrency = 'USD'
  ↓
Work Order (currency = 'USD')
  │  work_order_materials.unit_price_usd = filled
  │  work_order_materials.unit_price     = 0
  ↓
Financial Transaction (auto_record_work_order_revenue)
  │  reads unit_price_usd, converts to TRY using TCMB rate
  │  amount_original = USD total
  │  amount_try = USD total × exchange_rate
  │  exchange_rate = TCMB BanknoteBuying as-of completed_at
  ↓
financial_transactions row (original_currency = 'USD', amount_try in TRY)

────────────────────────────────────────────────────────────────────────

Proposal (currency = 'TRY')
  │
  │  createWorkOrderFromProposal({ currency: 'TRY', items })
  │  rowCurrency = 'TRY'
  ↓
Work Order (currency = 'TRY')
  │  work_order_materials.unit_price     = filled
  │  work_order_materials.unit_price_usd = 0
  ↓
Financial Transaction (auto_record_work_order_revenue)
  │  reads unit_price, no FX conversion
  │  amount_original = TRY total
  │  amount_try = amount_original (1:1)
  │  exchange_rate = NULL
  ↓
financial_transactions row (original_currency = 'TRY', exchange_rate IS NULL)
```

---

### 12.2 Financial Recording — TRY Work Orders

**Trigger:** `auto_record_work_order_revenue` (AFTER UPDATE on `work_orders`)
**Current migration:** `00190_financial_reversal_on_status_change.sql`

#### Revenue Branch (TRY)

```sql
-- 00190, lines 123-133
SELECT COALESCE(SUM(wom.quantity * wom.unit_price), 0)   -- reads TRY column
INTO v_amount_orig
FROM work_order_materials wom
WHERE wom.work_order_id = NEW.id;

v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);  -- apply discount

v_rate       := NULL;          -- no FX
v_amount_try := v_amount_orig; -- 1:1 conversion
```

#### `financial_transactions` Columns for TRY

| Column | Value | Notes |
|--------|-------|-------|
| `amount_original` | SUM(qty × unit_price) × (1 − discount%) | Gross revenue in TRY |
| `original_currency` | `'TRY'` | |
| `amount_try` | Same as `amount_original` | No conversion |
| `exchange_rate` | `NULL` | Explicitly set to NULL |
| `transaction_date` | `COALESCE(NEW.completed_at::date, CURRENT_DATE)` | Actual completion date |
| `output_vat` | `ROUND(amount_try × vat_rate / 100, 2)` | Derived from dynamic `vat_rate` |
| `cogs_try` | `NULL` (not stored on WO income row) | COGS is a separate expense row |

#### COGS Branch (TRY)

A separate expense row is inserted if `SUM(qty × cost) > 0`:

```sql
-- 00190, lines 168-173
SELECT COALESCE(SUM(wom.quantity * wom.cost), 0)   -- reads TRY cost column
INTO v_cogs_try
FROM work_order_materials wom
WHERE wom.work_order_id = NEW.id
  AND wom.cost IS NOT NULL AND wom.cost > 0;
```

COGS expense row:

| Column | Value |
|--------|-------|
| `amount_original` | `v_cogs_try` (TRY cost total) |
| `original_currency` | `'TRY'` |
| `amount_try` | `v_cogs_try` (same, no conversion) |
| `exchange_rate` | `NULL` |
| `direction` | `'expense'` |

---

### 12.3 Financial Recording — USD Work Orders

**Same trigger:** `auto_record_work_order_revenue`

#### Revenue Branch (USD)

```sql
-- 00190, lines 98-121
SELECT COALESCE(SUM(wom.quantity * wom.unit_price_usd), 0)  -- reads USD column
INTO v_amount_orig
FROM work_order_materials wom
WHERE wom.work_order_id = NEW.id;

v_amount_orig := v_amount_orig * (1 - v_discount_pct / 100);

-- Exchange rate: as-of completion date, walking back to last trading day
SELECT effective_rate INTO v_rate
FROM exchange_rates
WHERE currency = 'USD'
  AND rate_date <= v_transaction_date       -- key: <= not =
ORDER BY rate_date DESC
LIMIT 1;

-- Hard stop if no rate found
IF v_rate IS NULL OR v_rate = 0 THEN
  RAISE WARNING '...no USD rate on or before %...', v_transaction_date, NEW.id;
  RETURN NEW;   -- finance entry skipped entirely
END IF;

v_amount_try := ROUND(v_amount_orig * v_rate, 2);
```

#### `financial_transactions` Columns for USD

| Column | Value | Notes |
|--------|-------|-------|
| `amount_original` | SUM(qty × unit_price_usd) × (1 − discount%) | Gross revenue in USD |
| `original_currency` | `'USD'` | |
| `amount_try` | `ROUND(amount_original × v_rate, 2)` | Converted using TCMB BanknoteBuying |
| `exchange_rate` | TCMB `effective_rate` (= BanknoteBuying) as-of `completed_at` | |
| `transaction_date` | `COALESCE(NEW.completed_at::date, CURRENT_DATE)` | |
| `output_vat` | `ROUND(amount_try × vat_rate / 100, 2)` | On TRY amount (post-conversion) |
| `cogs_try` | `NULL` on income row | COGS is a separate expense row |

#### COGS Branch (USD)

```sql
-- 00190, lines 158-165
SELECT COALESCE(SUM(wom.quantity * wom.cost_usd), 0)
INTO v_cogs_try           -- variable name misleading: stores USD COGS first
FROM work_order_materials wom
WHERE wom.work_order_id = NEW.id
  AND wom.cost_usd IS NOT NULL AND wom.cost_usd > 0;

IF v_cogs_try > 0 THEN
  v_cogs_try := ROUND(v_cogs_try * v_rate, 2);  -- convert USD COGS to TRY
END IF;
```

COGS expense row for USD WO:

| Column | Value |
|--------|-------|
| `amount_original` | `ROUND(v_cogs_try / NULLIF(v_rate, 0), 2)` — back-calculated USD COGS |
| `original_currency` | `'USD'` |
| `amount_try` | `v_cogs_try` — TRY COGS (= USD COGS × rate) |
| `exchange_rate` | Same `v_rate` as income row |

> Note: The variable `v_cogs_try` in the USD branch stores the USD raw total initially, then gets overwritten with the TRY conversion. `amount_original` for the COGS expense row divides it back: `ROUND(v_cogs_try / NULLIF(v_rate, 0), 2)`. This roundtrip (USD → TRY → USD) can introduce a rounding error of ±0.01 per item but is structurally sound.

---

### 12.4 Exchange Rate Fetching Mechanism

#### Source: TCMB XML Feed

The Turkish Central Bank (TCMB) publishes official exchange rates as a public XML feed at:
```
https://www.tcmb.gov.tr/kurlar/today.xml
```

No API key or authentication is required. Fetched by a Supabase Edge Function:

**File:** `supabase/functions/fetch-tcmb-rates/index.ts`

#### What Is Extracted

The Edge Function parses `<BanknoteBuying>` and `<BanknoteSelling>` from the USD `<Currency>` block:

```ts
// fetch-tcmb-rates/index.ts:27-29
const buyMatch  = usdMatch[0].match(/<BanknoteBuying>([\d.,]+)<\/BanknoteBuying>/);
const sellMatch = usdMatch[0].match(/<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/);
```

| TCMB XML Tag | Stored Column | Meaning |
|---|---|---|
| `BanknoteBuying` | `buy_rate` AND `effective_rate` | Rate at which bank buys USD from customer |
| `BanknoteSelling` | `sell_rate` | Rate at which bank sells USD to customer |

```ts
// index.ts:77
effective_rate: buyRate,  // We'll keep effective_rate as buyRate for compatibility
```

**`effective_rate` = `buy_rate` = TCMB BanknoteBuying rate.** This is the rate at which the bank buys USD from the customer — i.e., the rate a company receives when converting USD income to TRY. Correct for recording incoming USD revenue.

#### `exchange_rates` Table Schema

```sql
-- 00042_exchange_rates.sql
CREATE TABLE exchange_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency        TEXT NOT NULL DEFAULT 'USD',
  buy_rate        DECIMAL(10,4),       -- TCMB BanknoteBuying
  sell_rate       DECIMAL(10,4),       -- TCMB BanknoteSelling
  effective_rate  DECIMAL(10,4) NOT NULL,   -- = buy_rate (used by triggers)
  rate_date       DATE NOT NULL,
  source          TEXT DEFAULT 'TCMB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency, rate_date)          -- one row per currency per day
);
```

**Indexes:**
```sql
-- 00042 originals:
CREATE INDEX idx_exchange_rate_date ON exchange_rates(rate_date DESC);
CREATE INDEX idx_exchange_currency  ON exchange_rates(currency);
-- Added in 00189 for trigger performance:
CREATE INDEX idx_exchange_rates_currency_date ON exchange_rates (currency, rate_date DESC);
```

#### Automation: Daily pg_cron Job

```sql
-- 00053_tcmb_cron_setup.sql
SELECT cron.schedule(
  'fetch-tcmb-rates-daily',
  '0 3 * * *',    -- 03:00 UTC = 06:00 Turkey time
  $$ SELECT net.http_post(url := ... || '/functions/v1/fetch-tcmb-rates', ...) $$
);
```

The fetch is **fully automated**. Users can also trigger it manually from the Finance → Exchange Rates page via `fetchTcmbRates()` in `finance/api.js:311`.

#### Date Selection Logic in Triggers

```sql
-- Both auto_record_work_order_revenue AND auto_record_proposal_revenue
-- (introduced in 00187, carried forward in 00190 and 00191)

v_transaction_date := COALESCE(NEW.completed_at::date, CURRENT_DATE);

SELECT effective_rate INTO v_rate
FROM exchange_rates
WHERE currency = 'USD'
  AND rate_date <= v_transaction_date    -- ← "as-of" semantics
ORDER BY rate_date DESC
LIMIT 1;
```

**Why `rate_date <= v_transaction_date`:** TCMB does not publish rates on weekends or public holidays. Using `<=` instead of `=` means the query walks back to the most recent available trading day before (or on) the completion date:
- WO completed Saturday → uses Friday's rate
- WO completed on a national holiday → uses last published rate before that date
- Backdated completions → uses rate that was in effect on the actual day

**Before migration 00187**, the query used `ORDER BY rate_date DESC LIMIT 1` with no date filter — always the absolute latest rate. This was legally incorrect for backdated transactions. 00187 corrected this.

**`completed_at` on proposals** was added in migration 00189 via BEFORE UPDATE trigger `set_proposal_completed_at`. Before this column existed, the trigger read `NEW.completed_at` which was always `NULL`, falling back to `CURRENT_DATE` — using the wrong rate for any proposal completed before today.

#### Frontend Rate Access

```js
// finance/api.js:286
export async function getLatestRate(currency = 'USD') {
  return supabase.from('exchange_rates')
    .select(RATE_SELECT)
    .eq('currency', currency)
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle();
}
```

Used in `ProposalFormPage.jsx:128` via `useLatestRate('USD')` to display a live FX preview in the form — not for financial recording (the trigger handles that server-side at completion time).

---

### 12.5 Example Calculation

**Scenario: USD Work Order completed**

Setup:
- `work_orders.currency = 'USD'`, `vat_rate = 20`, `materials_discount_percent = 0`
- `work_orders.completed_at = '2026-04-01 14:30:00+03'`
- 2 items in `work_order_materials`:
  - Item A: qty=2, unit_price_usd=300, cost_usd=100
  - Item B: qty=1, unit_price_usd=400, cost_usd=200
- TCMB BanknoteBuying on 2026-04-01: **34.50 TRY/USD**

**Trigger Step-by-Step:**

```
v_transaction_date = '2026-04-01'

-- Revenue
v_amount_orig = (2×300) + (1×400) = 1,000 USD
v_amount_orig = 1,000 × (1 - 0/100) = 1,000 USD

-- Rate lookup
SELECT effective_rate FROM exchange_rates
WHERE currency='USD' AND rate_date <= '2026-04-01'
ORDER BY rate_date DESC LIMIT 1  →  34.50

v_amount_try = ROUND(1,000 × 34.50, 2) = 34,500.00 TRY
v_output_vat = ROUND(34,500 × 20/100, 2) = 6,900.00 TRY
```

**Income row inserted:**

| Column | Value |
|--------|-------|
| `direction` | `'income'` |
| `income_type` | `'service'` |
| `amount_original` | **1,000.00** (USD gross revenue) |
| `original_currency` | **`'USD'`** |
| `amount_try` | **34,500.00** |
| `exchange_rate` | **34.50** |
| `output_vat` | 6,900.00 |
| `vat_rate` | 20 |
| `transaction_date` | 2026-04-01 |
| `cogs_try` | NULL (WO income rows do not store COGS inline) |

```
-- COGS
v_cogs_usd = (2×100) + (1×200) = 400 USD
v_cogs_try = ROUND(400 × 34.50, 2) = 13,800.00 TRY
v_input_vat = ROUND(13,800 × 20/100, 2) = 2,760.00 TRY
```

**COGS expense row inserted:**

| Column | Value |
|--------|-------|
| `direction` | `'expense'` |
| `amount_original` | **ROUND(13,800 / 34.50, 2) = 400.00 USD** |
| `original_currency` | **`'USD'`** |
| `amount_try` | **13,800.00** |
| `exchange_rate` | **34.50** |
| `input_vat` | 2,760.00 |

**Net ledger position:**
- Revenue: 34,500 TRY | COGS: 13,800 TRY | Gross Profit: **20,700 TRY**
- Net VAT payable: 6,900 − 2,760 = **4,140 TRY**

> Revenue is recorded **gross** (full sale value), not as net profit. P&L is derived by subtracting expense rows from income rows in `v_profit_and_loss`. The `amount_original = 1,000` is the total sale amount, not the margin.

---

### 12.6 Reversal Mechanism (Immutable Ledger)

Migration `00190` introduced a compensating reversal pattern. When a WO or Proposal transitions **out of** `'completed'`:

```sql
-- Trigger: work_order_finance_reversal
-- WHEN (OLD.status = 'completed' AND NEW.status <> 'completed')
INSERT INTO financial_transactions (
  amount_original = -v_row.amount_original,   -- negated
  amount_try      = -v_row.amount_try,
  output_vat      = -v_row.output_vat,
  reversal_of     = v_row.id,                 -- links to original row
  reversal_note   = 'Reversal: work_order X status changed from completed to Y'
)
```

Original rows are never deleted. Reversal rows net the ledger to zero. Re-completing the WO/Proposal creates fresh finance rows (idempotency guard uses `SUM(amount_try) > 0`, not `EXISTS` — a reversed record with net=0 allows a new entry at a potentially different exchange rate).

---

### 12.7 Trigger Reference Table

| Trigger | Table | Fires When | TRY Path | USD Path | Current Migration |
|---------|-------|-----------|----------|----------|-------------------|
| `trg_auto_record_work_order_revenue` | `work_orders` | `→ 'completed'`, `proposal_id IS NULL` | `unit_price`, `cost`; `rate=NULL` | `unit_price_usd`, `cost_usd`; TCMB BanknoteBuying | 00190 |
| `trg_auto_record_proposal_revenue` | `proposals` | `→ 'completed'` | `total_amount`, TRY item costs | `total_amount_usd`, USD item costs; TCMB BanknoteBuying | 00191 |
| `work_order_finance_reversal` | `work_orders` | `'completed' →` any | negates all linked FT rows | same | 00190 |
| `proposal_finance_reversal` | `proposals` | `'completed' →` any | negates all linked FT rows | same | 00190 |
| `trg_check_proposal_completion` | `work_orders` | `→ 'completed'` | cascades to proposal if all WOs done | same | 00028 |
| `proposal_status_change` | `proposals` | any UPDATE | auto-sets/clears `completed_at` | same | 00189 |

---

### 12.8 Findings: Exchange Rate Logic

#### Correct

| Area | Detail |
|------|--------|
| TCMB BanknoteBuying as `effective_rate` | Correct rate for converting incoming USD revenue to TRY |
| `rate_date <= completed_at` semantics | Naturally walks back to last trading day for weekends/holidays |
| `completed_at` date source | Added in 00189; uses actual event timestamp, not `CURRENT_DATE` |
| Daily automated fetch | pg_cron at 06:00 Turkey time; users can trigger manually |
| `exchange_rate` frozen on FT row | Immune to future rate changes; correct audit behavior |
| Reversal preserves original rate | Reversal copies `exchange_rate` from original row |
| Idempotency after reversal | NET-based guard (00190) allows re-completion at new rate |

#### Gaps / Risks

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | TCMB fetch failure (weekend, holiday, connectivity) causes pg_cron to return 502 silently. A completion on that day skips finance recording with only a Postgres `RAISE WARNING` — no UI alert to users. `view_finance_health_check` catches missing FT entries, but only after the fact. |
| 2 | **Medium** | `effective_rate = buy_rate` (BanknoteBuying) is correct for USD income. For USD COGS expense rows, the same buy_rate is applied. Strictly, materials paid in USD should use BanknoteSelling (the rate to buy USD). The buy/sell spread (~0.01–0.05 TRY) has low materiality but is not technically correct for expenses. |
| 3 | **Medium** | USD COGS `amount_original` is back-calculated as `ROUND(cogs_try / rate, 2)`. Since `cogs_try` itself had `ROUND(..., 2)` applied, the division may not exactly recover the source USD value. Off by ≤0.01 per row — no financial impact, but `amount_original` on the expense row is not exact. |
| 4 | **Low** | No rate freshness alerting in UI. If the cron job silently stops, completions will use an arbitrarily stale rate with no warning. The Finance Rates page shows the latest entry's date, but no alert fires if it is >1 business day old. |
| 5 | **Low** | `proposals.completed_at` is set by a BEFORE UPDATE trigger. `check_proposal_completion` (which sets `status='completed'`) is an AFTER UPDATE trigger on `work_orders`. The resulting `UPDATE proposals` statement fires BEFORE (sets `completed_at`) then AFTER (fires `auto_record_proposal_revenue`). Postgres trigger ordering is correct here — this is worth noting as non-obvious. |

---

## 13. Standalone Work Order Creation Flow

### 13.1 Overview

A "standalone" work order is one created directly at `/work-orders/new`, without being linked to a proposal. This is the primary entry path for unplanned service calls, reactive maintenance, and field work that is not preceded by a formal quotation process.

The **Proposal-linked** path (`createWorkOrderFromProposal` via `CreateWorkOrderFromProposalModal`) is a secondary path that inherits currency, items, and amount from an approved proposal.

---

### 13.2 Standalone WO — Currency Handling

#### Critical Finding: No Currency Selector in the UI

The `workOrderSchema` defines a `currency` field:

```
workOrders/schema.js:~18   export const CURRENCIES = ['TRY', 'USD'];
workOrders/schema.js:~35   currency: z.enum(CURRENCIES).default('TRY'),
workOrders/schema.js:~80   currency: 'TRY',   // default value
```

Despite this, **`WorkOrderFormPage.jsx` renders no `<Select {...register('currency')}>` element**. A search for `register('currency')` in the component returns no matches. The `currency` field is wired into the schema and passed through to the API, but the user has no UI control to change it.

The only place `currency` appears in the form rendering is:

```
WorkOrderFormPage.jsx:111   const lineCurrency = watch('currency') ?? 'TRY';
WorkOrderFormPage.jsx:533   <WorkOrderItemsEditor currency={lineCurrency} ... />
```

`lineCurrency` is used exclusively as a display hint (currency symbol, number formatting) inside `WorkOrderItemsEditor`. The items editor also has no currency selector.

**Consequence:** Every standalone work order created through the UI is implicitly in `TRY`. The schema's `default('TRY')` is the effective value for all standalone creations. The `currency` field can only be set programmatically (e.g., by the `createWorkOrderFromProposal` path which passes `currency: proposal.currency`).

#### Comparison: Proposal vs Standalone WO Currency at Form Level

| Attribute | Proposal (`ProposalFormPage`) | Standalone WO (`WorkOrderFormPage`) |
|-----------|-------------------------------|--------------------------------------|
| Schema default | `'USD'` | `'TRY'` |
| Currency `<Select>` in UI | Yes — Step 0, `register('currency')` | **No** — field not rendered |
| User can change currency | Yes | **No** |
| Currency sent to API | User-selected value | Always `'TRY'` (schema default) |
| Items editor display | `currency` prop from form watch | `currency` prop from form watch (always `'TRY'`) |

---

### 13.3 Standalone WO — Item Persistence

`createWorkOrder` (workOrders/api.js:210) uses `splitWorkOrderMaterialAmounts` to route prices to dual columns:

```
workOrders/api.js:234    const cur = payload.currency || 'TRY';
workOrders/api.js:235    const materialRows = items.map((item, index) => ({
workOrders/api.js:241      ...splitWorkOrderMaterialAmounts(cur, item.unit_price ?? 0, item.cost),
workOrders/api.js:242    }));
```

Since `cur` is always `'TRY'` for standalone WOs:
- `unit_price` = the entered price
- `unit_price_usd` = 0
- `cost` = the entered cost (or null)
- `cost_usd` = null

This is correct behavior for TRY-only WOs.

#### Edit Mode Item Loading (Standalone WO)

When editing an existing standalone WO, `WorkOrderFormPage.jsx` loads items with:

```
WorkOrderFormPage.jsx:167    const woCurrency = workOrder.currency || 'TRY';
WorkOrderFormPage.jsx:168    const items = (workOrder.work_order_materials || []).map((wom) => ({
WorkOrderFormPage.jsx:172      unit_price: resolveProposalItemUnitPrice(wom, woCurrency),  // CORRECT
WorkOrderFormPage.jsx:173      cost: wom.cost ?? wom.cost_usd ?? null,
```

`resolveProposalItemUnitPrice(wom, woCurrency)` correctly reads `unit_price_usd` for USD WOs and `unit_price` for TRY WOs. This is the correct pattern — unlike the Proposal edit bug (Section 2.4 / Section 7.2) which uses `item.unit_price ?? item.unit_price_usd ?? 0`.

The `cost` line uses `wom.cost ?? wom.cost_usd ?? null`. For TRY WOs (always the case for standalone), `wom.cost` is populated so `??` short-circuits correctly. For a hypothetically USD standalone WO, `wom.cost` would be `null` and `wom.cost_usd` would be read — also correct. No bug here.

---

### 13.4 Standalone WO — Financial Recording

#### Trigger: `auto_record_work_order_revenue` (00190)

The trigger fires on `AFTER UPDATE OF status ON work_orders WHEN (NEW.status = 'completed' AND OLD.status <> 'completed')`.

The first thing the trigger checks:

```sql
-- Guard clause (00190)
IF NEW.proposal_id IS NOT NULL THEN
  RETURN NEW;
END IF;
```

This is the **only** gate that distinguishes standalone vs proposal-linked WOs at the DB level. For standalone WOs, `proposal_id IS NULL` so the trigger continues.

#### Currency Branching Inside the Trigger

```sql
v_currency := UPPER(COALESCE(NEW.currency, 'TRY'));

IF v_currency = 'USD' THEN
  -- reads unit_price_usd from work_order_materials
  -- fetches TCMB rate as-of completed_at
  -- records FT with amount_original=USD, exchange_rate, amount_try=converted
ELSE
  -- reads unit_price from work_order_materials
  -- rate = NULL, amount_try = direct TRY sum
END IF;
```

Because standalone WOs are always `currency='TRY'` in practice, the trigger will always execute the TRY branch for standalone WOs. There is no exchange rate lookup, no TCMB dependency, no rate-missing risk.

#### TRY Branch — Finance Transaction Fields

For a standalone TRY WO completing:

| FT field | Value | Source |
|----------|-------|--------|
| `direction` | `'income'` | hardcoded |
| `original_currency` | `'TRY'` | from `v_currency` |
| `amount_original` | sum of `unit_price * quantity` for all WOM rows | `work_order_materials` |
| `exchange_rate` | `NULL` | no conversion |
| `amount_try` | same as `amount_original` | no conversion needed |
| `cogs_try` | sum of item costs (TRY cost columns) | `work_order_materials` |
| `transaction_date` | `NEW.completed_at::date` or `CURRENT_DATE` | trigger field |

A separate COGS expense row is also inserted if total cost > 0 (same pattern as proposal revenue).

---

### 13.5 Proposal-linked WO — Differences

When a WO is created from a proposal via `createWorkOrderFromProposal`:

1. **`proposal_id` is set** on the work order — this is the gate that skips `auto_record_work_order_revenue`.
2. **Currency is inherited** from the proposal (`currency: proposal.currency ?? 'TRY'`).
3. **Items are copied** using `resolveProposalItemUnitPrice` to correctly read dual columns.
4. **Finance is recorded at proposal level**, not WO level — `auto_record_proposal_revenue` fires when the proposal transitions to `'completed'` (which requires all linked WOs to be completed, via `check_proposal_completion`).

This means a proposal-linked WO's `work_order_materials` rows may have `unit_price_usd` filled (for USD proposals), but `auto_record_work_order_revenue` will never read them — the trigger returns early.

---

### 13.6 Workflow Comparison: Standalone vs Proposal-linked WO

```
STANDALONE WORK ORDER
─────────────────────
User → /work-orders/new (WorkOrderFormPage)
         │  currency = 'TRY' (implicit, no selector)
         │  items.unit_price → written to unit_price column
         ▼
   work_orders (currency='TRY', proposal_id=NULL)
   work_order_materials (unit_price=X, unit_price_usd=0)
         │
         │  User updates status → 'completed'
         ▼
   trg_auto_record_work_order_revenue
         │  proposal_id IS NULL → proceed
         │  currency = 'TRY' → TRY branch
         │  sum(unit_price * qty) → amount_try
         │  sum(cost * qty) → cogs_try
         ▼
   financial_transactions (income) + financial_transactions (COGS expense)


PROPOSAL-LINKED WORK ORDER
───────────────────────────
User → Proposal detail page → "Create WO from Proposal"
         │  currency inherited from proposal
         │  items copied via resolveProposalItemUnitPrice
         ▼
   work_orders (currency=proposal.currency, proposal_id=proposal_id)
   work_order_materials (unit_price_usd=X for USD; unit_price=X for TRY)
         │
         │  User updates WO status → 'completed'
         ▼
   trg_auto_record_work_order_revenue
         │  proposal_id IS NOT NULL → RETURN NEW (skipped)
         │
   check_proposal_completion (separate trigger on work_orders AFTER UPDATE)
         │  IF all linked WOs are 'completed' AND proposal.status = 'accepted'
         │    UPDATE proposals SET status = 'completed'
         ▼
   trg_auto_record_proposal_revenue
         │  currency = 'TRY' → TRY branch (total_amount, TRY item costs)
         │  currency = 'USD' → USD branch (total_amount_usd, rate lookup)
         ▼
   financial_transactions (income) + financial_transactions (COGS expense)
```

---

### 13.7 Guard Clause Analysis

The `proposal_id IS NOT NULL` guard in `auto_record_work_order_revenue` (00190 lines 70–72) is the architectural boundary that prevents double-counting between the two recording paths.

**Scenario: What happens if guard is removed?**

If the guard were absent and a USD proposal-linked WO completed:
- Trigger reads `work_order_materials.unit_price_usd` (sum of copied proposal items)
- Fetches TCMB rate as-of WO's `completed_at`
- Records income at WO-level total

Then when the proposal completes:
- Trigger reads `proposals.total_amount_usd`
- Fetches TCMB rate as-of proposal's `completed_at` (different day, possibly different rate)
- Records income again at proposal-level total

Result: same revenue counted twice (possibly at different FX rates). The guard is essential.

**Scenario: Proposal status never reaches 'accepted'**

`check_proposal_completion` has `AND status = 'accepted'` guard. If a WO is linked to a proposal still in `'draft'` or `'sent'` status and all WOs complete, the proposal does NOT auto-complete. No finance entry is ever recorded. This is correct business logic (an offer not formally accepted should not generate revenue entries), but represents a potential gap if users forget to advance the proposal to `'accepted'`.

---

### 13.8 Findings: Standalone Work Order Analysis

#### Correct

| Area | Detail |
|------|--------|
| `splitWorkOrderMaterialAmounts` usage | Correctly routes to TRY columns for standalone WOs |
| Edit mode item loading | Uses `resolveProposalItemUnitPrice` (avoids the `??` bug seen in proposals) |
| Guard clause | `proposal_id IS NOT NULL` cleanly separates the two finance recording paths |
| TRY-only standalone WOs | No FX dependency → no rate-missing risk, no silent failures |
| `cost` loading in edit mode | `wom.cost ?? wom.cost_usd ?? null` is safe for both TRY (cost filled) and hypothetical USD (cost_usd filled) |

#### Gaps / Risks

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | No currency selector in standalone WO form. The `currency` field exists in schema, API, and DB, but users have no way to create a USD standalone WO from the UI. If a USD-denominated field service job exists (e.g., equipment priced in USD), the operator must enter a manually-converted TRY price. Financial reports will show TRY amounts with no indication of the USD original. |
| 2 | **Medium** | Because standalone WOs are TRY-only in practice, the `auto_record_work_order_revenue` USD branch (which handles rate lookup, USD column reads, etc.) is dead code for the current UI flow. It can only be triggered by directly setting `currency='USD'` in the database or via a future API change. This creates a risk: the USD branch in the WO trigger has had less real-world exercise than the proposal USD path. |
| 3 | **Low** | `prefilledProposalId` (WorkOrderFormPage.jsx:77) accepts a proposal ID via URL search param. When present, the WO is linked to the proposal after creation. However, `currency` is not inherited from the proposal via URL param — it stays `'TRY'`. Currency inheritance only happens via `createWorkOrderFromProposal` (the modal path), not the direct URL param path. A USD proposal linked via URL param would have a TRY WO with USD items misrouted. |
| 4 | **Low** | `work_orders.currency` is not exposed anywhere in the WO detail page display or audit log — there is no visible indicator to the user of which currency a WO is denominated in. For TRY-only WOs this is low risk, but if USD WOs are ever created, diagnosis becomes harder. |
