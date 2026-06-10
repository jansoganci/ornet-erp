# Phase 10 — Bundle / Frontend Performance Audit Report

> **Date:** 2026-05-31  
> **Scope:** Vite production build, `src/App.jsx` route loading, heavy dependencies, PWA precache, feature barrels  
> **Method:** `npm run build` (Vite 7.3.1), static import graph review, `dist/index.html` modulepreload analysis  
> **Prior reports:** [09-react-query-audit.md](./09-react-query-audit.md) (dashboard mount cost compounds bundle cost)  
> **Status:** Audit only — no Vite, route, or dependency changes

---

## Executive Summary

Production build produces a **2.40 MB** main chunk (`index-*.js`, gzip **638 KB**) plus **four heavy vendor chunks** that are **`modulepreload`’d on every page load** via `dist/index.html`: **`pdf-renderer` (~1.57 MB / 524 KB gzip)**, **`xlsx` (~424 KB)**, **`pdfjs` (~405 KB)**, and **`recharts` (~395 KB)**. **Estimated first-visit JS (gzip): ~1.6 MB** before CSS, fonts, Sentry, and the **2.17 MB `pdf.worker` asset**.

**Root cause:** `App.jsx` **eagerly imports ~45 route-level pages** (auth, dashboard, customers, work orders, finance, proposals, subscriptions, operations, SIM, etc.). Only **`InvoiceAnalysisPage`** uses `React.lazy`. `manualChunks` splits libraries into separate files but **does not defer download** when the entry module statically imports proposal PDF, list-page XLSX, and dashboard `recharts` (via `KpiCard`).

**`chunkSizeWarningLimit: 2000`** (kB) in `vite.config.js` L74 suppresses routine Rollup warnings; build **still emitted** a >2000 kB warning for the main chunk. **PWA precache** registers **~6.9 MB** of assets (`maximumFileSizeToCacheInBytes: 4 MB` per file — worker and main chunks fit, but total SW cache is large for mobile).

**Overall verdict:** **FAIL for field-worker / slow-network targets** — initial payload is far above common 500 KB–1 MB gzip budgets. **CONDITIONAL PASS** on existing `manualChunks` + single lazy route as a partial foundation.

| Severity | Count |
|----------|-------|
| **CRITICAL** | **3** |
| **HIGH** | **7** |
| **MEDIUM** | **6** |
| **LOW** | **4** |

---

## Build Output (2026-05-31, `npm run build`)

| Asset | Size (minified) | Gzip | Notes |
|-------|-----------------|------|-------|
| `index-*.js` | **2,401.95 kB** | **637.84 kB** | Main app + most eager features |
| `pdf-renderer-*.js` | 1,571.65 kB | 523.90 kB | `@react-pdf/renderer` |
| `xlsx-*.js` | 424.39 kB | 140.42 kB | SheetJS |
| `pdfjs-*.js` | 404.51 kB | 119.65 kB | `pdfjs-dist` |
| `recharts-*.js` | 394.60 kB | 115.27 kB | Charts |
| `react-vendor-*.js` | 193.59 kB | 60.66 kB | `react` + `react-dom` |
| `InvoiceAnalysisPage-*.js` | 29.08 kB | 6.25 kB | **Only lazy route chunk** |
| `index-*.css` | 183.84 kB | 26.96 kB | Tailwind |
| `pdf.worker-*.mjs` | **2,174.48 kB** | — | Static asset (pdfjs worker) |

**Rollup warning (still shown):** “Some chunks are larger than 2000 kB after minification” — refers to **`index`** (~2402 kB).

**Not split to dedicated chunks (bundled inside `index`):** `react-big-calendar`, `framer-motion`, `@supabase/supabase-js`, `i18next`, most feature code.

**PWA:** `precache 24 entries (6918.91 KiB)` — service worker caches JS/CSS/HTML/icons; large chunks cached on install.

---

## Initial Load Graph (`dist/index.html`)

`index.html` L25–30 **modulepreload** (loaded early on every visit):

```html
/assets/index-DeuYuCa5.js
/assets/react-vendor-6bx5LutF.js
/assets/recharts-Bq6mY1uf.js
/assets/pdf-renderer-DdwxJtmS.js
/assets/xlsx-Cig0qvpi.js
/assets/pdfjs-DkPqwpy7.js
```

