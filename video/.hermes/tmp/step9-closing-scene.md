Two tasks:

## Task 1: Fill in ClosingScene

Replace the ClosingScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 8 section).

### Content
1. Centered Ornet wordmark (same Wordmark component, larger)
2. Tagline: "Ornet ERP keeps security operations accountable."
3. Three final proof pillars below the tagline:
   - "Operations — Field and office unified"
   - "Revenue — Subscriptions and collections"
   - "Intelligence — SIM and invoice analysis"
4. A soft red glow effect behind the wordmark

### Animation timeline
- Frame 8: wordmark scales in (spring-based scale)
- Frame 26: tagline fades in (enter)
- Frame 48: pillar 1 enters
- Frame 60: pillar 2 enters
- Frame 72: pillar 3 enters
- Frame 90: glow settles

### CSS classes (add to index.css)
```css
.closingScene {
  text-align: center;
  justify-content: center;
  align-items: center;
}

.closingWordmark {
  display: flex;
  justify-content: center;
  margin-bottom: 48px;
}

.closingWordmark .wordmark {
  font-size: 34px;
}

.closingWordmark .wordmarkMark {
  width: 54px;
  height: 54px;
  font-size: 26px;
}

.closingScene h2 {
  max-width: 980px;
  margin: 0 auto;
  color: #1c1917;
  font-size: 72px;
  line-height: 1.02;
  font-weight: 840;
}

.closingPillars {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 40px;
}

.closingPillar {
  padding: 14px 22px;
  border: 1px solid rgba(28, 25, 23, 0.11);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 52px rgba(28, 25, 23, 0.08);
  color: #57534e;
  font-size: 16px;
  font-weight: 680;
  text-align: center;
}

.closingPillar strong {
  color: #dc2626;
  display: block;
  margin-bottom: 4px;
  font-weight: 800;
}

.redGlow {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(220, 38, 38, 0.1), transparent 70%);
  pointer-events: none;
}
```

## Task 2: Fix CSS group selectors

Find the CSS group selector in index.css that centers all scenes. It should look like:
```css
.introScene,
.fieldFlowScene,
.operationsScene,
.revenueScene,
.simScene,
.guardrailScene,
.financeViewScene,
.closingScene {
  align-items: center;
  justify-content: center;
}
```

If this group selector doesn't exist yet, CREATE it. All scene "className="scene <name>Scene"" modifiers must be in this group.

Run `npx tsc --noEmit` after changes.
