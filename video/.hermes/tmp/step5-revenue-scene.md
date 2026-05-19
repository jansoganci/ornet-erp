Fill in the RevenueScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 4 section).

### Content
Shows recurring revenue management — MRR, collections, overdue payments.

1. SceneLabel: index="04" title="Recurring revenue, collections, and revisions in one flow"
2. A large MRR KPI card at top: "₺184,500" with label "Monthly Recurring Revenue"
3. A collection desk mini-table: 4 rows showing customer name, amount, status (paid/overdue/pending)
4. An overdue payment row that pulses red
5. A price revision card on the right side
6. A revenue sparkline at the bottom showing 6 months of data

### Animation timeline
- Frame 6: MRR KPI card enters (number counts up from 0 using interpolate)
- Frame 24: subscription card stack enters
- Frame 44: collection desk table slides in from left
- Frame 68: overdue row pulses red (interpolate loop)
- Frame 92: price revision card enters from right
- Frame 106: sparkline completes (bars grow)

### Visual style
- MRR KPI: large number, green accent, "Monthly Recurring Revenue" label below
- Collection table: striped rows, paid=green chip, overdue=red chip, pending=amber chip
- Overdue row: red border pulse animation
- Price revision card: blue accent, shows "₺1,200 → ₺1,400"
- Sparkline: 6 bars of growing height

### CSS classes needed (add to index.css)

```css
.revenueScene {
  justify-content: center;
  align-items: center;
}

.kpiHero {
  position: absolute;
  top: 275px;
  left: 160px;
  padding: 24px 32px;
  border: 1px solid rgba(5, 150, 105, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 72px rgba(28, 25, 23, 0.1);
}

.kpiHero strong {
  display: block;
  color: #059669;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 52px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}

.kpiHero span {
  display: block;
  margin-top: 8px;
  color: #78716c;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.collectionTable {
  position: absolute;
  right: 160px;
  top: 285px;
  width: 680px;
  padding: 20px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 28px 72px rgba(28, 25, 23, 0.1);
}

.collectionHeader {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.8fr;
  padding: 0 16px 12px;
  color: #78716c;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid #e7e5e4;
}

.collectionRow {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.8fr;
  align-items: center;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #e7e5e4;
  color: #1c1917;
  font-size: 15px;
  font-weight: 600;
}

.collectionRow:last-child {
  border-bottom: none;
}

.collectionRow .amount {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

.collectionChip {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.collectionChip.paid {
  background: #d1fae5;
  color: #065f46;
}

.collectionChip.overdue {
  background: #fef2f2;
  color: #991b1b;
}

.collectionChip.pending {
  background: #fef3c7;
  color: #92400e;
}

.overdueRow {
  border: 1px solid rgba(185, 28, 28, 0.3) !important;
  border-radius: 8px;
  background: #fef2f2;
  margin-top: 4px;
}

.revisionCard {
  position: absolute;
  right: 160px;
  bottom: 160px;
  padding: 18px 24px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.06);
  color: #1e40af;
  font-size: 15px;
  font-weight: 700;
}

.revisionCard b {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 18px;
}

.revSparkline {
  position: absolute;
  left: 160px;
  bottom: 155px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 80px;
}

.revSparkline i {
  width: 18px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #059669, #a7f3d0);
}
```

Run `npx tsc --noEmit` after changes to verify.