**Implication:** Even on `/` (dashboard) or `/work-orders` (field worker), the browser is steered to fetch **PDF + XLSX + pdfjs + charts** because the main bundle’s static import graph references those chunks. Lazy `InvoiceAnalysisPage` does **not** keep `pdfjs` off the critical path (see CRITICAL-3).

---

## Route Loading Inventory (`src/App.jsx`)

### Lazy-loaded (1 route)

| Route | Lines | Mechanism |
|-------|-------|-----------|
| `/sim-cards/invoice-analysis` | L66–68, L171 | `lazy(() => import('./features/simCards/InvoiceAnalysisPage'))` + `Suspense` |

### Eagerly imported pages (representative — all in main graph)

| Group | Pages imported | App.jsx lines |
|-------|----------------|---------------|
| Auth | Login, Register, Forgot/Update password, Verify email | L26–32 |
| Core | `DashboardPage`, Profile, Notifications, Action board | L35–36, L74–75, L78 |
| Customers | List, Detail, Form, Import, Paraşüt matching | L37–42, L113–118 |
| Work orders | List, Detail, Form, Daily work, Work history | L44–49, L121–128 |
| Materials | List, Import | L50, L129–130 |
| Subscriptions | Layout, List, Detail, Form, Import, Price revision, Collection desk | L52–58, L135–143 |
| Proposals | List, Detail, Form | L70–73, L146–149 |
| Finance | Dashboard, Expenses, Income, VAT, Exchange, Recurring, Receivables, Tahsilat, Collection desk | L76, L152–159 |
| SIM | List, Form, Import | L60–63, L168–170 |
| Operations | Board, Import | L79, L109–110 |
| Equipment | List, Import | L77, L164–165 |
| Technical guide | List, Topic | L80, L131–132 |

**Count:** ~**44 page components** eager vs **1** lazy.

---

## Heavy Dependency Trace

| Dependency | manualChunk | Eager import path | On initial `/` load? |
|------------|-------------|-------------------|----------------------|
| **@react-pdf/renderer** | `pdf-renderer` | `ProposalDetailPage`, `ProposalFormPage` → `ProposalPdf` / `ProposalLivePreview` / `pdf()` | **Yes** (modulepreload) |
| **pdfjs-dist** | `pdfjs` | `parseTurkcellPdf.js` ← lazy `InvoiceAnalysisPage`; also **linked from entry graph** (preload) | **Yes** (preload) — see CRITICAL-3 |
| **xlsx** | `xlsx` | `CustomersListPage`, `SimCardsListPage`, `ProposalDetailPage`, import utils on eager import pages | **Yes** (modulepreload) |
| **recharts** | `recharts` | `KpiCard` (`components/ui/KpiCard.jsx` L4–9); `DashboardPage` charts; `FinanceDashboardPage`; `OperationsBoardPage` → `InsightsTab` (imported at top level) | **Yes** (modulepreload) |
| **react-big-calendar** | *(in `index`)* | `operations/OperationsBoardPage.jsx` L8 → `CalendarTab.jsx` L4 | **Yes** when ops route in graph; chunk in **index** |
| **framer-motion** | *(in `index`)* | `FloatingActionMenu.jsx` L4 — `AppLayout` | **Yes** for all authenticated layouts |
| **lucide-react** | *(in `index`)* | 100+ named icon imports | Per-icon tree-shake; still sizable aggregate |

### Charts only on chart pages?

| Library | Used on dashboard `/`? | Other |
|---------|-------------------------|-------|
| **recharts** | **Yes** — `RevenueExpenseLineChart`, `WorkOrderStatusDonut`, `KpiCard` sparklines | Finance dashboard, operations insights, SIM invoice chart (lazy page) |
| **react-big-calendar** | No on `/` | Operations calendar tab, standalone `CalendarPage` (not routed in `App.jsx`) |

### PDF libraries only where needed?

| Library | Intended use | Actual load |
|---------|--------------|-------------|
| **@react-pdf** | Proposal PDF preview/export | **Preloaded globally** via eager proposal pages |
| **pdfjs-dist** | SIM invoice analysis | **Preloaded globally** despite lazy route (CRITICAL-3) |

### XLSX only on import/export?

