You are an expert video producer and Remotion engineer. Analyze the Ornet ERP project to prepare for creating a cinematic product showcase video.

## Context: Remotion Showcase Pattern

Read this skill file for the complete video template: `/Users/jans/.hermes/skills/creative/remotion-showcase/SKILL.md`

Key patterns you need to understand:
- 8-scene architecture with TransitionSeries
- Color token system (16 tokens to replace)
- Wordmark/logo component
- Scene types: Intro, Ingest, Orchestrate, Python/Narrative/Guardrail/Report/Close
- Spring-slide transitions with mixed types
- Typewriter text effect
- Dead air analysis (trim scene durations after last animation)
- Glass-morphism card design

## Project to Analyze

Codebase: `/Users/jans/Desktop/nexus/ornet-erp/`

This is a Turkish security company ERP system. Explore it thoroughly:

1. **Brand identity:**
   - Check Tailwind config (`tailwind.config.js` or CSS custom properties) for brand colors
   - Look for logo files (SVG/PNG in `public/`, `src/assets/`, etc.)
   - Check if there's a brand guide or design system

2. **Product features (what to highlight in the video):**
   - Read the README.md and any docs/ directory
   - Look at the navigation/routing to understand all features
   - Read src/features/ to understand key modules
   - Identify the 3-5 MOST impressive/unique features that would wow a viewer

3. **Tech stack visuals:**
   - What tech does it use? (React, Supabase, Tailwind, etc.)
   - Screenshots/previews available?
   - Any existing demo data or showcase material?

4. **Target audience:**
   - Who watches this video?
   - What problem does Ornet solve?

5. **Language:**
   - The UI is Turkish. Should the video be Turkish too?
   - Extract some key Turkish business terms that should appear

## Output

Produce a structured report:

### A. Brand Identity
- Primary color → hex
- Secondary color → hex
- Accent colors
- Logo description/file path
- Typography (Inter? another font?)

### B. Top 5 Features for Video
For each: name, one-sentence value proposition, visual elements that could appear on screen

### C. Proposed 8-Scene Video Structure
Map the MonthProof 8-scene structure to Ornet. For each scene:
- Scene title (Turkish)
- What it shows visually
- Key text/headline
- Estimated duration

### D. Feasibility Assessment
- What's easy to adapt from MonthProof?
- What needs custom work?
- Estimated effort (hours)
- Risks / unknowns

Be thorough. Read actual source files, not just directory listings.
