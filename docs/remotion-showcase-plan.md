# Ornet ERP Remotion Showcase Plan

## A. Brand Identity

Source files checked: `src/index.css`, `public/icon-512.svg`, `public/icon-192.svg`, `src/App.jsx`, `src/components/layout/navItems.js`, `README.md`, `CLAUDE.md`, and representative feature files in dashboard, finance, subscriptions, SIM invoice analysis, and operations.

| Token | Value | Source / use |
| --- | --- | --- |
| Primary color | `#dc2626` | Ornet brand red, `--color-primary-600`, logo background |
| Primary hover / dark | `#b91c1c` | `--color-primary-700`, errors, destructive emphasis |
| Secondary | `#2563eb` | `--color-info-600`, trust and technology accent |
| Success | `#059669` | `--color-success-600`, verified states |
| Danger | `#b91c1c` | `--color-error-700`, risk and mismatch states |
| Warning | `#d97706` | `--color-warning-600`, overdue and alert states |
| Surface | `#ffffff` and `#fafaf9` | App cards and warm neutral canvas |
| Surface dark | `#171717` and `#1c1917` | Dark cards and contrast panels |
| Text primary | `#1c1917` | `--color-neutral-900` |
| Text secondary | `#78716c` | `--color-neutral-500` |
| Border | `#e7e5e4` | `--color-neutral-200` |

Typography:

- App body font: `Inter`, with system fallbacks.
- Heading font token: `Space Grotesk`, with system fallbacks.
- Showcase implementation should import Inter weights 400, 500, 600, 700, and 800 from `@fontsource/inter`.
- Use a monospace stack only for operational counters, IDs, ledger amounts, and guardrail values.

Logo asset path:

- `public/icon-512.svg`
- Backup small app icon: `public/icon-192.svg`
- Logo shape: red rounded square, white `O`, translucent `ERP` label.

## B. Video Story Outline

Target format: 1920x1080, 30fps, English copy, cinematic product showcase.

| Scene | Title | Duration | Visual | Headline | Emotional arc |
| --- | --- | ---: | --- | --- | --- |
| 1 | Command Center Intro | 120f | Red Ornet logo reveal, warm grid canvas, three proof pills for operations, finance, SIMs | One ERP for security operations, subscriptions, and finance | Confidence: this is serious business software, not a toy dashboard |
| 2 | From Field Work to Office Flow | 155f | Work order cards, customer/site records, daily work checklist, status chips moving into a central operations lane | Field teams and office teams stay on the same record | Relief: messy field updates become visible and organized |
| 3 | Operations Board | 165f | Calendar lanes, planned jobs, technician workload cards, import pipeline | Plan the day before problems reach the customer | Control: dispatch and planning feel proactive |
| 4 | Revenue Engine | 145f | Subscription MRR card, collection desk, overdue payment list, price revision callout | Recurring revenue, collections, and revisions in one flow | Momentum: cash visibility is immediate |
| 5 | SIM Inventory Intelligence | 135f | PDF upload card, parse progress, SIM inventory comparison, tariff chart, alert chips | SIM invoices are checked against live inventory | Trust: hidden telecom cost drift gets exposed |
| 6 | Finance Ledger Guardrail | 170f | 3-phase failure, retry, success verification using ledger totals, VAT, COGS, SIM batch values | Every reported number is verified before it ships | Assurance: the system catches mismatches before users trust them |
| 7 | Executive Finance View | 120f | Finance dashboard with income, expenses, profit, source breakdown, CSV export cue | From operations to ledger-ready financial insight | Clarity: leadership sees the whole business picture |
| 8 | Close | 125f | Centered wordmark, red starburst, final product promise, subtle glow | Ornet ERP keeps security operations accountable | Conviction: the product feels dependable and complete |

## C. Scene-by-Scene Implementation Plan

### Scene 1: Command Center Intro

- Component name: `IntroScene`
- Elements inside: `Wordmark`, `SceneLabel`, oversized headline, three proof pills, soft radial security grid, logo starburst.
- Animation timeline:
  - Frame 0: background grain and vignette active.
  - Frame 8: logo mark scales in with `Starburst`.
  - Frame 20: headline enters.
  - Frame 42: proof pill 1 enters.
  - Frame 54: proof pill 2 enters.
  - Frame 66: proof pill 3 enters.
- CSS classes needed: `.scene`, `.introScene`, `.wordmark`, `.logoMark`, `.heroHeadline`, `.proofPills`, `.proofPill`, `.grain`, `.vignette`.
- Dead air check: last animation ends at frame 90. Suggested scene duration: 110f minimum, 120f final.