| File | xlsx import | Eager via App? |
|------|-------------|----------------|
| `CustomersListPage.jsx` L6 | `import * as XLSX` | **Yes** |
| `SimCardsListPage.jsx` L4 | **Yes** | **Yes** |
| `ProposalDetailPage.jsx` L16 | **Yes** | **Yes** |
| Import pages + `importUtils` | Yes | Import routes eager |

List pages pull **xlsx** into the default graph even when the user only views the table.

---

## Detailed Findings

### CRITICAL-1 — Main chunk ~2.4 MB; exceeds 2 MB warning threshold

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **File** | `vite.config.js` L72–74; build output `dist/assets/index-*.js` |
| **Dependency / route** | Entire eager app shell |
| **Current behavior** | Single `index` chunk holds most features; Rollup warns >2000 kB. |
| **Why it affects performance** | Long parse/compile on mobile; blocks TTI on 3G/4G. |
| **Proposed fix** | Route-level `React.lazy` for finance, proposals, subscriptions, operations, imports; reduce entry to layout + dashboard shell. |
| **Expected benefit** | Main chunk target **<500 KB gzip** for field-worker entry routes. |

---

### CRITICAL-2 — Global `modulepreload` of PDF + XLSX + charts on every visit

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **File** | `dist/index.html` L27–30; caused by `src/App.jsx` L26–80 eager imports |
| **Dependencies** | `pdf-renderer`, `xlsx`, `pdfjs`, `recharts` |
| **Current behavior** | First navigation downloads **~3.8 MB minified** (~1.3 MB gzip) of libraries many users never use on first session. |
| **Why it affects performance** | Field workers hitting `/work-orders` still pay proposal/finance/import library cost. |
| **Proposed fix** | Lazy-load proposal module, finance pages, customer/SIM list export (dynamic `import('xlsx')`), dashboard charts (`import('recharts')`). |
| **Expected benefit** | **~1 MB+ gzip** off critical path for non-accountant routes. |

---

### CRITICAL-3 — `pdfjs-dist` preloaded despite lazy `InvoiceAnalysisPage`

| Field | Detail |
|-------|--------|
| **Risk** | **CRITICAL** |
| **Files** | `src/features/simCards/utils/parseTurkcellPdf.js` L15–19; `src/features/simCards/index.js` L4 (re-export); `App.jsx` L66–68 (lazy) vs L60–63 (eager sim barrel) |
| **Current behavior** | `pdfjs` chunk appears in **entry modulepreload** although only `InvoiceAnalysisPage` imports `parseTurkcellPdf`. Likely **barrel re-export** (`index.js` exports `InvoiceAnalysisPage`) or shared chunk hoisting from build graph. |
| **Why it affects performance** | **~120 KB gzip** pdfjs + **2.17 MB worker** for users who never open invoice analysis. |
| **Proposed fix** | Remove `InvoiceAnalysisPage` from `simCards/index.js`; dynamic `import('./utils/parseTurkcellPdf')` inside page handler only; lazy-load worker URL on first PDF upload. |
| **Expected benefit** | pdfjs + worker off default path. |

---

### HIGH-1 — `chunkSizeWarningLimit: 2000` masks bundle regressions

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **File** | `vite.config.js` L73–74 |
| **Current behavior** | Limit **2000 kB** vs default 500 kB; comment acknowledges debt “until routes are lazy-loaded”. Warning still shown for 2402 kB index. |
| **Proposed fix** | Lower to **500** after route splitting; document accepted chunks in report/README. |
| **Expected benefit** | CI-visible regressions. |

---

### HIGH-2 — `App.jsx` eager imports ~44 pages; only one `lazy()`

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **File** | `src/App.jsx` L26–80 |
| **Current behavior** | All feature pages parsed into main dependency tree at startup. |
| **Proposed fix** | `lazy()` groups: `finance/*`, `proposals/*`, `subscriptions/*`, `operations/*`, `sim-cards/*`, `*/import`, `technical-guide/*`. |
| **Expected benefit** | Smaller initial JS; faster first paint for `/` and `/work-orders`. |

---

### HIGH-3 — Proposals eager-load `@react-pdf/renderer` (~1.57 MB chunk)

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `ProposalDetailPage.jsx` L14, L52; `ProposalFormPage.jsx` L55 → `ProposalLivePreview.jsx` L2; `ProposalPdf.jsx` L9 |
| **Routes** | `/proposals`, `/proposals/:id`, `/proposals/new` (eager) |
| **Proposed fix** | Lazy proposal routes; dynamic `import('@react-pdf/renderer')` on Preview/Export only. |
| **Expected benefit** | **~524 KB gzip** off default load. |

