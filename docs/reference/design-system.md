# Ornet ERP Design System

> Complete design specification for UI component development.
> This document is the single source of truth for all visual decisions.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Border & Shadow](#5-border--shadow)
6. [Component Inventory](#6-component-inventory)
7. [Component Specifications](#7-component-specifications)
8. [Folder Structure](#8-folder-structure)
9. [Tailwind Configuration](#9-tailwind-configuration)
10. [Usage Examples](#10-usage-examples)

---

## 1. Design Principles

### Core Values
1. **Mobile-First**: Field workers use phones; design for touch, then scale up
2. **Clarity**: Non-tech users; big touch targets, clear labels, obvious actions
3. **Speed**: Fast load, instant feedback, minimal steps
4. **Turkish-Ready**: Full Turkish character support (ş, ğ, ü, ö, ç, ı, İ)

### Design Rules
- Minimum touch target: 44x44px (mobile)
- Maximum content width: 1280px (desktop)
- Always show loading states
- Always provide feedback on actions
- Use icons + text for critical actions (not icons alone)
- Left-align text (Turkish reads left-to-right)

---

## 2. Color System

**Design Language:** Warm & Clear with Red Accent (Professional Security SaaS)

### Primary Palette (Red - Brand, Security, Trust)

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `primary-50` | `#fef2f2` | `bg-primary-50` | Hover backgrounds |
| `primary-100` | `#fee2e2` | `bg-primary-100` | Selected states, badges |
| `primary-200` | `#fecaca` | `bg-primary-200` | Focus rings |
| `primary-300` | `#fca5a5` | `bg-primary-300` | - |
| `primary-400` | `#f87171` | `bg-primary-400` | - |
| `primary-500` | `#ef4444` | `bg-primary-500` | Links, secondary buttons |
| `primary-600` | `#dc2626` | `bg-primary-600` | **Primary buttons** |
| `primary-700` | `#b91c1c` | `bg-primary-700` | Button hover |
| `primary-800` | `#991b1b` | `bg-primary-800` | Button active |
| `primary-900` | `#7f1d1d` | `bg-primary-900` | - |
| `primary-950` | `#450a0a` | `bg-primary-950` | - |

### Neutral Palette (Warm Stone - Clean, Modern, Approachable)

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `neutral-50` | `#fafaf9` | `bg-neutral-50` | Page background (light) |
| `neutral-100` | `#f5f5f4` | `bg-neutral-100` | Card hover, table stripes |
| `neutral-200` | `#e7e5e4` | `bg-neutral-200` | **Borders**, dividers (light) |
| `neutral-300` | `#d6d3d1` | `bg-neutral-300` | Disabled borders |
| `neutral-400` | `#a8a29e` | `bg-neutral-400` | Placeholder text |
| `neutral-500` | `#78716c` | `bg-neutral-500` | **Secondary text**, icons |
| `neutral-600` | `#57534e` | `bg-neutral-600` | Labels |
| `neutral-700` | `#44403c` | `bg-neutral-700` | - |
| `neutral-800` | `#292524` | `bg-neutral-800` | - |
| `neutral-900` | `#1c1917` | `bg-neutral-900` | **Primary text** (light) |
| `neutral-950` | `#0c0a09` | `bg-neutral-950` | - |

**Dark Mode:**
- Background: `#0a0a0a` (almost black, softer than pure black)
- Surface (cards/inputs): `#171717` (dark gray for depth)
- Borders: `#262626` (subtle but visible)
- Text: `#fafafa` (light) / `#a3a3a3` (secondary)

### Semantic Colors

| Category | Token | Hex | Tailwind | Usage |
|----------|-------|-----|----------|-------|
| **Success** | `success-50` | `#ecfdf5` | `bg-success-50` | Success background |
| | `success-500` | `#10b981` | `text-success-500` | Success text |
| | `success-600` | `#059669` | `bg-success-600` | Success buttons (Emerald - softer than red) |
| | `success-700` | `#047857` | `bg-success-700` | Success hover |
| **Warning** | `warning-50` | `#fffbeb` | `bg-warning-50` | Warning background |
| | `warning-500` | `#f59e0b` | `text-warning-500` | Warning text |
| | `warning-600` | `#d97706` | `bg-warning-600` | Warning buttons |
| | `warning-700` | `#b45309` | `bg-warning-700` | Warning hover |
| **Error** | `error-50` | `#fef2f2` | `bg-error-50` | Error background |
| | `error-500` | `#ef4444` | `text-error-500` | Error text |
| | `error-600` | `#dc2626` | `bg-error-600` | Error/delete buttons |
| | `error-700` | `#b91c1c` | `bg-error-700` | Error hover |
| **Info** | `info-50` | `#eff6ff` | `bg-info-50` | Info background |
| | `info-500` | `#3b82f6` | `text-info-500` | Info text |

### Surface Colors

| Token | Hex (Light) | Hex (Dark) | Usage |
|-------|-------------|------------|-------|
| `surface` | `#ffffff` | `#171717` | Cards, modals, dropdowns |
| `surface-raised` | `#ffffff` | `#171717` | Elevated cards (with shadow) |
| `surface-overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.8)` | Modal backdrop |
| `background` | `#ffffff` | `#0a0a0a` | Page background |

### Status Badge Colors

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Pending | `warning-50` | `warning-700` | `warning-200` |
| Scheduled | `info-50` | `info-700` | `info-200` |
| In Progress | `primary-50` | `primary-700` | `primary-200` | (Red - brand color) |
| Completed | `success-50` | `success-700` | `success-200` |
| Cancelled | `neutral-100` | `neutral-600` | `neutral-300` |

### Priority Colors

| Priority | Color | Background |
|----------|-------|------------|
| Low | `neutral-500` | `neutral-100` |
| Normal | `primary-600` | `primary-50` |
| High | `warning-600` | `warning-50` |
| Urgent | `error-600` | `error-50` |

---

## 3. Typography

### Font Family

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, "Noto Sans", sans-serif,
             "Apple Color Emoji", "Segoe UI Emoji";
```

**Why Inter?**
- Excellent Turkish character support (ş, ğ, ü, ö, ç, ı, İ)
- Optimized for screens
- Free and open source
- Variable font (reduces file size)

### Font Sizes

| Token | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| `text-xs` | 12px / 0.75rem | 16px / 1rem | 0 | Badges, captions, timestamps |
| `text-sm` | 14px / 0.875rem | 20px / 1.25rem | 0 | Form labels, table cells, secondary text |
| `text-base` | 16px / 1rem | 24px / 1.5rem | 0 | **Body text**, inputs, buttons |
| `text-lg` | 18px / 1.125rem | 28px / 1.75rem | 0 | Card titles, subheadings |
| `text-xl` | 20px / 1.25rem | 28px / 1.75rem | -0.01em | Section headings |
| `text-2xl` | 24px / 1.5rem | 32px / 2rem | -0.02em | Page titles |
| `text-3xl` | 30px / 1.875rem | 36px / 2.25rem | -0.02em | Large headings |
| `text-4xl` | 36px / 2.25rem | 40px / 2.5rem | -0.02em | Hero headings |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `font-normal` | 400 | Body text, descriptions |
| `font-medium` | 500 | Labels, buttons, emphasis |
| `font-semibold` | 600 | Headings, card titles |
| `font-bold` | 700 | Strong emphasis, stats |

### Typography Scale

```
H1 (Page Title):     text-2xl font-semibold text-neutral-900
H2 (Section):        text-xl font-semibold text-neutral-900
H3 (Card Title):     text-lg font-semibold text-neutral-900
H4 (Subsection):     text-base font-semibold text-neutral-900
Body:                text-base font-normal text-neutral-900
Body Secondary:      text-sm font-normal text-neutral-500
Label:               text-sm font-medium text-neutral-700
Caption:             text-xs font-normal text-neutral-500
```

---

## 4. Spacing & Layout

### Spacing Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `space-0` | 0 | 0px | - |
| `space-0.5` | 0.125rem | 2px | Tiny gaps |
| `space-1` | 0.25rem | 4px | Icon-text gap |
| `space-1.5` | 0.375rem | 6px | Compact padding |
| `space-2` | 0.5rem | 8px | **Badge padding**, inline spacing |
| `space-2.5` | 0.625rem | 10px | - |
| `space-3` | 0.75rem | 12px | **Input padding**, small gaps |
| `space-4` | 1rem | 16px | **Card padding**, section gaps |
| `space-5` | 1.25rem | 20px | - |
| `space-6` | 1.5rem | 24px | **Large card padding**, group gaps |
| `space-8` | 2rem | 32px | Section spacing |
| `space-10` | 2.5rem | 40px | Major section breaks |
| `space-12` | 3rem | 48px | Page padding (mobile) |
| `space-16` | 4rem | 64px | Page padding (desktop) |

### Layout Breakpoints

| Breakpoint | Min Width | Target |
|------------|-----------|--------|
| `xs` (default) | 0px | Mobile phones |
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

### Container Widths

| Breakpoint | Max Width | Padding |
|------------|-----------|---------|
| Mobile | 100% | 16px (1rem) |
| `sm` | 640px | 24px (1.5rem) |
| `md` | 768px | 32px (2rem) |
| `lg` | 1024px | 32px (2rem) |
| `xl` | 1280px | 32px (2rem) |

### Grid System

```
Mobile:  1 column, gap-4
sm:      2 columns, gap-4
md:      2-3 columns, gap-6
lg:      3-4 columns, gap-6
xl:      4-6 columns, gap-8
```

### Stack (Vertical Spacing)

| Token | Gap | Usage |
|-------|-----|-------|
| `stack-xs` | 4px | Tight groups (label + input) |
| `stack-sm` | 8px | Form fields |
| `stack-md` | 16px | Card content sections |
| `stack-lg` | 24px | Page sections |
| `stack-xl` | 32px | Major page divisions |

---

## 5. Border & Shadow

### Border Radius

**Updated:** Increased default radius for modern, friendly feel (Warm & Clear design language)

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-none` | 0 | - |
| `rounded-sm` | 4px / 0.25rem | Badges, small elements |
| `rounded` | 8px / 0.5rem | **Buttons, inputs, cards** (updated from 6px) |
| `rounded-md` | 8px / 0.5rem | Alias for `rounded` |
| `rounded-lg` | 12px / 0.75rem | Modals, large cards |
| `rounded-xl` | 16px / 1rem | Feature cards |
| `rounded-full` | 9999px | Avatars, pills |

### Border Width

| Token | Value | Usage |
|-------|-------|-------|
| `border` | 1px | Default borders |
| `border-2` | 2px | Focus states, emphasis |

### Box Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat elements |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `shadow` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | **Cards** |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` | Dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` | **Modals** |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)` | Popovers |

### Focus Ring

```css
/* Default focus ring for interactive elements */
focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
```

---

## 6. Component Inventory

### Form Components

| Component | Variants | Sizes | Priority |
|-----------|----------|-------|----------|
| **Button** | primary, secondary, outline, ghost, danger | sm, md, lg | P0 |
| **IconButton** | primary, secondary, ghost | sm, md, lg | P0 |
| **Input** | default, error | sm, md, lg | P0 |
| **Textarea** | default, error | sm, md, lg | P1 |
| **Select** | default, error | sm, md, lg | P0 |
| **Checkbox** | default | sm, md | P1 |
| **Radio** | default | sm, md | P2 |
| **Switch** | default | sm, md | P2 |
| **DatePicker** | default | md | P1 |
| **TimePicker** | default | md | P2 |
| **SearchInput** | default | md, lg | P0 |

### Layout Components

| Component | Variants | Priority |
|-----------|----------|----------|
| **Card** | default, interactive, selected | P0 |
| **Container** | default | P0 |
| **Stack** | vertical, horizontal | P0 |
| **Grid** | auto, fixed columns | P1 |
| **Divider** | horizontal, vertical | P1 |

### Feedback Components

| Component | Variants | Priority |
|-----------|----------|----------|
| **Alert** | info, success, warning, error | P1 |
| **Toast** | info, success, warning, error | P1 |
| **Modal** | default, confirm, form | P0 |
| **Spinner** | default | P0 |
| **Skeleton** | text, card, table | P1 |
| **EmptyState** | default | P1 |

### Data Display Components

| Component | Variants | Priority |
|-----------|----------|----------|
| **Badge** | default, status, priority | P0 |
| **Avatar** | image, initials | P1 |
| **Table** | default, striped | P0 |
| **DataList** | default (label-value pairs) | P1 |
| **Stat** | default (dashboard numbers) | P1 |

### Navigation Components

| Component | Variants | Priority |
|-----------|----------|----------|
| **Header** | default | P0 |
| **Sidebar** | default | P2 |
| **Tabs** | default, pills | P1 |
| **Breadcrumb** | default | P2 |
| **Pagination** | default | P1 |

---

## 7. Component Specifications

### Button

```
Variants:
- primary:   bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 (Red - #dc2626)
- secondary: bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 (Warm stone)
- outline:   border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 (Red border, 2px)
- ghost:     text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200
- danger:    bg-error-600 text-white hover:bg-error-700 active:bg-error-800 (Same as primary red)

Sizes:
- sm: h-8 px-3 text-sm rounded-lg gap-1.5
- md: h-10 px-4 text-base rounded-lg gap-2
- lg: h-12 px-6 text-lg rounded-lg gap-2

States:
- default:  [as per variant]
- hover:    [darker background or subtle background]
- active:   [even darker]
- disabled: opacity-50 cursor-not-allowed
- loading:  [spinner icon, text slightly faded]

Structure:
<button class="inline-flex items-center justify-center font-medium rounded-lg transition-colors
               focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2
               disabled:opacity-50 disabled:cursor-not-allowed">
  {icon && <Icon />}
  {children}
</button>

Props:
- variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
- size: 'sm' | 'md' | 'lg'
- disabled: boolean
- loading: boolean
- leftIcon: ReactNode
- rightIcon: ReactNode
- fullWidth: boolean
- type: 'button' | 'submit' | 'reset'
```

### Input

```
Variants:
- default: border-neutral-300 dark:border-[#262626] focus:border-primary-600 focus:ring-primary-600/20
- error:   border-error-500 focus:border-error-500 focus:ring-error-500/20

Sizes:
- sm: h-8 px-3 text-sm
- md: h-10 px-3 text-base
- lg: h-12 px-4 text-lg

States:
- default:  bg-white border-neutral-300
- focus:    border-primary-500 ring-2 ring-primary-500/20
- error:    border-error-500 ring-2 ring-error-500/20
- disabled: bg-neutral-100 text-neutral-500 cursor-not-allowed

Structure:
<div class="flex flex-col gap-1.5">
  <label class="text-sm font-medium text-neutral-700">{label}</label>
  <input class="w-full rounded border transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-0" />
  {error && <p class="text-sm text-error-500">{error}</p>}
  {hint && <p class="text-sm text-neutral-500">{hint}</p>}
</div>

Props:
- label: string
- placeholder: string
- error: string
- hint: string
- disabled: boolean
- required: boolean
- leftIcon: ReactNode
- rightIcon: ReactNode
- size: 'sm' | 'md' | 'lg'
```

### Select

```
Same sizing/states as Input.

Structure:
<div class="flex flex-col gap-1.5">
  <label class="text-sm font-medium text-neutral-700">{label}</label>
  <div class="relative">
    <select class="w-full appearance-none rounded border pr-10
                   focus:outline-none focus:ring-2">
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    <ChevronDownIcon class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
  </div>
  {error && <p class="text-sm text-error-500">{error}</p>}
</div>

Props:
- label: string
- options: { value: string, label: string }[]
- placeholder: string
- error: string
- disabled: boolean
- required: boolean
- size: 'sm' | 'md' | 'lg'
```

### Card

```
Variants:
- default:     bg-white border border-neutral-200 rounded-md shadow-sm
- interactive: bg-white border border-neutral-200 rounded-md shadow-sm
               hover:border-neutral-300 hover:shadow cursor-pointer
- selected:    bg-primary-50 border-2 border-primary-500 rounded-md

Padding:
- p-4 (compact)
- p-6 (default)

Structure:
<div class="bg-white border border-neutral-200 rounded-md shadow-sm">
  {header && <div class="px-6 py-4 border-b border-neutral-200">{header}</div>}
  <div class="p-6">{children}</div>
  {footer && <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50">{footer}</div>}
</div>

Props:
- variant: 'default' | 'interactive' | 'selected'
- padding: 'compact' | 'default'
- header: ReactNode
- footer: ReactNode
- onClick: () => void (for interactive)
```

### Badge

```
Variants:
- default:  bg-neutral-100 text-neutral-700
- primary:  bg-primary-100 text-primary-700
- success:  bg-success-50 text-success-700
- warning:  bg-warning-50 text-warning-700
- error:    bg-error-50 text-error-700

Sizes:
- sm: px-2 py-0.5 text-xs
- md: px-2.5 py-0.5 text-sm

Structure:
<span class="inline-flex items-center rounded-full font-medium">
  {dot && <span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
  {children}
</span>

Props:
- variant: 'default' | 'primary' | 'success' | 'warning' | 'error'
- size: 'sm' | 'md'
- dot: boolean (show status dot)
```

### Modal

```
Structure:
<div class="fixed inset-0 z-50">
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/50" onClick={onClose} />

  <!-- Modal -->
  <div class="fixed inset-0 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button onClick={onClose}><XIcon /></button>
      </div>

      <!-- Body -->
      <div class="px-6 py-4">
        {children}
      </div>

      <!-- Footer -->
      {footer && (
        <div class="flex justify-end gap-3 px-6 py-4 border-t bg-neutral-50">
          {footer}
        </div>
      )}
    </div>
  </div>
</div>

Sizes:
- sm: max-w-sm
- md: max-w-md
- lg: max-w-lg
- xl: max-w-xl
- full: max-w-4xl

Props:
- open: boolean
- onClose: () => void
- title: string
- size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
- footer: ReactNode
```

### Alert

```
Variants:
- info:    bg-info-50 border-info-200 text-info-800
- success: bg-success-50 border-success-200 text-success-800
- warning: bg-warning-50 border-warning-200 text-warning-800
- error:   bg-error-50 border-error-200 text-error-800

Icons:
- info:    InformationCircleIcon (text-info-500)
- success: CheckCircleIcon (text-success-500)
- warning: ExclamationTriangleIcon (text-warning-500)
- error:   XCircleIcon (text-error-500)

Structure:
<div class="flex gap-3 p-4 rounded-md border">
  <Icon class="h-5 w-5 flex-shrink-0" />
  <div class="flex-1">
    {title && <p class="font-medium">{title}</p>}
    <p class="text-sm">{message}</p>
  </div>
  {dismissible && <button onClick={onDismiss}><XIcon /></button>}
</div>

Props:
- variant: 'info' | 'success' | 'warning' | 'error'
- title: string
- message: string
- dismissible: boolean
- onDismiss: () => void
```

### Table

```
Structure:
<div class="overflow-x-auto rounded-md border border-neutral-200">
  <table class="w-full">
    <thead class="bg-neutral-50 border-b border-neutral-200">
      <tr>
        <th class="px-4 py-3 text-left text-sm font-medium text-neutral-700">
          {column.header}
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-200">
      <tr class="hover:bg-neutral-50">
        <td class="px-4 py-3 text-sm text-neutral-900">
          {cell.value}
        </td>
      </tr>
    </tbody>
  </table>
</div>

Props:
- columns: { key: string, header: string, width?: string, align?: 'left' | 'center' | 'right' }[]
- data: Record<string, any>[]
- onRowClick: (row) => void
- loading: boolean
- emptyMessage: string
```

### Spinner

```
Sizes:
- sm: w-4 h-4
- md: w-6 h-6
- lg: w-8 h-8

Structure:
<svg class="animate-spin text-primary-600" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>

Props:
- size: 'sm' | 'md' | 'lg'
- color: string (tailwind text color)
```

### EmptyState

```
Structure:
<div class="flex flex-col items-center justify-center py-12 text-center">
  <div class="w-16 h-16 mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
    <Icon class="w-8 h-8 text-neutral-400" />
  </div>
  <h3 class="text-lg font-medium text-neutral-900 mb-1">{title}</h3>
  <p class="text-sm text-neutral-500 mb-4 max-w-sm">{description}</p>
  {action && <Button>{action.label}</Button>}
</div>

Props:
- icon: ReactNode
- title: string
- description: string
- action: { label: string, onClick: () => void }
```

### Skeleton

```
Variants:
- text:   h-4 rounded bg-neutral-200 animate-pulse
- circle: rounded-full bg-neutral-200 animate-pulse
- rect:   rounded-md bg-neutral-200 animate-pulse

Structure:
<div class="animate-pulse">
  <div class="h-4 w-3/4 rounded bg-neutral-200" />
</div>

Props:
- variant: 'text' | 'circle' | 'rect'
- width: string
- height: string
- lines: number (for text, creates multiple lines)
```

### SearchInput

```
Structure:
<div class="relative">
  <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
  <input
    type="search"
    class="w-full h-10 pl-10 pr-4 rounded-md border border-neutral-300
           focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
    placeholder="Ara..."
  />
  {value && (
    <button class="absolute right-3 top-1/2 -translate-y-1/2" onClick={onClear}>
      <XMarkIcon class="h-5 w-5 text-neutral-400" />
    </button>
  )}
</div>

Props:
- placeholder: string
- value: string
- onChange: (value: string) => void
- onClear: () => void
- debounce: number (ms)
```

---

## 8. Folder Structure

```
src/
├── components/
│   ├── ui/                      # Base design system components
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Select.jsx
│   │   ├── Textarea.jsx
│   │   ├── Checkbox.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── Modal.jsx
│   │   ├── Alert.jsx
│   │   ├── Toast.jsx
│   │   ├── Table.jsx
│   │   ├── Spinner.jsx
│   │   ├── Skeleton.jsx
│   │   ├── EmptyState.jsx
│   │   ├── SearchInput.jsx
│   │   ├── Avatar.jsx
│   │   ├── Tabs.jsx
│   │   ├── Pagination.jsx
│   │   └── index.js             # Re-export all components
│   │
│   └── layout/                  # Layout components
│       ├── Header.jsx
│       ├── Sidebar.jsx
│       ├── Container.jsx
│       ├── Stack.jsx
│       └── PageHeader.jsx
│
├── features/                    # Domain-specific features
│   ├── auth/
│   │   ├── LoginPage.jsx
│   │   └── hooks/
│   │       └── useAuth.js
│   │
│   ├── customers/
│   │   ├── CustomerListPage.jsx
│   │   ├── CustomerDetailPage.jsx
│   │   ├── components/
│   │   │   ├── CustomerCard.jsx
│   │   │   ├── CustomerForm.jsx
│   │   │   └── CustomerTable.jsx
│   │   └── hooks/
│   │       ├── useCustomers.js
│   │       └── useCustomer.js
│   │
│   ├── work-orders/
│   │   ├── WorkOrderListPage.jsx
│   │   ├── WorkOrderFormPage.jsx
│   │   ├── components/
│   │   │   ├── WorkOrderCard.jsx
│   │   │   ├── WorkOrderForm.jsx
│   │   │   └── WorkOrderStatusBadge.jsx
│   │   └── hooks/
│   │       ├── useWorkOrders.js
│   │       └── useWorkOrder.js
│   │
│   ├── tasks/
│   │   ├── TaskListPage.jsx
│   │   ├── components/
│   │   │   ├── TaskItem.jsx
│   │   │   └── TaskForm.jsx
│   │   └── hooks/
│   │       └── useTasks.js
│   │
│   └── dashboard/
│       ├── DashboardPage.jsx
│       ├── components/
│       │   ├── StatCard.jsx
│       │   ├── TodaySchedule.jsx
│       │   └── PendingTasksList.jsx
│       └── hooks/
│           └── useDashboardStats.js
│
├── hooks/                       # Global hooks
│   ├── useAuth.js
│   └── useMediaQuery.js
│
├── lib/                         # Utilities and configurations
│   ├── supabase.js
│   ├── i18n.js
│   ├── queryClient.js           # React Query client
│   ├── utils.js                 # cn() and other utilities
│   └── validations/             # Zod schemas
│       ├── customer.js
│       ├── workOrder.js
│       └── task.js
│
├── locales/
│   └── tr/
│       ├── common.json
│       ├── auth.json
│       ├── customers.json
│       ├── workOrders.json
│       ├── tasks.json
│       └── errors.json
│
├── styles/
│   └── globals.css              # Tailwind + design tokens
│
└── app/
    ├── App.jsx
    ├── AppLayout.jsx
    └── ProtectedRoute.jsx
```

---

## 9. Tailwind Configuration

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Neutral (using Slate)
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Success
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Warning
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Error
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Info (alias for primary)
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
```

### src/lib/utils.js

```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution
 * @param  {...any} inputs - Class names to merge
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

---

## 10. Usage Examples

### Button Usage

```jsx
import { Button } from '@/components/ui';

// Primary button
<Button>Kaydet</Button>

// Secondary button with icon
<Button variant="secondary" leftIcon={<PlusIcon />}>
  Müşteri Ekle
</Button>

// Danger button
<Button variant="danger" onClick={handleDelete}>
  Sil
</Button>

// Loading state
<Button loading>Kaydediliyor...</Button>

// Full width on mobile
<Button fullWidth className="md:w-auto">
  Giriş Yap
</Button>
```

### Input Usage

```jsx
import { Input } from '@/components/ui';

<Input
  label="Müşteri Adı"
  placeholder="Adı girin"
  required
  error={errors.name?.message}
/>

<Input
  label="Telefon"
  leftIcon={<PhoneIcon />}
  placeholder="0555 123 4567"
/>
```

### Card Usage

```jsx
import { Card, Badge } from '@/components/ui';

<Card>
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-semibold">Ahmet Yılmaz</h3>
      <p className="text-sm text-neutral-500">0555 123 4567</p>
    </div>
    <Badge variant="success">Aktif</Badge>
  </div>
</Card>

// Interactive card
<Card variant="interactive" onClick={() => navigate(`/customers/${id}`)}>
  {/* content */}
</Card>
```

### Modal Usage

```jsx
import { Modal, Button } from '@/components/ui';

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Müşteri Sil"
  footer={
    <>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        İptal
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Sil
      </Button>
    </>
  }
>
  <p>Bu müşteriyi silmek istediğinizden emin misiniz?</p>
</Modal>
```

### Table Usage

```jsx
import { Table, Badge } from '@/components/ui';

const columns = [
  { key: 'name', header: 'Müşteri' },
  { key: 'phone', header: 'Telefon' },
  { key: 'status', header: 'Durum', render: (value) => <Badge>{value}</Badge> },
];

<Table
  columns={columns}
  data={customers}
  onRowClick={(row) => navigate(`/customers/${row.id}`)}
  loading={isLoading}
  emptyMessage="Müşteri bulunamadı"
/>
```

---

## Appendix: Status & Priority Mappings

### Work Order Status → Badge

| Status | Turkish | Badge Variant |
|--------|---------|---------------|
| pending | Bekliyor | warning |
| scheduled | Planlandı | info |
| in_progress | Devam Ediyor | primary |
| completed | Tamamlandı | success |
| cancelled | İptal Edildi | default |

### Task Status → Badge

| Status | Turkish | Badge Variant |
|--------|---------|---------------|
| pending | Bekliyor | warning |
| in_progress | Devam Ediyor | primary |
| completed | Tamamlandı | success |
| cancelled | İptal Edildi | default |

### Priority → Color

| Priority | Turkish | Color |
|----------|---------|-------|
| low | Düşük | neutral |
| normal | Normal | primary |
| high | Yüksek | warning |
| urgent | Acil | error |

---

## Changelog

| Date | Change |
|------|--------|
| 2024-XX-XX | Initial design system created |

---

> **Note for Implementers:**
> This document is the source of truth for all design decisions.
> When in doubt, follow this document exactly.
> Do not introduce new colors, spacing values, or component variants without updating this document first.
