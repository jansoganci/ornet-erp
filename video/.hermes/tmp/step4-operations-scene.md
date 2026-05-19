Fill in the OperationsScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 3 section).

### Content
Shows the operations board — calendar, technician lanes, planned jobs.

1. SceneLabel: index="03" title="Plan the day before problems reach the customer"
2. A calendar/board frame on the left showing days of the week
3. Technician lane headers (3 names: "Ahmet K.", "Mehmet D.", "Ali R.")
4. Plan item cards staggered in each lane (small cards with job type text)
5. A "workload meter" for each lane (a small bar filling up)
6. An "import badge" in the corner showing "15 jobs planned → 3 dispatched"

### Animation timeline
- Frame 8: calendar board fades in
- Frame 28: technician lane headers enter
- Frame 46: plan item cards stagger in (each 8 frames apart)
- Frame 72: workload meters fill (width animates from 0 to target %)
- Frame 104: import badge lands (slides in from right)
- Frame 128: confirmation text: "Conflicts avoided — automatic dispatch"

### Visual style
- Calendar board: white card, grid layout, Mon-Sat columns
- Technician lanes: colored header (red-tinted for first, blue for second, amber for third)
- Plan cards: small pill-shaped items inside lanes
- Workload meter: thin bar, red-to-blue gradient fill
- Import badge: top-right pill shape with counter

### CSS classes needed (add to index.css)

```css
.operationsScene {
  justify-content: center;
  align-items: center;
}

.opsBoard {
  position: absolute;
  left: 160px;
  top: 300px;
  width: 720px;
  padding: 24px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 72px rgba(28, 25, 23, 0.1);
}

.opsBoardHeader {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  color: #78716c;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.opsDayHeaders {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.opsDayHeader {
  text-align: center;
  color: #78716c;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.techLane {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-top: 1px solid #e7e5e4;
}

.techLane:first-of-type { 
  border-top: none; 
}

.laneLabel {
  font-size: 14px;
  font-weight: 700;
  color: #1c1917;
}

.laneCards {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.planCard {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.planCard.install {
  background: #fef2f2;
  color: #991b1b;
}

.planCard.service {
  background: #eff6ff;
  color: #1e40af;
}

.planCard.maintenance {
  background: #fef3c7;
  color: #92400e;
}

.meterRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meterTrack {
  flex: 1;
  height: 6px;
  border-radius: 99px;
  background: #e7e5e4;
  overflow: hidden;
}

.meterFill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #dc2626, #2563eb);
}

.meterLabel {
  color: #78716c;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.importBadge {
  position: absolute;
  top: 160px;
  right: 160px;
  padding: 10px 18px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.08);
  color: #1e40af;
  font-size: 14px;
  font-weight: 700;
}

.opsCallout {
  position: absolute;
  bottom: 150px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border: 1px solid rgba(5, 150, 105, 0.2);
  border-radius: 10px;
  background: #ecfdf5;
  color: #065f46;
  font-size: 16px;
  font-weight: 700;
}
```

Run `npx tsc --noEmit` after changes to verify.
