Fill in the IntroScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 1 section).

### Content
The IntroScene should show:
1. A SceneLabel with index="01" and title="One ERP for security operations, subscriptions, and finance"
2. A large headline: "Security operations,\nsubscriptions,\nand finance."
3. Three "proof pills" below the headline:
   - "Operations Hub" → connects field and office
   - "Revenue Engine" → subscriptions, proposals, collections
   - "SIM Intelligence" → invoice analysis, cost control
4. A small kicker text above the headline: "Built for security companies"

### Animation timeline
- Frame 0: background is already visible from parent
- Frame 8: kicker enters (opacity + translateY via enter())
- Frame 20: headline enters (opacity + translateY)
- Frame 38: proof pill 1 enters (enter(local, 38, 18))
- Frame 52: proof pill 2 enters (enter(local, 52, 18))
- Frame 66: proof pill 3 enters (enter(local, 66, 18))

### Visual style
- Use the same layout as MonthProof's IntroScene: AbsoluteFill with className="scene introScene"
- Headline font: 96-110px, weight 780-840, tight line-height
- Kicker: small uppercase, red (#dc2626) color
- Proof pills: white semi-transparent bg, border, rounded 10px
- Keep the grain/vignette from Background

### CSS classes needed (add to index.css)

```css
.introScene {
  justify-content: center;
  align-items: center;
}

.introStack {
  max-width: 980px;
  margin-top: 120px;
}

.kicker {
  margin: 0 0 24px;
  color: #dc2626;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.introScene h1 {
  margin: 0;
  color: #1c1917;
  font-size: 100px;
  line-height: 0.96;
  font-weight: 780;
}

.proofPills {
  display: flex;
  gap: 16px;
  margin-top: 48px;
}

.proofPill {
  padding: 14px 20px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 52px rgba(28, 25, 23, 0.08);
  color: #57534e;
  font-size: 18px;
  font-weight: 680;
}

.proofPill strong {
  color: #dc2626;
  font-weight: 800;
}
```

Append these CSS classes to `src/index.css`.

Do NOT modify any other scenes or existing CSS. Only change IntroScene and add CSS.

Run `npx tsc --noEmit` after changes to verify.
