Fill in the GuardrailScene stub in `/Users/jans/Desktop/nexus/ornet-erp/video/src/Composition.tsx`.

Read the plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md` (Scene 6 section).
Also read the guardrail reference: `/Users/jans/.hermes/skills/creative/remotion-showcase/references/guardrail-3phase.md`

### Content
3-phase guardrail showing financial verification: failure → retry → success.

1. SceneLabel: index="06" title="Every reported number is verified before it ships"
2. Phase 1 (frames 0-40): Show a failure — one ledger value with a mismatch. A red "MISMATCH" flash overlay.
3. Phase 2 (frames 44-80): "Retrying with reinforced prompt…" text fades in and out.
4. Phase 3 (frames 80-170): Five verified value pairs that check in one by one:
   - "₺184,500" → "₺184.5K" ✓
   - "₺42,300" → "₺42.3K" ✓
   - "₺12,800" → "₺12.8K" ✓
   - "+18.4%" → "18.4%" ✓
   - "₺8,200" → "₺8.2K" ✓
5. Counter badge: "0 / 5 numbers verified ✓" incrementing
6. Passed banner at the end: "Guardrail passed — Every reported number independently verified"

### Implementation
Use the exact same pattern as the MonthProof GuardrailScene:
- Conditional rendering: `{phase1 && ...}`, `{phase2 && ...}`, `{phase3 && ...}`
- Dark red #dc2626 for mismatch elements
- Green #059669 for success states
- Blue #2563eb for counter badge bg

### CSS classes needed
The SAME CSS classes from the guardrail reference but with Ornet colors:
- `.guardrailScene` — flex column, centered
- `.verifyList`, `.verifyListInner`, `.verifyingRow` — same grid pattern
- `.pandasVal`, `.arrow`, `.aiVal`, `.check` — same layout
- `.failFlash` — red overlay (#dc2626)
- `.retryText` — muted text
- `.counterBadge` — blue (#2563eb) tinted background
- `.passedBanner` — green (#059669) success banner
- `.mismatch` — red text

Copy the CSS from the guardrail reference but replace:
- `#16a066` → `#059669` (success green)
- `#b91c1c` → `#dc2626` (danger red)
- `#3c3a36` → `#57534e` (secondary text)
- `#252421` → `#1c1917` (primary text)
- `rgba(37,36,33,...)` → `rgba(28,25,23,...)` (shadows/borders)

The guardrail-3phase.md reference has the full component code — adapt it to use Ornet values.

Run `npx tsc --noEmit` after changes to verify.
