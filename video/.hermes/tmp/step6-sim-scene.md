Fill in the SimIntelligenceScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 5 section).

### Content
Shows SIM invoice analysis — PDF upload, inventory comparison, cost alerts.

1. SceneLabel: index="05" title="SIM invoices are checked against live inventory"
2. A PDF upload card on the left showing a document icon + "Turkcell Invoice.pdf" with a parsing progress bar
3. A comparison matrix in the center: two columns — "Invoice" vs "Inventory" — showing matched/unmatched rows
4. Alert chips for mismatches: "3 lines not in inventory", "2 lines cost increase"
5. A tariff chart on the right with 4 bars comparing plan prices

### Animation timeline
- Frame 8: PDF upload card drops in (translateY spring)
- Frame 30: parsing progress bar fills
- Frame 52: inventory comparison list appears
- Frame 74: comparison matrix draws (rows appear one by one)
- Frame 96: alert chips appear for mismatches (red pulses)
- Frame 112: tariff chart bars grow

### Visual style
- Upload card: document icon (Unicode 📄 or SVG), filename, progress bar
- Progress bar: red fill (#dc2626) on light bg
- Comparison matrix: two-column grid, left=invoice values, right=inventory values
- Matched rows: green check, unmatched: red X
- Alert chips: red-orange pills with count numbers
- Tariff chart: 4 vertical bars with labels

### CSS classes needed (add to index.css)

```css
.simScene {
  justify-content: center;
  align-items: center;
}

.uploadCard {
  position: absolute;
  left: 160px;
  top: 310px;
  width: 360px;
  padding: 24px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 64px rgba(28, 25, 23, 0.1);
}

.uploadIcon {
  font-size: 32px;
  margin-bottom: 12px;
}

.uploadCard strong {
  display: block;
  color: #1c1917;
  font-size: 16px;
  font-weight: 720;
  margin-bottom: 4px;
}

.uploadCard span {
  color: #78716c;
  font-size: 13px;
}

.progressTrack {
  margin-top: 16px;
  height: 6px;
  border-radius: 99px;
  background: #e7e5e4;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  border-radius: 99px;
  background: #dc2626;
}

.comparisonMatrix {
  position: absolute;
  left: 580px;
  top: 290px;
  width: 520px;
  padding: 20px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 72px rgba(28, 25, 23, 0.1);
}

.matrixHeader {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.5fr;
  padding: 0 12px 12px;
  color: #78716c;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid #e7e5e4;
}

.matrixRow {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.5fr;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid #e7e5e4;
  color: #1c1917;
  font-size: 14px;
  font-weight: 600;
}

.matrixRow:last-child { border-bottom: none; }

.matrixRow .matchCheck {
  font-size: 16px;
  font-weight: 800;
}

.matrixRow .matchCheck.match { color: #059669; }
.matrixRow .matchCheck.noMatch { color: #dc2626; }

.tariffChart {
  position: absolute;
  right: 160px;
  top: 320px;
  display: flex;
  align-items: flex-end;
  gap: 16px;
  height: 180px;
  padding: 20px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 24px 64px rgba(28, 25, 23, 0.1);
}

.tariffBar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.tariffBar i {
  width: 40px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, #dc2626, #fca5a5);
}

.tariffBar .barLabel {
  color: #78716c;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.alertChip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
}

.alertChip.warning {
  background: #fef3c7;
  color: #92400e;
}

.alertChip.error {
  background: #fef2f2;
  color: #991b1b;
}

.alertStack {
  position: absolute;
  left: 160px;
  bottom: 160px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

Run `npx tsc --noEmit` after changes to verify.
