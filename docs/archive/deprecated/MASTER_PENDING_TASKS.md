# Master Pending Tasks

> **Purpose:** Single source of truth for all active implementation work.
> **Protocol:** Consultation → Refinement → APPROVED → Execution.

---

## 1. Customer Situation Module

**Status:** Not started. Full implementation required.  
**Source:** plan-customer-situation.md (archived)

### 1.1 Database

- [ ] **Migration** — Create `supabase/migrations/00XXX_customer_situation.sql`:
  - `customer_notes` table (id, customer_id, content, created_by, created_at)
  - RLS: SELECT any authenticated; INSERT admin only; no DELETE
  - Index `(customer_id, created_at DESC)`
  - `customer_situation` view (aggregates per customer: payment overdue days, open WO count/age, health, latest note)
  - Composite indexes for view performance (work_orders, subscription_payments)

### 1.2 Feature Module

- [ ] **Create** `src/features/customerSituation/`:
  - `api.js` — fetchCustomerSituations, addCustomerNote, fetchCustomerNotes
  - `hooks.js` — useCustomerSituations, useAddCustomerNote, useCustomerNotes
  - `schema.js` — Zod schema for note form
  - `index.js` — barrel export
  - `CustomerSituationPage.jsx` — main board (table, health filter toggle, health badges)
  - `components/SituationHealthBadge.jsx`
  - `components/CustomerNotesPanel.jsx` — slide-over with note history + input
  - `components/SituationActionsMenu.jsx` — quick actions (Create WO, Record Payment, Add Note, Paraşüt placeholder)

### 1.3 Routes & i18n

- [ ] **Route** — Add `/customer-situation` in App.jsx
- [ ] **Nav** — Add "Müşteri Durumu" (LayoutDashboard/Activity icon)
- [ ] **i18n** — Create `src/locales/tr/customerSituation.json` (page title, columns, health labels, notes panel, actions)

### 1.4 Health Rules (Reference)

| Status   | Condition                                                       |
|----------|------------------------------------------------------------------|
| Critical | Payment overdue 30+ days OR open WO older than 7 days            |
| Warning  | Payment overdue 15–30 days OR open WO 4–7 days old              |
| Healthy  | Everything else                                                 |

Default view = Critical + Warning only. Toggle to show all.

**Edge cases:** Customer with no subscription → payment axis = 0; no open WOs → WO axis = 0; no subscription AND no WOs → always healthy. Use `COALESCE` so nulls never trigger warning/critical.

### 1.5 Implementation Order

1. Migration (table + view + indexes + RLS)
2. `api.js` — fetch situation list, fetch notes, add note
3. `hooks.js` — React Query hooks
4. `schema.js` — note form validation
5. Translations — stub all keys in `customerSituation.json` before JSX
6. `CustomerSituationPage.jsx` — main board (table, toggle, health badges)
7. `CustomerNotesPanel.jsx` — slide-over with note history
8. `SituationActionsMenu.jsx` — quick actions
9. Wire route + nav

### 1.6 Out of Scope

- Paraşüt integration (placeholder only)
- Email/push notifications when customer turns critical
- Configurable thresholds (hardcoded: 30 days payment, 7 days WO)
- SIM card health (not requested)

---

## 2. Equipment Lifecycle

**Status:** Partial. DB allows `demount`; `useAssetHistory` exists. Rest not implemented.  
**Source:** equipment-lifecycle-plan.md (archived)

### 2.1 Already in Codebase

- `work_orders.work_type` — DB allows `demount` (migration 00074)
- `useAssetHistory(assetId)` — exists in siteAssets/hooks.js
- `fetchAssetHistory(assetId)` — exists in siteAssets/api.js

### 2.2 Feature 4 — Demount Work Type (Simple, do first)

- [ ] **schema.js** — Add `'demount'` to `WORK_TYPES` array
- [ ] **schema.js** — Refine: exempt `'demount'` from `items.length > 0` (like `'survey'`)
- [ ] **common.json** — Add `"demount": "Demontaj"` under `workType`

### 2.3 Feature 3 — Replacement Reason (Simple, before Feature 1)

- [ ] **Migration** — Create `supabase/migrations/00XXX_add_site_assets_replacement_reason.sql`:
  - `ALTER TABLE site_assets ADD COLUMN IF NOT EXISTS replacement_reason TEXT;`
