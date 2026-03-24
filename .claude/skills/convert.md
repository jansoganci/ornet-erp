# Skill: /convert — UI Conversion

## Description
Converts external HTML/CSS/UI designs into Ornet ERP's stack: React 19 functional components, Tailwind CSS 4, dark mode, mobile-first, i18n, and existing UI components.

## Triggers
- User pastes raw HTML, CSS, or describes a UI from an external source (Dribbble, Figma export, template, etc.)
- User says "convert this", "make this match our stack", "adapt this UI"

## Inputs
- Pasted HTML/CSS or a description/screenshot of the target UI
- (Optional) Target feature module name
- (Optional) Target page or component name

## Workflow

### Step 1 — Analyze the input
- Identify all UI elements: headings, buttons, inputs, tables, cards, modals, badges, lists, charts, icons, navigation
- Identify layout structure: grid, flex, sidebar, header, footer
- Note any interactive behavior: dropdowns, tabs, accordions, search, filters, pagination

### Step 2 — Map to existing UI components
Before creating ANYTHING new, check if an existing component already handles it:

| External Element | Check These First |
|-----------------|-------------------|
| Buttons | `Button` (primary, secondary, outline, ghost, danger, success) |
| Icon buttons | `IconButton` |
| Text inputs | `Input` (with label, error, hint) |
| Textareas | `Textarea` |
| Dropdowns | `Select` |
| Searchable selects | `CustomerCombobox`, `MaterialCombobox`, `SimCardCombobox` |
| Dialogs/modals | `Modal` |
| Cards | `Card` |
| Status pills | `Badge` |
| Data tables | `Table` |
| Loading spinners | `Spinner` |
| Skeleton loaders | `Skeleton`, `CardSkeleton`, `TableSkeleton`, `FormSkeleton` |
| Empty states | `EmptyState` |
| Error states | `ErrorState` |
| Search bars | `SearchInput` |
| Date pickers | `DateRangeFilter` |
| KPI/metric cards | `KpiCard` |
| Chart tooltips | `ChartTooltip` |
| Unsaved warnings | `UnsavedChangesModal` |
| Page wrappers | `PageContainer` |
| Page titles | `PageHeader` |
| Spacing | `Stack` |

Only create a new component if NO existing component fits AND the element is reusable across features.

### Step 3 — Convert to Tailwind CSS 4
- Replace all CSS classes and inline styles with Tailwind utility classes
- Use `clsx` + `tailwind-merge` via the project's `cn()` helper for conditional classes
- Apply mobile-first responsive design: base = mobile, then `sm:`, `md:`, `lg:`, `xl:`
- Add dark mode for EVERY visual property:
  - Background: `bg-white dark:bg-[#171717]` (surfaces), `bg-neutral-50 dark:bg-[#0a0a0a]` (app bg)
  - Border: `border-neutral-200 dark:border-[#262626]`
  - Text: `text-neutral-900 dark:text-neutral-50` (primary), `text-neutral-500 dark:text-neutral-400` (secondary)
- Never create CSS files. Never use inline styles. Tailwind only.

### Step 4 — Add i18n
- Every visible string must use `useTranslation('namespace')`
- Identify the correct namespace from the 23 existing ones, or propose a new one
- Structure translation keys hierarchically: `section.element` (e.g., `list.title`, `form.labels.name`)
- Never hardcode Turkish strings

### Step 5 — Wire icons
- Replace any external icon library references with `lucide-react` equivalents
- Import only needed icons: `import { IconName } from 'lucide-react'`

### Step 6 — Output the converted component
- Functional component with hooks
- Proper imports from `@/components/ui/`, `@/components/layout/`
- Loading, error, and empty states handled
- Mobile-first responsive layout
- Full dark mode support
- All text through i18n

### Step 7 — Ask ONE clarifying question
If something is ambiguous (e.g., which feature module this belongs to, what data source to use), ask exactly ONE question — the most important one. Do not ask multiple questions.

## Output Format
```
## Conversion Summary
- **Elements mapped**: [list of external elements → existing components]
- **New components needed**: [list, or "None"]
- **i18n namespace**: [namespace name]
- **Responsive breakpoints used**: [list]

## Converted Code
[The JSX component code]

## Translation Keys
[JSON for the translation file, if new keys are needed]
```

## Rules
- NEVER create a new UI component if an existing one works
- NEVER use inline styles or CSS files
- NEVER hardcode Turkish text
- ALWAYS include dark mode variants
- ALWAYS make it mobile-first
- ALWAYS use existing project patterns (api.js, hooks.js, etc.) if the conversion involves data