---

### HIGH-4 — `KpiCard` pulls `recharts` onto dashboard and many list pages

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `src/components/ui/KpiCard.jsx` L4–9; `src/pages/DashboardPage.jsx` L16; `WorkOrdersListPage`, `SubscriptionsListPage`, finance pages |
| **Current behavior** | Shared UI component imports full recharts primitives for optional sparklines. |
| **Proposed fix** | Lazy sparkline sub-component; CSS-only trend on dashboard; or separate `KpiCardWithSparkline`. |
| **Expected benefit** | **~115 KB gzip** off routes without sparklines. |

---

### HIGH-5 — `OperationsBoardPage` top-level imports calendar + insights deps

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `OperationsBoardPage.jsx` L8–9; `CalendarTab.jsx` L4; `InsightsTab.jsx` L14 |
| **Dependencies** | `react-big-calendar` (in **index**), `recharts` |
| **Current behavior** | Tab components imported at module scope; **calendar/insights code in ops chunk inside index** even when `tab=pool`. Tabs are conditionally rendered (L71–79) but **not code-split**. |
| **Proposed fix** | `lazy(() => import('./CalendarTab'))` per tab. |
| **Expected benefit** | Smaller ops route parse; calendar only when tab opened. |

---

### HIGH-6 — List pages static `import * as XLSX`

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **Files** | `CustomersListPage.jsx` L6; `SimCardsListPage.jsx` L4; `ProposalDetailPage.jsx` L16 |
| **Proposed fix** | `const XLSX = await import('xlsx')` inside export button handler. |
| **Expected benefit** | **~140 KB gzip** off non-export sessions. |

---

### HIGH-7 — PWA precache ~6.9 MB including large JS

| Field | Detail |
|-------|--------|
| **Risk** | **HIGH** |
| **File** | `vite.config.js` L43–47 (`workbox.globPatterns`, `maximumFileSizeToCacheInBytes: 4MB`) |
| **Current behavior** | SW precaches **all** built JS/CSS; first install downloads multi-MB cache. |
| **Why it affects performance** | Slow first PWA install; storage pressure on mobile. |
| **Proposed fix** | Precache only shell + manifest; runtime-cache feature chunks; exclude `pdf.worker` from precache if lazy. |
| **Expected benefit** | Faster install; smaller offline baseline. |

---

### MEDIUM-1 — `framer-motion` on global `FloatingActionMenu`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/components/layout/FloatingActionMenu.jsx` L4; `AppLayout.jsx` L298 |
| **Proposed fix** | CSS transitions or lazy `framer-motion` when FAB opens. |
| **Expected benefit** | Tens of KB off index chunk. |

---

### MEDIUM-2 — Finance barrel exports pages + `QuickEntryModal`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/finance/index.js` L1–13 |
| **Note** | `App.jsx` imports pages directly from barrel path `'./features/finance'` — pulls all exported pages into graph. |
| **Proposed fix** | Import pages from direct files in `App.jsx`; avoid `export *` from heavy `api.js` in barrels used by layout. |

---

