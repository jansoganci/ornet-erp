# Mornet ERP Documentation

## Structure

### 📄 Root (Foundational / Timeless)
- `CODING-LESSONS.md` — Audit-derived coding rules
- `DESIGN_DECISIONS.md` — Dashboard UI/UX decisions
- `FATURA_FIELD_REFERENCE.md` — official_invoice field reference
- `README.md` — This file
- `TEST-SCENARIOS.md` — Pre-launch test coverage (permanent reference)

### 📂 active/
Ongoing roadmaps, incomplete to-dos, current specs.
- `MASTER_PENDING_TASKS.md` — **Single source of truth** for all pending work (Customer Situation, Equipment Lifecycle, Price Revision, Technical Debt, QA)

### 🗄️ archive/
Completed implementation plans, resolved audits, deprecated features.

**archive/completed/** — One-time audits, debug analyses, completed plans:
- `finance-audit-report.md` — Finance module audit (2026-03)
- `finance-fix-roadmap.md` — Finance fix plan (Phases 1–4 implemented)
- `SUBSCRIPTION_CALCULATION_AUDIT.md` — Subscription/SIM calculation audit
- `SUBSCRIPTIONS_ISSUES.md` — Subscriptions bugs & risks (all resolved)
- `RLS-AUDIT.md` — RLS security audit
- `DEBUG_CUSTOMER_IMPORT_SILENT_FAILURES.md` — Customer import debug
- `DEBUG_SUBSCRIPTION_IMPORT.md` — Subscription import debug
- `analysis-turkcell-cost-clarity.md` — Turkcell Cost Clarity repo analysis
- `payment-start-month-implementation-plan.md` — payment_start_month (implemented)
- `turkcell-invoice-analysis-*.md` — Turkcell invoice analysis (feature live)
- `action-board-plan.md` — Action Board (implemented)
- `customer-detail-subscriptions-optimization-plan.md` — CustomerDetailPage subscriptions optimization (implemented)
- `SIM_PROFIT_DISCREPANCY_ANALYSIS.md` — SIM profit diagnostic
- `sim-to-finance-phase1-implementation-plan.md` — Phase 1 trigger plan (implemented)
- `sim-to-finance-integration-analysis.md` — Integration analysis
- `sim-card-finance-integration-design.md` — Design research
- `subscription-sim-phone-tracking-research.md` — Subscription↔SIM link research
- `sim-card-system-redesign.md` — SIM revenue design (deferred)
- `sim-card-system-design.md` — SIM system technical design (TR)
- `tcmb-rates-deployment.md` — TCMB rates deployment guide
- `module_1.5_auto_revenue_plan.md` — Proposal + WO auto-revenue (implemented)

**archive/deprecated/** — Plans superseded by MASTER_PENDING_TASKS.md:
- `plan-customer-situation.md`, `equipment-lifecycle-plan.md`
- `price-revision-zam-message-plan.md`, `subscriptions-price-revision-analysis.md`
- `fiyat-artis-dostu-integration-analysis.md`, `subscriptions-multi-service-risk-analysis.md`
- `active-plans-consolidated.md`, `subscriptions-price-revision-alternatives.md`
- `MASTER_ROADMAP.md`

**Other (archive/completed):**
- `auth-implementation-plan.md` - Auth setup
- `design-language-proposal.md` - Initial design proposal
- `design-tokens.md` - Original token definitions
- `i18n.md` - Initial i18n setup
- `mobile-tablet-implementation-plan.md` - Responsiveness plan
- `requirements-and-schema-customers.md` - Customer module specs
- `subscription-implementation-plan.md` - Subscription build plan
- `tech-stack.md` - Project technology stack
- `work-order-system-implementation-plan.md` - Work order build plan
- `button-handlers-audit.md` - UI audit
- `calendar-implementation-audit.md` - Feature audit
- `cloudflare-pages-compatibility.md` - Hosting research
- `design-language-implementation.md` - Style rollout
- `DESIGN-TOKENS-UPDATE.md` - Migration notes
- `i18n-missing-translations-audit.md` - Translation audit
- `i18n-translation-audit.md` - Translation quality audit
- `phase-6-integration-audit.md` - Integration check
- `react-rendering-audit-report.md` - Performance audit
- `work-orders-edit-delete-fix.md` - Bug fix documentation

### 📚 reference/
Living reference documents (technical specs, business requirements).
- `design-system.md` - UI component specification
- `frontend-and-ops.md` - Operational & Supabase notes
- `pages-and-screens.md` - App screen inventory
- `layout-system.md` - Layout component specifications
- `guvenlik-sistemi-erp-crm-soru-cevaplar.md` - Business Q&A
- `ui-style-modernization-assessment.md` - Design decisions
- `calendar-ui-ux-research-prompt.md` - Research template

### 📄 Root & Module Folders
- `notification-system-concept.md` - Notification system requirements & concept (2026-02)
- `roadmap.md` - Project phases
- `progress.md` - Task log
- `sim-card-management-status.md` - SIM feature status + test results
- `layout-standards-compliance-audit.md` - Layout migration
- `ui-ux-audit.md` - UX improvements
- `subscriptions/` - Price revision, multi-service analysis (analysis only)
- `dashboard/`, `workOrders/`, etc. - Module overviews & wireframes

## Next Steps
- [ ] Create module-specific documentation folders
- [ ] Document each page/feature systematically
