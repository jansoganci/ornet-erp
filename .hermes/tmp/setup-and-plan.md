You are a senior Remotion engineer and video producer. Your task: create the foundation for a new Remotion showcase video project AND produce a detailed implementation plan.

## Step 1: Create the project

Initialize a new Remotion v4 project at `/Users/jans/Desktop/nexus/ornet-erp/video/`:

1. Create the directory structure:
```
video/
├── src/
│   ├── index.ts
│   ├── Root.tsx
│   ├── Composition.tsx
│   └── index.css
├── public/
├── out/
├── .hermes/tmp/
├── .gitignore
├── .prettierrc
├── remotion.config.ts
├── tsconfig.json
└── package.json
```

2. Write package.json with these dependencies:
```json
{
  "name": "ornet-erp-showcase",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "remotion studio",
    "render": "remotion render OrnetShowcase out/ornet-showcase.mp4",
    "build": "remotion bundle",
    "lint": "eslint src && tsc",
    "upgrade": "remotion upgrade"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.462",
    "@remotion/cli": "4.0.462",
    "@remotion/tailwind-v4": "4.0.462",
    "tailwindcss": "4.0.0",
    "@remotion/transitions": "^4.0.462",
    "@fontsource/inter": "^5.1.0"
  },
  "devDependencies": {
    "@remotion/eslint-config-flat": "4.0.462",
    "@types/react": "^18.3.12",
    "@types/web": "0.0.166",
    "eslint": "9.19.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3"
  }
}
```

3. Write a minimal tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "commonjs",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "lib": ["es2015"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true
  },
  "exclude": ["remotion.config.ts"]
}
```

4. Write remotion.config.ts:
```ts
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(enableTailwind);
```

5. Write src/index.ts:
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

6. Write .gitignore:
```
node_modules
dist
.DS_Store
.env
out
```

7. Write .prettierrc:
```json
{
  "useTabs": false,
  "bracketSpacing": true,
  "tabWidth": 2
}
```

## Step 2: Read reference skill and codebase

Read the remotion template skill: `/Users/jans/.hermes/skills/creative/remotion-showcase/SKILL.md`
Read the reference guardrail scene: `/Users/jans/.hermes/skills/creative/remotion-showcase/references/guardrail-3phase.md`

Then read the Ornet ERP codebase at `/Users/jans/Desktop/nexus/ornet-erp/` to understand:
- Brand identity (check tailwind.config, index.css, public/icon-*.svg)
- Key features (read src/App.jsx for routes, read a few feature files)
- The product README or CLAUDE.md

## Step 3: Write the plan

Create a detailed implementation plan at `/Users/jans/Desktop/nexus/ornet-erp/docs/remotion-showcase-plan.md`.

The plan must cover:

### A. Brand Identity (extracted from codebase)
- Primary color, secondary, success, danger, surface colors
- Typography
- Logo asset path

### B. Video Story Outline (8 scenes, ENGLISH)
For each scene:
- Scene number and title
- Duration in frames
- What it shows visually (UI mock, data, animation)
- Key headline text (one line)
- Emotional arc (what the viewer feels)

### C. Scene-by-Scene Implementation Plan
For each of the 8 scenes, specify:
- React component name
- Elements inside (SceneLabel, cards, tables, callouts, etc.)
- Animation timeline (which frame each element enters)
- CSS classes needed (new or adapted from MonthProof)
- dead air check: last animation end frame → suggested scene duration with 20f buffer

### D. Transition Map
Which transition type between each scene pair and why.

### E. Polish Checklist
- [ ] springTiming on all transitions
- [ ] Light leak overlays (which transitions)
- [ ] Audio transitions (which moments)
- [ ] Motion blur on fast elements
- [ ] Starburst on logo reveal
- [ ] Dead air audit (each scene calculated)
- [ ] CSS orchestrate class check

### F. File Generation Order
List every file that needs to be written, in dependency order:
1. Root.tsx, index.ts, index.css, tsconfig, etc.
2. Composition.tsx with TransitionSeries scaffold
3. Scene 1 (IntroScene)
4. Scene 2 (IngestScene)
5. ...through Scene 8

### G. Effort Estimate
Total estimated hours per phase.

## Constraints
- All file paths inside /Users/jans/Desktop/nexus/ornet-erp/video/
- Video is ENGLISH (not Turkish)
- 1920x1080, 30fps
- Colors must match Ornet branding (extracted from codebase)
- DO NOT render the video — only create project files and plan
- Run `npm install` after creating package.json

After creating all files, run `npx tsc --noEmit` to verify the TypeScript compiles (the Composition.tsx will be minimal but should compile).
