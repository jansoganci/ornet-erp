# Launch-Ready TODO

> **Target Launch:** 2026-03-26 (1 week)
> **Philosophy:** If it doesn't work in the field, it doesn't ship. Verify first, speed second, polish last.
> **Replaces:** `MASTER_PENDING_TASKS.md` (moved to archive/deprecated)

---

## Priority 1 — Critical Verification

> "Is it actually working?" — Audit before building anything new.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 1.1 | **Equipment Inventory Audit** | ✅ Done | Medium | **Result: 60% complete, launch-ready.** Core CRUD, list page, bulk register, customer detail tab all functional. Missing: WO↔asset link UI, demount in frontend, asset history component. No launch blockers. See audit in conversation 2026-03-19. |
| 1.1a | ↳ Deep code audit completed | ✅ Done | Medium | 3 migrations (00074/84/94), 12 API functions, 13 hooks, 5 components, 1 page. DB foundation solid. Lifecycle features (demount, post-completion modal, history UI) are post-launch. |
| 1.2 | **Recurring Payments Audit** | ✅ Done | Medium | **Result: 100% complete, production-ready.** 6 migrations, dual duplicate prevention (EXISTS + unique index), daily cron + manual trigger, complete CRUD UI, correct VAT/financial integration. No launch blockers. |
| 1.2a | ↳ Deep code audit completed | ✅ Done | Medium | 6 migrations (00070→00116), 6 API functions, 6 hooks, 3 components, 1 page. Dual duplicate prevention is gold standard. Cron runs daily 1am UTC. Minor post-launch suggestion: add ON CONFLICT DO NOTHING. |
| 1.3 | **Excel Upload Fixes** | ✅ Done | Small | **Asset Import:** Result summary with imported/skipped counts; ACC disambiguation via company_name (MÜŞTERİ) when duplicate ACC; Excel button verified on Varlık Takibi page. Customer/SIM/Material importers audited — no mapping changes needed. |

---

## Priority 2 — Operational Speed

> Field team and office staff need these daily. Speed = adoption.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 2.1 | **Easy Payment Screen** | ✅ Done | Medium | Collection Desk at `/subscriptions/collection` with Quick Pay. |
| 2.2 | **SIM Card Filters — Metbel / My Center** | ✅ Already exists | — | **Audit result: Already done.** Provider company filter dropdown exists on SimCardsListPage (dynamic from `provider_companies` table). "Metbel"/"My Center" are provider company names — user creates them via import or SIM form. No code changes needed. |
| 2.3 | **SIM Card Export** | ✅ Already exists | Tiny | **Audit result: Already done.** XLSX export with 13 columns exists (SimCardsListPage lines 111-141). **One bug found:** export ignores year/month filters (fetchSimCards vs fetchSimCardsPaginated mismatch in api.js). Fix = copy year/month filter logic to fetchSimCards(). |
| 2.3a | ↳ Fix export year/month filter bug | ✅ Done | Tiny | Added year/month filter logic to `fetchSimCards()` in `src/features/simCards/api.js`. Export now respects all active filters. Build verified. |

---

## Priority 3 — The Board

