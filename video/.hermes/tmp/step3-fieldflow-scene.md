Fill in the FieldFlowScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 2 section).

### Content
Shows how field work (work orders, customer records) flows into the central system.

1. SceneLabel: index="02" title="Field teams and office teams stay on the same record"
2. A "customer card" on the left showing a customer record with name, address, phone
3. A "work order card" below/next showing an open work order
4. A central "connector rail" that draws a line from work order → a "system record" panel on the right
5. The right panel shows the synced record with "status chips": Open → In Progress → Completed

### Animation timeline
- Frame 6: customer card slides in from left (enter with translateX)
- Frame 22: work order card follows
- Frame 38: daily checklist panel appears
- Frame 58: connector line draws between cards
- Frame 82: status chips update sequentially
- Frame 110: confirmation callout enters: "Field and office synced."

### Visual style
- Cards: white semi-transparent glass, rounded 14px, shadow
- Connector: thin line, red-to-blue gradient
- Status chips: small rounded pills, green for completed, amber for in-progress
- Use Inter for text, JetBrains Mono for IDs/order numbers

### CSS classes needed (add to index.css)

```css
.fieldFlowScene {
  justify-content: center;
  align-items: center;
}

.fieldFlowScene .dataCard {
  position: absolute;
  width: 340px;
  padding: 20px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 64px rgba(28, 25, 23, 0.1);
}

.fieldFlowScene .cardLabel {
  display: block;
  color: #78716c;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.fieldFlowScene .cardTitle {
  color: #1c1917;
  font-size: 20px;
  font-weight: 720;
  margin-bottom: 8px;
}

.fieldFlowScene .cardDetail {
  color: #57534e;
  font-size: 14px;
  line-height: 1.5;
}

.statusChip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.statusChip.open {
  background: #fef3c7;
  color: #92400e;
}

.statusChip.inProgress {
  background: #dbeafe;
  color: #1e40af;
}

.statusChip.completed {
  background: #d1fae5;
  color: #065f46;
}

.connectorRail {
  position: absolute;
  height: 2px;
  background: rgba(28, 25, 23, 0.12);
  transform-origin: left center;
}

.connectorRail i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #dc2626, #2563eb);
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.25);
}

.syncCallout {
  padding: 12px 20px;
  border: 1px solid rgba(5, 150, 105, 0.25);
  border-radius: 10px;
  background: #ecfdf5;
  color: #065f46;
  font-size: 16px;
  font-weight: 700;
}
```

Place cards at appropriate absolute positions (left side: ~160px, right side: ~1400px, cards staggered vertically).

Run `npx tsc --noEmit` after changes to verify.
