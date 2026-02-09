# Design Language Refresh — What I Offer

You want to move away from the current standard (blue primary, slate grays, generic buttons) and get a **modern, clean, usable** look before the app gets more complicated. Here are **three concrete directions** you can choose from. Each is a full set of colors, typography, and shapes — not just a tweak.

---

## How we’ll do it (without breaking the app)

1. **Pick one direction** below (A, B, or C).
2. **Update design tokens** in `src/index.css` (colors, radius, shadows). One file.
3. **Update UI components** in `src/components/ui` (Button, Card, Input, Badge, etc.) to use the new tokens. Same props, new look.
4. **Optional:** One global tweak (e.g. font, base background) in `index.css`.

No new libraries, no redesign of flows — only a new visual language applied on top of what you have.

---

## Direction A — “Quiet & confident” (Linear / Notion style)

**Feel:** Calm, minimal, professional. Few colors, lots of space. Buttons don’t shout.

| What | Current | New (A) |
|------|---------|--------|
| **Primary** | Blue `#2563eb` | Muted indigo / violet `#6366f1` (softer) |
| **Background** | Cool gray `#f8fafc` | Slightly warm white `#fafafa` or pure `#ffffff` |
| **Surfaces / cards** | White, 1px border | Same white, **very light** border `#e5e5e5` or `#f0f0f0` |
| **Text** | Dark slate | Softer black `#171717` / neutral-800 |
| **Secondary text** | Gray-500 | Gray-500 but warmer `#737373` |
| **Buttons** | Solid fill, strong blue | Primary: subtle fill. Secondary: very light gray bg, no heavy border. Rounded **8–10px**. |
| **Radius** | 6px (buttons), 8px (cards) | **8px** buttons, **10–12px** cards |
| **Shadows** | Classic Tailwind | **Very soft** or none on cards; only modals/dropdowns get light shadow |

**Best for:** Feeling “product tool” rather than “corporate ERP.” Clean, not boring.

---

## Direction B — “Warm & clear” (Stripe / friendly SaaS)

**Feel:** Warm neutrals, one clear accent, friendly but still professional. Easy on the eyes.

| What | Current | New (B) |
|------|---------|--------|
| **Primary** | Blue `#2563eb` | Teal or soft green `#0d9488` (teal-600) or `#059669` (emerald-600) |
| **Background** | Cool gray | Warm gray `#fafaf9` (stone-50) |
| **Surfaces** | White | Off-white `#fafaf9` or white with **stone** borders `#e7e5e4` |
| **Text** | Slate-900 | Stone-900 `#1c1917` (slightly warm) |
| **Secondary text** | Gray-500 | Stone-500 `#78716c` |
| **Buttons** | Solid blue | Primary: teal/green fill. Others: stone-100 bg, stone-700 text. **Rounded 8px.** |
| **Radius** | 6–8px | **8px** default, **12px** cards |
| **Accent** | Blue everywhere | **One** accent (teal or emerald); success/warning/error stay green/amber/red but a bit softer |

**Best for:** “Modern app” that still feels approachable and not cold.

---

## Direction C — “Dark-first modern” (Vercel / Raycast style)

**Feel:** Dark by default, sharp, one bright accent. Very “app-like.”

| What | Current | New (C) |
|------|---------|--------|
| **Default theme** | Light | **Dark** as default (light as option) |
| **Background** | Light gray | Dark `#0a0a0a` or `#111111` |
| **Surfaces** | White cards | Dark gray `#171717` or `#1a1a1a`, **thin** border `#262626` |
| **Primary** | Blue | One bright accent: **cyan** `#22d3ee` or **green** `#4ade80` |
| **Text** | Dark | Light `#fafafa` / neutral-50 |
| **Secondary text** | Gray-500 | Neutral-400 `#a3a3a3` |
| **Buttons** | Solid blue | Primary: accent color on dark bg. Secondary: subtle border, transparent. **Rounded 6–8px.** |
| **Radius** | 6–8px | **6px** (sharper, more “UI app”) |
| **Shadows** | Classic | **Minimal** — depth with border/glow rather than big shadows |

**Best for:** If you and your users prefer dark mode and a “tool” aesthetic.

---

## Summary: pick one

| Direction | One line |
|-----------|----------|
| **A — Quiet & confident** | Muted indigo, lots of white/space, soft borders, 8–10px radius. |
| **B — Warm & clear** | Warm stone neutrals, teal or green accent, friendly, 8–12px radius. |
| **C — Dark-first modern** | Dark default, one bright accent (cyan/green), minimal shadows. |

---

## What I need from you

Reply with one of:

- **“A”** — we go Quiet & confident  
- **“B”** — we go Warm & clear  
- **“C”** — we go Dark-first modern  
- Or a **short mix**: e.g. “B but with blue instead of teal” or “A but a bit more rounded”

Then I will:

1. Propose the exact token set (hex values) for your choice.  
2. Update `src/index.css` with the new `@theme` (and optional base styles).  
3. Update `Button`, `Card`, `Input`, `Badge`, and any other shared UI components to use the new tokens so the whole app follows the new design language.

No new features, no complicated changes — just a design language you actually like: **modern, clean, usable, not complicated.**
