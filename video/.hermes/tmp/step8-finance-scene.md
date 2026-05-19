Fill in the FinanceViewScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 7 section).

### Content
Shows the executive finance dashboard — income, expenses, profit breakdown.

1. SceneLabel: index="07" title="From operations to ledger-ready financial insight"
2. A finance dashboard frame (large card) with three KPI numbers at top:
   - "₺327,400" Total Income (green)
   - "₺189,200" Total Expenses (red)  
   - "₺138,200" Net Profit (green, bold)
3. A source breakdown with 4 small cards below: "Subscriptions", "Proposals", "Work Orders", "SIM Rental" each with amounts
4. A CSV export cue: "Download financial report" button

### Animation timeline
- Frame 6: dashboard shell enters (opacity + scale)
- Frame 28: overview totals count up (each KPI value interpolates from 0)
- Frame 48: source breakdown cards stagger in (each 8 frames apart)
- Frame 72: income vs expense comparison visually
- Frame 92: export cue fades in at bottom
- Frame 100: net profit highlight glows

### Visual style
- Dashboard frame: large white card, full-width feel
- KPI numbers: large, JetBrains Mono, tabular-nums
- Source cards: small grid cards with icon + label + amount
- Export cue: subtle button-style chip at bottom

### CSS classes needed (add to index.css)

```css
.financeViewScene {
  justify-content: center;
  align-items: center;
}

.dashboardFrame {
  width: 1120px;
  padding: 32px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 34px 90px rgba(28, 25, 23, 0.12);
}

.dashKPIRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding-bottom: 32px;
  border-bottom: 1px solid #e7e5e4;
}

.kpiBlock strong {
  display: block;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 36px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}

.kpiBlock .income { color: #059669; }
.kpiBlock .expense { color: #dc2626; }
.kpiBlock .profit { color: #059669; }

.kpiBlock span {
  display: block;
  margin-top: 6px;
  color: #78716c;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sourceGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 24px;
}

.sourceCard {
  padding: 18px;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fafaf9;
}

.sourceCard b {
  display: block;
  color: #1c1917;
  font-size: 13px;
  font-weight: 720;
  margin-bottom: 8px;
}

.sourceCard strong {
  display: block;
  color: #1c1917;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 18px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}

.sourceCard .sourceIcon {
  font-size: 20px;
  margin-bottom: 6px;
}

.exportCue {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding: 10px 20px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.06);
  color: #1e40af;
  font-size: 14px;
  font-weight: 700;
}
```

Run `npx tsc --noEmit` after changes to verify.
