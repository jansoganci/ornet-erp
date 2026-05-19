Write the full Composition.tsx scaffold for the Ornet ERP Remotion video at `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan first: `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md`
Read the remotion skill for patterns: `/Users/jans/.hermes/skills/creative/remotion-showcase/SKILL.md`

Then write the file with ALL of the following:

### 1. Imports
```tsx
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
```

### 2. sceneDurations object (from the plan)
```tsx
const sceneDurations = {
  intro: 120,
  fieldFlow: 155,
  operations: 165,
  revenue: 145,
  simIntelligence: 135,
  guardrail: 170,
  financeView: 120,
  close: 125,
};
```

### 3. TOTAL_FRAMES export
Same formula: sum of durations minus transitions × ~28f.

### 4. Helper functions
- `enter()` — fade in, cubic ease out
- `exit()` — fade out, cubic ease in
- `typewriter()` — char-by-char text reveal
- `px()` — number → string with "px"

### 5. Shared components

#### Background
Use Ornet colors: primary red (#dc2626) at 14% opacity for the first radial gradient, secondary blue (#2563eb) at 12% for the second. Keep the same grain + vignette pattern from MonthProof but adjust colors:
- background: `radial-gradient(circle at 18% 12%, rgba(220,38,38,0.14), transparent 26%), radial-gradient(circle at 84% 24%, rgba(37,99,235,0.12), transparent 25%), linear-gradient(135deg, #FAFAF8 0%, #F4F3F0 48%, #EFEDE8 100%)`
- Use `useVideoConfig().durationInFrames` for drift
- Use `#1c1917` for grain/vignette (matching Ornet's neutral-900)

#### TopBar
- Wordmark (Ornet logo: red rounded square with white "O" + "ERP" text)
- Meta label: "SECURITY OPERATIONS ERP"
- Fade: `[8, 34, TOTAL_FRAMES - 50, TOTAL_FRAMES]`

#### Wordmark
Redesigned for Ornet:
```
┌─────────────────┐  Ornet
│  O (logo mark)  │  ERP
└─────────────────┘
```
Mark: 42x42px, border-radius 10px, red bg (#dc2626), white "O" letter. Label: "Ornet ERP" in two lines or with "ERP" in smaller weight.

#### SceneLabel
Same as MonthProof pattern: `{ index: "01", title: "..." }` → absolute positioned top-left

#### ProgressRail
Same pattern: reads from `useVideoConfig().durationInFrames`, gradient uses red→blue→purple

### 6. MonthProofShowcase component with TransitionSeries

Use the 8 scenes from the plan:
1. IntroScene
2. FieldFlowScene
3. OperationsScene
4. RevenueScene
5. SimIntelligenceScene
6. GuardrailScene
7. FinanceViewScene
8. ClosingScene

Use the transition map from the plan:
- intro → fieldFlow: `slide({ direction: "from-bottom" })`
- fieldFlow → operations: `slide({ direction: "from-right" })`
- operations → revenue: `wipe()`
- revenue → simIntelligence: `slide({ direction: "from-right" })`
- simIntelligence → guardrail: `slide({ direction: "from-left" })` 
- guardrail → financeView: `wipe()`
- financeView → close: `fade()`

All with `springTiming({ config: { damping: 120 } })`

### 7. Scene stubs

For each of the 8 scenes, write a STUB component that:
- Accepts no props
- Uses `useCurrentFrame()`
- Returns `<AbsoluteFill className="scene <name>Scene">` with a SceneLabel

Example:
```tsx
const IntroScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  return (
    <AbsoluteFill className="scene introScene">
      <SceneLabel index="01" title="One ERP for security operations, subscriptions, and finance" />
    </AbsoluteFill>
  );
};
```

Do this for ALL 8 scenes. They will be filled in later steps.

After writing, run `npx tsc --noEmit` to verify it compiles.