### MEDIUM-3 — `simCards/index.js` re-exports lazy page

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/features/simCards/index.js` L4 |
| **Proposed fix** | Remove `InvoiceAnalysisPage` export; App already lazy-imports file path directly. |

---

### MEDIUM-4 — Sentry Replay + tracing in `main.jsx` entry

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `src/main.jsx` L11–21 |
| **Current behavior** | `@sentry/react` with replay in main entry (prod when DSN set). |
| **Expected benefit** | Optional async Sentry init after hydrate. |

---

### MEDIUM-5 — Google Fonts render-blocking in `index.html`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `index.html` L20–22 (source template; mirrored in `dist/index.html`) |
| **Proposed fix** | `font-display: swap`, self-host Inter, or preload only used weights. |

---

### MEDIUM-6 — `react-big-calendar` not in `manualChunks`

| Field | Detail |
|-------|--------|
| **Risk** | **MEDIUM** |
| **File** | `vite.config.js` L79–88 |
| **Proposed fix** | Add `if (id.includes('react-big-calendar')) return 'calendar'` + lazy ops tabs. |

---

### LOW-1 — `manualChunks` for react, pdf, recharts, xlsx (partial win)

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** (positive, incomplete) |
| **File** | `vite.config.js` L79–88 |
| **Note** | Splits files but **entry still references** them — does not defer without dynamic import. |

---

### LOW-2 — `InvoiceAnalysisPage` lazy pattern (reference implementation)

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** (positive) |
| **File** | `App.jsx` L66–68, L171 |
| **Extend to** | Finance, proposals, imports, operations. |

---

### LOW-3 — `CalendarPage` not routed (dead weight in codebase only)

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **File** | `src/features/calendar/CalendarPage.jsx` — not in `App.jsx` |
| **Note** | Calendar UX lives under operations `CalendarTab`; standalone page unused in router. |

---

### LOW-4 — lucide-react widespread; acceptable with named imports

| Field | Detail |
|-------|--------|
| **Risk** | **LOW** |
| **Evidence** | Named imports per file — no `import * from 'lucide-react'` anti-pattern found. |

---

## `manualChunks` Opportunities (not implemented)

| Chunk id | Module | Priority |
|----------|--------|----------|
| `calendar` | `react-big-calendar` | High (ops) |
| `supabase` | `@supabase/supabase-js` | Medium |
| `i18n` | `i18next` + locales | Medium (careful with locale splitting) |
| `framer-motion` | FAB only | Medium |
| Route-based | `finance`, `proposals`, `subscriptions` | **Highest** — use `import()` not just `manualChunks` |

**Comment in config (L77–78):** Avoid catch-all `vendor` chunk — good; route lazy-loading is the missing piece.

---

## Prioritized Lazy-Load List

| Priority | Route / module | Heavy dep |
|----------|----------------|-----------|
| P0 | `proposals/*` | `@react-pdf/renderer` |
| P0 | `finance/*` (except optional slim KPI if needed on home) | `recharts`, large finance pages |
| P0 | `CustomersListPage` / `SimCardsListPage` export | `xlsx` dynamic |
| P1 | `operations` + tab splits | `react-big-calendar`, `recharts` |
| P1 | `subscriptions/*`, `sim-cards/import` | `xlsx` |
| P1 | `*/import` pages | `xlsx` |
| P2 | `technical-guide`, `materials`, `equipment` | Low |
| Done | `sim-cards/invoice-analysis` | `pdfjs` (route lazy; fix preload) |

---

## Cross-Report Notes

| Report | Interaction |
|--------|-------------|
| **Phase 9** | Dashboard mounts heavy **queries** on the same **large JS** payload — double penalty on `/`. |
| **Phase 8** | Lazy routes reduce main-thread work before RPC/view calls. |
| **Phase 5** | Bundle exposure: finance libraries in memory for all roles loading preloaded chunks. |

---

## Routes / Dependencies Needing Immediate Review

1. **`src/App.jsx`** — eager page imports (only `InvoiceAnalysisPage` lazy)  
2. **`@react-pdf/renderer`** — via eager `ProposalDetailPage` / `ProposalFormPage`  
3. **`xlsx`** — via eager `CustomersListPage`, `SimCardsListPage`, `ProposalDetailPage`  
4. **`recharts`** — via `KpiCard` + `DashboardPage` + finance/operations  
5. **`pdfjs-dist` + worker** — preload + 2.17 MB worker asset  
6. **`vite.config.js`** — `chunkSizeWarningLimit: 2000`, PWA precache scope  
7. **`OperationsBoardPage`** — `CalendarTab` / `InsightsTab` static imports  

---

## Recommended Next Action

1. **APPROVE** a **route-splitting** PR: lazy `finance`, `proposals`, `subscriptions`, `operations`, imports; dynamic `xlsx`/`@react-pdf` in handlers.  
2. Fix **`pdfjs` preload** (barrel + dynamic import in invoice analysis only).  
3. Lower **`chunkSizeWarningLimit`** to **500** after splits; re-run build and target **<500 KB gzip** initial for `/work-orders`.  
4. Tune **PWA precache** to exclude lazy feature chunks until visited.  
5. Combine with **Phase 9** dashboard `enabled: canWrite` to avoid loading finance **code and data** for field workers.

---

## What Was Not Changed

- No `vite.config.js`, `App.jsx`, or dependency changes  
- Build artifacts in `dist/` from audit run only (not committed)