### Scene 2: From Field Work to Office Flow

- Component name: `FieldFlowScene`
- Elements inside: `SceneLabel`, floating work order cards, customer/site detail panel, daily checklist, status connector rail.
- Animation timeline:
  - Frame 6: first customer card slides from left.
  - Frame 22: work order card follows.
  - Frame 38: daily work checklist appears.
  - Frame 58: connector line draws into central record.
  - Frame 82: status chips update from `Open` to `Completed`.
  - Frame 110: office confirmation callout enters.
- CSS classes needed: `.fieldFlowScene`, `.dataCard`, `.statusChip`, `.connector`, `.recordPanel`, `.checklistRows`, `.callout`.
- Dead air check: last animation ends at frame 134. Suggested scene duration: 154f, final 155f.

### Scene 3: Operations Board

- Component name: `OperationsScene`
- Elements inside: `SceneLabel`, calendar grid, technician lanes, import badge, plan item cards, workload meters.
- Animation timeline:
  - Frame 8: calendar board fades and rises in.
  - Frame 28: technician lane headers enter.
  - Frame 46: plan item cards stagger in.
  - Frame 72: workload meter fills.
  - Frame 104: import badge lands.
  - Frame 128: "conflict avoided" callout enters.
- CSS classes needed: `.operationsScene`, `.calendarBoard`, `.laneHeader`, `.planCard`, `.meter`, `.importBadge`, `.riskCallout`.
- Dead air check: last animation ends at frame 148. Suggested scene duration: 168f, final 165f with tighter callout timing.

### Scene 4: Revenue Engine

- Component name: `RevenueScene`
- Elements inside: `SceneLabel`, MRR KPI, collection desk mini-table, overdue list, price revision card, revenue sparkline.
- Animation timeline:
  - Frame 6: MRR KPI counts up.
  - Frame 24: subscription card stack enters.
  - Frame 44: collection desk table slides in.
  - Frame 68: overdue payment row pulses red.
  - Frame 92: price revision callout enters.
  - Frame 106: sparkline completes.
- CSS classes needed: `.revenueScene`, `.kpiHero`, `.miniTable`, `.overdueRow`, `.revisionCard`, `.sparkline`, `.currencyValue`.
- Dead air check: last animation ends at frame 125. Suggested scene duration: 145f.

### Scene 5: SIM Inventory Intelligence

- Component name: `SimIntelligenceScene`
- Elements inside: `SceneLabel`, PDF upload zone, parse state machine, SIM inventory list, invoice comparison matrix, tariff chart.
- Animation timeline:
  - Frame 8: PDF upload card drops in.
  - Frame 30: parsing spinner and progress text enter.
  - Frame 52: inventory list appears.
  - Frame 74: comparison matrix draws.
  - Frame 96: alerts appear for mismatches.
  - Frame 112: tariff chart bars grow.
- CSS classes needed: `.simScene`, `.uploadCard`, `.parseStepper`, `.inventoryList`, `.comparisonMatrix`, `.alertChip`, `.tariffBars`.
- Dead air check: last animation ends at frame 115. Suggested scene duration: 135f.

### Scene 6: Finance Ledger Guardrail

- Component name: `GuardrailScene`
- Elements inside: `SceneLabel`, mismatch row, retry message, verified rows, counter badge, passed banner.
- Animation timeline:
  - Frame 0: failure phase starts.
  - Frame 12: red mismatch flash peaks.
  - Frame 40: retry phase starts.
  - Frame 80: success phase starts.
  - Frame 80-136: five ledger values verify in sequence.
  - Frame 145: passed banner enters.
- CSS classes needed: `.guardrailScene`, `.verifyList`, `.verifyListInner`, `.verifyingRow`, `.pandasVal`, `.aiVal`, `.mismatch`, `.failFlash`, `.retryText`, `.counterBadge`, `.passedBanner`.
- Dead air check: last animation ends at frame 165. Suggested scene duration: 170f.

### Scene 7: Executive Finance View

- Component name: `FinanceViewScene`
- Elements inside: `SceneLabel`, finance dashboard frame, revenue/expense chart, source breakdown cards, VAT/export cue.
- Animation timeline:
  - Frame 6: dashboard shell enters.
  - Frame 28: overview totals count up.
  - Frame 48: revenue and cost lines draw.
  - Frame 72: income source cards enter.
  - Frame 92: CSV export cue appears.
  - Frame 100: final net profit highlight glows.