> Customer health tracking + task management. Kanban deferred post-launch.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 3.1 | **Customer Situation — Design** | ✅ Done | Medium | Audited and designed. |
| 3.2 | **Database — customer_notes + health RPC** | ✅ Done | Medium | Implemented. |
| 3.3 | **Feature Module — customerSituation/** | ✅ Done | Large | Implemented. |
| 3.4 | **~~Kanban View Component~~** | ✅ Done | Large | Deferred to post-launch. |

---

## Priority 4 — UI/UX Polish

> Make existing features look right. No new functionality.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 4.1 | **Excel Upload UX Improvements** | ✅ Done | Small | **2026-03-19:** Shared `ImportInstructionCard` + `ImportResultSummary` (`src/components/import/`); all 5 flows; unified label `common.import.bulkImportButton` (*Excel ile toplu yükle*); abonelik `/subscriptions/import` tam sayfa (modal kaldırıldı); parse/özet metinleri; SiteAssets `setUnresolvedIndices` fix. |
| 4.2 | **Price Revision Table Layout** | ✅ Done | Medium | Implemented. |

---

## Priority 5 — Docs & Maintenance

> Keep the house clean for post-launch.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 5.1 | **CLAUDE.md Update** | ✅ Done | — | Synced with current architecture (2026-03-19). Finance rules, dynamic VAT, trigger flows documented. |
| 5.2 | **Technical Guide** | ✅ Done | Medium | AI context docs created in `docs/ai_context/` (SYSTEM_MAP, MODULE_OPERATIONS, MODULE_FINANCE, MODULE_SUBSCRIPTIONS). |
| 5.3 | **User Guide (Kullanım Kılavuzu)** | ✅ Done | Large | Completed. |

---

## Carried Forward — Technical Debt (Post-Launch)

> Important but not launch-blocking. Tackle after stable launch.

**Completed from this list:**

- **T8** — Owner-focused finance dashboard (tabbed channels, bar charts, KOBİ copy, no pie / no net-profit headline). Plan arşivlendi: `docs/archive/completed/FINANCE_DASHBOARD_V2_PLAN.md` — **2026-03-20**.
- **T6** — Finance Fix Roadmap tamamlandı. Kaynak: `docs/archive/completed/finance-fix-roadmap.md` — **✅ Done (2026-03-21)**.

| # | Task | Priority | Source |
|---|------|----------|--------|
| T1 | DB Schema Validation — `NOT NULL` + `CHECK` constraints | High | Old MASTER §4 |
| T2 | Proposals View Optimization — `LATERAL JOIN` + trigram indexes | High | Old MASTER §4 |
| T3 | Atomic Subscription Actions — `fn_pause_subscription` RPC | High | Old MASTER §4 |
| T4 | Query Timeouts — `statement_timeout` | Medium | Old MASTER §4 |
| T5 | DB Testing Foundation — pgTAP suite | Medium | Old MASTER §4 |
| T7 | Equipment Lifecycle — demount WO type, replacement reason, post-completion modal, asset history UI | Medium | Old MASTER §2 |

---

## Manual Test Scenarios — Pre-Launch Checklist

> From old MASTER §6.2 — 24 scenarios to verify before go-live.

| Area | Count | Key Scenarios |
|------|-------|---------------|
| Auth | 3 | Email verification, password recovery/change |
| Action Board | 2 | Hidden during load, warning on query fail |
| Site Assets | 1 | Bulk registration |
| Tasks | 1 | Single submit = one task |
| Work Orders | 2 | Materials refresh, site_id preserved |
| Customers | 1 | Deleted site disappears |
| Notifications | 1 | Badge updates on resolve |
| Dashboard | 2 | Missing name fallback, action board warning |
| Proposals | 1 | PDF export error toast |
| SIM Cards | 2 | Import failure warning, Excel dates |
| Materials | 1 | Malformed Excel parse error |
| Work History | 1 | Workers column populated |
| Subscriptions | 2 | Pause keeps current month, notes 10k chars |
| Finance | 4 | Invalid date, IBAN, currency, units dropdown |
| Error Handling | 1 | Turkish error toasts |

---

## Decision Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-03-19 | Merged MASTER_PENDING_TASKS into this file | Launch prep — single source of truth |
| 2026-03-19 | Customer Situation deferred to P3 | Core verification (P1) and field team speed (P2) take priority for launch week |
| 2026-03-19 | Finance fix roadmap deferred to post-launch (T6) | P&L double-counting and other bugs are real but not launch-blocking for initial rollout |
| 2026-03-19 | Equipment lifecycle deferred to post-launch (T7) | Partial implementation works; full lifecycle can ship later |
| 2026-03-19 | SIM Card filters (2.2) already exist — no work needed | Provider company dropdown is the Metbel/My Center filter |
| 2026-03-19 | SIM Card export (2.3) already exists — only year/month bug to fix | 13-column XLSX export functional; fetchSimCards() missing year/month filter |
| 2026-03-19 | Kanban (3.4) deferred to post-launch | No drag-drop library, no board schema, tasks use time-horizon — too risky for 1 week |
| 2026-03-19 | Easy Payment (2.1): "Quick Pay" with defaults is the right approach | fn_record_payment only needs payment_date + payment_method; rest can default |
| 2026-03-20 | T8 Finance Dashboard V2 shipped | Sekmeli kanallar, KOBİ dili, bar grafik; T8 technical-debt satırı kaldırıldı |
| 2026-03-20 | T6 wording tightened | Kritik roadmap maddeleri çoğunlukla migrate edildi; T6 = kalan doğrulama / düşük öncelik |
| 2026-03-21 | T6 Finance Fix Roadmap tamamlandı | Technical-debt tablosundan çıkarıldı; `finance-fix-roadmap.md` kapsamı kapatıldı |