- [ ] **api.js** — In `removeAsset`, add `replacement_reason` to destructured options and payload

### 2.4 Feature 1 — Post-Completion Equipment Modal (Complex)

- [ ] **Pre-step** — Extract `bulkItemSchema` and `defaultItem` from BulkAssetRegisterModal.jsx → siteAssets/schema.js
- [ ] **api.js** — Add `bulkLinkAssetsToWorkOrder(workOrderId, assetIds, action)`
- [ ] **api.js** — Add `bulkRemoveAssets(assetIds, { removed_at, removed_by_work_order_id, replacement_reason })`
- [ ] **hooks.js** — Add `useBulkLinkAssetsToWorkOrder`, `useBulkRemoveAssets`
- [ ] **CREATE** — `src/features/workOrders/components/PostCompletionEquipmentModal.jsx`:
  - Installation mode: add equipment rows, bulkCreate, bulkLink
  - Demount mode: select existing assets, bulkRemove, bulkLink
  - Two-step retry safety (createdAssetIds state)
- [ ] **WorkOrderDetailPage.jsx** — Add `showEquipmentModal` state; on status→completed for installation/demount, open modal
- [ ] **workOrders.json** — i18n for modal strings

### 2.5 Feature 2 — Asset History UI (Medium)

- [ ] **CREATE** — `src/features/siteAssets/components/AssetHistorySection.jsx`:
  - Expandable per asset, lazy-load `useAssetHistory(isOpen ? assetId : null)`
  - List work orders that touched asset (action, date, WO ref)
- [ ] **SiteAssetsCard.jsx** — Integrate AssetHistorySection per asset row
- [ ] **siteAssets.json** — i18n for history section

### 2.6 Implementation Order

1. Feature 4 (demount) → 2. Feature 3 (replacement_reason) → 3. Feature 1 (modal) → 4. Feature 2 (history)

**Constraint:** Migration for Feature 3 must run before Feature 1 ships to production.

---

## 3. Price Revision — Finishing Touches

**Status:** Partial. Core features (Zam %, message, copy, Excel, notes) are live. One UX item remains.

### 3.1 Implemented (Live)

| Feature | Status |
|---------|--------|
| Zam % column with auto-calc | ✅ |
| Message template (Option B, KDV-free) | ✅ |
| Copy Message button (per row) | ✅ |
| Message month selector | ✅ |
| Excel export | ✅ |
| Confirmation modal before bulk save | ✅ |
| Notes system (timeline, add form) | ✅ |
| `subscription_price_revision_notes` table | ✅ |

### 3.2 Unfinished — Table Layout

**Current:** Table uses `overflow-x-auto`; 12+ columns cause horizontal scroll on smaller viewports.

**Goal:** Fit all columns without left–right scroll (or reduce scroll as much as possible). Full column names must stay (short headers rejected).

### 3.3 Reference: Layout Options

**Goal:** Fit 11 columns without horizontal scroll, **keeping full column names**. Short headers rejected.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Two-Row Header** | Split long headers into two lines (e.g. "Baz" + "Fiyat", "SMS" + "Ücreti"). Modify Table for `headerLines` or `headerComponent`. | Full names visible, saves ~30–40% width | Taller header row |
| **B. Grouped Pricing** | Combine 5 pricing columns (Baz Fiyat, SMS, Hat, KDV, Maliyet) into one "Fiyatlar" column with vertical stack. Replace 5 cols → 1. | Reduces 11 → 7 columns | Taller rows, less scan-able |
| **C. Compact Padding** | `px-6 py-4` → `px-3 py-2`; smaller fonts; fixed widths (Müşteri 140px, Hesap No 75px, … total ~1015px). `table-layout: fixed`. | Fits 1280px, standard layout | Denser, may feel cramped |
| **D. Responsive Hiding** | Always: Müşteri, Hesap No, Başlangıç, Tip, Baz, KDV, Maliyet. On `2xl` add: SMS, Hat, Hizmet Türü, Ödeme Sıklığı. `hidden xl:table-cell`. | Progressive disclosure | Some data hidden until larger screen |
| **E. Rotated Headers** | CSS `transform: rotate(-45deg)` on `<th>`. | Full names, saves width | Less readable |
| **F. Split Table** | Left table (6 cols): identity; Right table (5 cols): pricing. Sync row highlighting. | Each fits easily | Harder to scan across |

