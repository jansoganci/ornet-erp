# Prompt: Calendar Screen — Research, Analysis & Smooth UX

**Use this prompt with Claude (or another AI) to get a structured research and design recommendation for the calendar screen. Copy the block below as-is.**

---

## Role recommendation

**Primary role:** Act as a **Senior UI/UX and Product Designer** with experience in B2B web apps and scheduling/calendar interfaces.

**Optional extension:** If you also want technical implementation angles (component structure, performance, accessibility), add the second sentence from the "Role" section below so the model can wear a **Product Designer + Front-end architecture** hat.

---

## Prompt (copy from here)

```
You are a Senior UI/UX and Product Designer with deep experience in B2B web applications, scheduling tools, and calendar interfaces. You focus on clarity, consistency, and smooth daily use—especially for field workers and office staff. Optionally, you can also consider front-end architecture and performance where it affects the calendar experience.

## Context

- **Product:** Ornet ERP — a work order and field service management system for a Turkish security company. Users: field technicians, office staff, accountants, admins.
- **Calendar page:** Dedicated route `/calendar`. It shows work orders on a weekly or monthly view (react-big-calendar). Features: view toggle (weekly/monthly), "New work order", "Today", previous/next navigation, filters (status, work type). Events are work orders; users can click a slot to create a work order at that time, click an event to see a detail modal, and drag-and-drop to reschedule.
- **Tech:** React 19, Vite, Tailwind CSS 4, react-big-calendar with drag-and-drop. Design system: red primary, warm stone neutrals, full dark mode. Mobile-first is a requirement.
- **Current pain:** The calendar screen feels rough and inconsistent: default library styling, weak dark mode support, flat hierarchy of controls, and no clear sense of "current week/month" at a glance.

## Your tasks

1. **Research & benchmarks (concise)**  
   From your knowledge of modern calendar UIs (e.g. Google Calendar, Calendly, Notion, Linear, Monday, field-service tools): what patterns make a calendar feel "smooth" and trustworthy? List 3–5 concrete patterns (e.g. visible current date range, clear primary action, subtle today highlight, empty state with one clear CTA).

2. **Gap analysis**  
   Against those patterns and against the description above, what is missing or weak on the current Ornet calendar? (e.g. no visible date range, all buttons same weight, dark mode inconsistent, empty state not guiding.)

3. **Recommendations — what to add and how to make it smooth**  
   Propose specific, actionable improvements, in order of impact:
   - **Visual & consistency:** e.g. custom CSS overrides so the calendar matches the app’s design system and dark mode; today column/cell highlight; event styling (radius, status colors).
   - **Hierarchy & controls:** e.g. single primary action (e.g. "New work order"); secondary "Today"; compact nav (e.g. prev/next or "< Week >"); visible date range label (e.g. "2–8 Feb 2026" or "February 2026").
   - **Context & empty state:** e.g. always-visible week/month label; empty state with one clear CTA and short copy.
   - **Smoothness:** e.g. loading skeleton for the grid; subtle feedback on slot click or event drag; optional small animations (e.g. event appearance) if they don’t hurt performance.
   - **Optional:** Any quick wins for mobile (touch targets, sticky toolbar, collapsible filters) or accessibility (focus, labels).

4. **Deliverable**  
   Give a short report (sections 1–4) that a developer can use to implement the calendar improvements step by step. No code required unless you want to suggest a single example (e.g. one CSS class or structure). Prioritize "what to do" and "why" over implementation detail.
```

---

## How to use

1. Copy the **entire block** between the triple backticks (from "You are a Senior UI/UX..." to "...over implementation detail.").
2. Paste it into a new Claude (or other AI) chat.
3. If your project has an existing analysis doc (e.g. `docs/calendar-ui-ux-analysis.md`), you can add one line:  
   `"Reference: we already have an analysis in docs/calendar-ui-ux-analysis.md; use it to avoid repeating the same points and instead build on it."`
4. Use the model’s reply as a **prioritized checklist** for design and implementation.

---

## Role summary (for your note)

| Role | When to use |
|------|-------------|
| **Senior UI/UX + Product Designer** | You want research, patterns, gap analysis, and concrete UX/UI recommendations (what to add, how to make it smooth). Best fit for this prompt. |
| **+ Front-end architecture** | Add the "Optionally, you can also consider front-end architecture..." sentence if you want notes on component structure, performance, or accessibility in the same answer. |
| **Pure architecture consultant** | Not recommended for this prompt; the main ask is smooth, user-friendly calendar experience, not system design. |