- CSS classes needed: `.financeViewScene`, `.dashboardFrame`, `.chartPanel`, `.sourceGrid`, `.sourceCard`, `.exportCue`, `.profitGlow`.
- Dead air check: last animation ends at frame 100. Suggested scene duration: 120f.

### Scene 8: Close

- Component name: `ClosingScene`
- Elements inside: `ClosingWordmark`, centered tagline, three final product pillars, soft red glow.
- Animation timeline:
  - Frame 8: wordmark scales in.
  - Frame 26: tagline fades in.
  - Frame 48: pillar 1 enters.
  - Frame 60: pillar 2 enters.
  - Frame 72: pillar 3 enters.
  - Frame 90: glow settles.
- CSS classes needed: `.closingScene`, `.closingWordmark`, `.closingTagline`, `.closingPillars`, `.closingPillar`, `.redGlow`.
- Dead air check: last animation ends at frame 94. Suggested scene duration: 115f minimum, 125f final.

## D. Transition Map

| From | To | Transition | Why |
| --- | --- | --- | --- |
| Intro | Field Flow | `slide({ direction: "from-bottom" })` | Work and customer records rise into the command center story. |
| Field Flow | Operations | `slide({ direction: "from-right" })` | The story moves from records into planning and dispatch. |
| Operations | Revenue | `wipe()` | Revenue view should replace the operations board cleanly. |
| Revenue | SIM Intelligence | `slide({ direction: "from-right" })` | Keeps momentum as billing data flows into invoice analysis. |
| SIM Intelligence | Guardrail | `slide({ direction: "from-left" })` plus light leak | Creates a strong comparison moment before verification. |
| Guardrail | Finance View | `wipe()` | Verified data reveals the executive finance dashboard. |
| Finance View | Close | `fade()` | A calm ending after the information-dense dashboard. |

All transitions should use `springTiming()`, not linear timing. Suggested default: `springTiming({ config: { damping: 120 } })`; use the snappier config only for the intro and close.

## E. Polish Checklist

- [ ] `springTiming` on all transitions.
- [ ] Light leak overlays on Field Flow -> Operations and SIM Intelligence -> Guardrail.
- [ ] Audio transitions on every scene boundary with subtle whoosh or sweep cues.
- [ ] Motion blur on fast-moving cards in Field Flow and SIM Intelligence.
- [ ] Starburst on the intro logo reveal and closing wordmark.
- [ ] Dead air audit completed with last animation end frame for all 8 scenes.
- [ ] CSS orchestrate class check: every `className="scene <name>"` modifier is included in shared layout selectors.
- [ ] Top bar fade uses end-relative values, not stale source-frame indices.
- [ ] Guardrail phases use conditional rendering to avoid DOM stacking.
- [ ] Copy stays English even when UI source routes are Turkish.

## F. File Generation Order

1. `video/package.json`
2. `video/tsconfig.json`
3. `video/remotion.config.ts`
4. `video/.gitignore`
5. `video/.prettierrc`
6. `video/src/index.ts`
7. `video/src/Root.tsx`
8. `video/src/index.css`
9. `video/src/Composition.tsx` with `TransitionSeries` scaffold and shared helpers.
10. `video/src/Composition.tsx` shared components: `Background`, `TopBar`, `SceneLabel`, `Wordmark`, `Connector`.
11. Scene 1: `IntroScene`
12. Scene 2: `FieldFlowScene`
13. Scene 3: `OperationsScene`
14. Scene 4: `RevenueScene`
15. Scene 5: `SimIntelligenceScene`
16. Scene 6: `GuardrailScene`
17. Scene 7: `FinanceViewScene`
18. Scene 8: `ClosingScene`
19. Final CSS pass in `video/src/index.css`.
20. Type check with `npx tsc --noEmit`.
21. Preview in Remotion Studio only; do not render until explicitly requested.

## G. Effort Estimate

| Phase | Scope | Estimate |
| --- | --- | ---: |
| Scaffold and dependency setup | Project structure, package install, baseline TypeScript verification | 0.5h |
| Brand extraction and story design | Token mapping, feature selection, English copy, data narrative | 1.0h |
| Shared visual system | Background, top bar, wordmark, cards, tables, counters, connectors | 1.5h |
| Scene implementation | Eight scenes with local animation timelines | 5.0h |
| Transition and polish pass | TransitionSeries, spring timing, light leaks, SFX, motion blur, starburst | 1.5h |
| Dead air and QA pass | Frame audit, CSS class audit, type check, Remotion Studio visual review | 1.0h |
| Total | End-to-end implementation before render | 10.5h |