**Recommended:** Option B + Option C — 7 columns total, compact padding (`px-4 py-3`), fixed widths ~850px → fits in 1280px.

---

## 4. Technical Debt / Infrastructure

**Source:** MASTER_ROADMAP.md (archived)

| # | Task | Priority |
|---|------|----------|
| 1 | **DB Schema Validation** — Add `NOT NULL` and `CHECK` constraints at the database level so no rogue API call can insert corrupt data | 🔴 High |
| 2 | **Proposals View Optimization** — Refactor `proposals_detail` view using `LATERAL JOIN`s + trigram indexes, mirroring the `work_orders_detail` fix | 🔴 High |
| 3 | **Atomic Subscription Actions** — Move `pauseSubscription` / `cancelSubscription` to Postgres RPCs (`fn_pause_subscription`, `fn_cancel_subscription`) with transaction safety | 🔴 High |
| 4 | **Query Timeouts** — Implement `statement_timeout` for long-running queries; protect the DB from runaway requests at scale | 🟡 Medium |
| 5 | **DB Testing Foundation** — Set up pgTAP (or equivalent) migration test suite so every future migration is verified before hitting production | 🟡 Medium |

---

## 5. Other Functional Backlog

| # | Task | Priority |
|---|------|----------|
| 6 | **Advanced Finance Dashboard** — Rich charts: monthly P&L trend, revenue by customer segment, expense breakdown, cash flow projection | 🟡 Medium |
| 7 | **Inventory Alerts** — Automatic notifications when material stock drops below threshold; integrated with the existing notifications system | 🟢 Low |

---

## 6. Quality Assurance & Testing

**Reference:** Full scenarios in `/docs/TEST-SCENARIOS.md` (permanent reference).

### 6.1 Automated Tests

| Category | Status | Scope |
|----------|--------|-------|
| RLS integrity | ✅ Done | Anon/technician blocked from finance; profiles read-all (accepted) |
| Proposals (PR-C3) | ✅ Done | TRY proposal saves `unit_price_usd` as null |
| Subscriptions (SB-C2, SB-C3) | ✅ Done | Payment recording returns `subscription_id`; pause skips future months |
| Materials (MA-C1-API) | ✅ Done | Malformed body rejected |
| Technician role (TECH-BLOCK, TECH-ALLOW) | ✅ Done | Blocked/allowed tables per RLS |

### 6.2 Manual Tests — Pending (24 scenarios)

| Category | Count | Examples |
|----------|-------|----------|
| Auth | 3 | Email verification error, password recovery, password change |
| Action Board | 2 | Hidden during profile load, warning when queries fail |
| Site Assets | 1 | Bulk registration from list page |
| Tasks | 1 | Single submit creates one task only |
| Work Orders | 2 | Materials refresh, pre-filled site_id preserved |
| Customers | 1 | Deleted site disappears immediately |
| Notifications | 1 | Badge updates after resolve |
| Dashboard | 2 | Fallback for missing customer name, action board warning |
| Proposals | 1 | PDF export error toast |
| SIM Cards | 2 | Import warns on failure, Excel dates correct |
| Materials | 1 | Malformed Excel parse error toast |
| Work History | 1 | Workers column populated |
| Subscriptions | 2 | Pause keeps current month, notes 10k chars |
| Finance / Validation | 4 | Invalid date, IBAN, currency enum, units dropdown |
| Error handling | 1 | Turkish error toasts |

---

## Archived / Deprecated

- `plan-customer-situation.md` → archive/deprecated
- `equipment-lifecycle-plan.md` → archive/deprecated
- `price-revision-zam-message-plan.md` → archive/deprecated
- `subscriptions-price-revision-analysis.md` → archive/deprecated
- `fiyat-artis-dostu-integration-analysis.md` → archive/deprecated
- `subscriptions-multi-service-risk-analysis.md` → archive/deprecated
- `MASTER_ROADMAP.md` → archive/deprecated (content merged here)
- `active-plans-consolidated.md` → archive/deprecated (content merged here)
- `subscriptions-price-revision-alternatives.md` → archive/deprecated (layout options in §3.3)
