# Layout System Specification

> Complete layout system specification for Ornet ERP.
> This document defines all layout components, patterns, breakpoints, and spacing standards.

**Status:** 📋 Planning → 🚧 Implementation Phase 1  
**Last Updated:** 2026-02-04

---

## Table of Contents

1. [Overview](#1-overview)
2. [Breakpoints](#2-breakpoints)
3. [Spacing System](#3-spacing-system)
4. [Core Layout Components](#4-core-layout-components)
5. [Layout Patterns](#5-layout-patterns)
6. [Current Inventory](#6-current-inventory)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Design Decisions](#8-design-decisions)
9. [File Structure](#9-file-structure)

---

## 1. Overview

### Purpose
Establish a consistent, responsive layout system that works seamlessly across:
- **Mobile** (< 480px - 768px)
- **Tablet** (768px - 1024px)
- **Desktop** (1024px - 1440px)
- **Large Desktop** (> 1440px)

### Design Principles
1. **Mobile-First:** Design for smallest screen, then scale up
2. **Consistency:** Standardized spacing, padding, and layout patterns
3. **Flexibility:** Reusable components that adapt to content
4. **Performance:** Minimal layout shifts, smooth transitions
5. **Accessibility:** Proper semantic HTML, keyboard navigation

---

## 2. Breakpoints

### Breakpoint Scale

| Breakpoint | Min Width | Max Width | Device Type | Usage |
|------------|-----------|-----------|-------------|-------|
| **xs** (default) | 0px | 480px | Small mobile | Base styles |
| **sm** | 480px | 768px | Mobile / Large phone | Mobile optimizations |
| **md** | 768px | 1024px | Tablet | Tablet layouts |
| **lg** | 1024px | 1440px | Desktop | Desktop layouts |
| **xl** | 1440px+ | - | Large desktop | Wide screen optimizations |

### Breakpoint Usage

**Tailwind CSS Classes:**
```css
/* Mobile first approach */
.class {
  /* Base (xs): 0px+ */
  property: value;
  
  /* sm: 480px+ */
  sm:property: sm-value;
  
  /* md: 768px+ */
  md:property: md-value;
  
  /* lg: 1024px+ */
  lg:property: lg-value;
  
  /* xl: 1440px+ */
  xl:property: xl-value;
}
```

**Common Patterns:**
- Sidebar: Hidden on mobile, drawer on tablet, persistent on desktop
- Bottom nav: Visible on mobile/tablet, hidden on desktop
- Grid columns: 1 (mobile) → 2 (tablet) → 3-4 (desktop) → 4-6 (large desktop)
- Page padding: 16px (mobile) → 24px (tablet) → 32px (desktop)

---

## 3. Spacing System

### Spacing Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `space-xs` | 0.25rem | 4px | Tight spacing, icon gaps |
| `space-sm` | 0.5rem | 8px | Small gaps, badge padding |
| `space-md` | 0.75rem | 12px | Medium gaps, form field spacing |
| `space-lg` | 1rem | 16px | Standard padding, section gaps |
| `space-xl` | 1.5rem | 24px | Large gaps, card spacing |
| `space-2xl` | 2rem | 32px | Page padding (desktop), major sections |
| `space-3xl` | 3rem | 48px | Large sections, hero spacing |
| `space-4xl` | 4rem | 64px | Maximum spacing, page breaks |

### Spacing Usage Guidelines

**Page Level:**
- Page padding: `xl` (24px) on tablet, `2xl` (32px) on desktop
- Mobile padding: `lg` (16px)

**Component Level:**
- Card padding: `lg` (16px) default, `xl` (24px) large
- Form field gaps: `md` (12px)
- Button gaps: `sm` (8px) for icon-text spacing

**Section Level:**
- Section gaps: `xl` (24px)
- Major section breaks: `2xl` (32px) or `3xl` (48px)

**CSS Variables:**
```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 0.75rem;   /* 12px */
--spacing-lg: 1rem;      /* 16px */
--spacing-xl: 1.5rem;    /* 24px */
--spacing-2xl: 2rem;     /* 32px */
--spacing-3xl: 3rem;     /* 48px */
--spacing-4xl: 4rem;     /* 64px */
```

---

## 4. Core Layout Components

### 4.1 AppLayout

**Purpose:** Main application shell with sidebar, header, and content area.

**Structure:**
```
AppLayout
├── Sidebar (collapsible on desktop, drawer on mobile/tablet)
├── Topbar (fixed, 64px height)
├── Main Content (flexible, adjusts for sidebar state)
└── Mobile Bottom Nav (fixed bottom, mobile/tablet only)
```

**Props:**
```typescript
interface AppLayoutProps {
  children: ReactNode;
}
```

**Behavior:**
- **Mobile (< 768px):**
  - Sidebar: Drawer (overlay, slides in from left)
  - Topbar: Fixed, 64px height
  - Bottom nav: Fixed bottom, 64px height
  - Main content: Full width, padding-bottom for bottom nav

- **Tablet (768px - 1024px):**
  - Sidebar: Drawer (overlay, slides in from left)
  - Topbar: Fixed, 64px height
  - Bottom nav: Optional (can hide if space allows)
  - Main content: Full width

- **Desktop (1024px+):**
  - Sidebar: Persistent, collapsible (280px expanded / 64px collapsed)
  - Topbar: Fixed, 64px height
  - Bottom nav: Hidden
  - Main content: Adjusts margin-left for sidebar width

**Sidebar States:**
- **Expanded:** 280px width, shows icons + labels
- **Collapsed:** 64px width, shows icons only
- **Drawer:** Overlay, 280px width, slides in/out

**File:** `src/app/AppLayout.jsx` (refactor existing)

---

### 4.2 PageHeader

**Purpose:** Standardized page header with title, breadcrumbs, actions, and optional tabs.

**Structure:**
```
PageHeader
├── Breadcrumbs (optional, top)
├── Title Row
│   ├── Title + Description (left)
│   └── Actions (right)
└── Tabs (optional, below title)
```

**Props:**
```typescript
interface PageHeaderProps {
  title: string;                    // Required
  description?: string;              // Subtitle below title
  breadcrumbs?: BreadcrumbItem[];   // Array of {label, to}
  actions?: ReactNode;              // Right-aligned buttons/actions
  tabs?: TabItem[];                 // Array of {id, label, onClick, isActive}
  className?: string;
}

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface TabItem {
  id: string;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}
```

**Layout:**
- **Mobile:** Stacked (title top, actions below)
- **Tablet+:** Horizontal (title left, actions right)
- **Tabs:** Full width below title row

**File:** `src/components/layout/PageHeader.jsx` (new)

---

### 4.3 PageContainer

**Purpose:** Consistent page wrapper with max-width, padding, and background options.

**Props:**
```typescript
interface PageContainerProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: boolean | 'none' | 'compact' | 'default' | 'large';
  background?: 'white' | 'transparent' | 'muted';
  className?: string;
  children: ReactNode;
}
```

**Max Width Options:**
- `sm`: 640px (narrow forms)
- `md`: 800px (forms, detail pages)
- `lg`: 1024px (medium content)
- `xl`: 1280px (lists, wide content) - **default**
- `full`: 100% (dashboard, full-width)

**Padding Options:**
- `none`: 0px
- `compact`: 16px (mobile), 24px (desktop)
- `default`: 16px (mobile), 32px (desktop) - **default**
- `large`: 24px (mobile), 48px (desktop)

**Background Options:**
- `white`: White background - **default**
- `transparent`: No background
- `muted`: Light gray background

**File:** `src/components/layout/PageContainer.jsx` (new)

---

## 5. Layout Patterns

### 5.1 DashboardGrid

**Purpose:** Auto-fit card grid for dashboard and card-based lists.

**Props:**
```typescript
interface DashboardGridProps {
  minCardWidth?: number;    // Default: 280px
  gap?: number;             // Default: 24px
  columns?: number;         // Optional, overrides auto-fit
  className?: string;
  children: ReactNode;
}
```

**CSS Grid Pattern:**
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
gap: 24px;
```

**Responsive Behavior:**
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3-4 columns (auto-fit based on minCardWidth)
- Large desktop: 4-6 columns

**File:** `src/components/layout/DashboardGrid.jsx` (new)

---

### 5.2 TwoColumnLayout

**Purpose:** Main content + sidebar pattern for detail pages.

**Props:**
```typescript
interface TwoColumnLayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
  sidebarWidth?: number;    // Default: 320px
  reverse?: boolean;        // Sidebar first on mobile
  gap?: number;             // Default: 24px
  className?: string;
}
```

**Layout:**
- **Desktop:** Main (2fr) + Sidebar (1fr)
- **Mobile:** Stacked (main first, sidebar below, unless `reverse={true}`)

**File:** `src/components/layout/TwoColumnLayout.jsx` (new)

---

### 5.3 ListLayout

**Purpose:** Standardized list page pattern with filters, content, and pagination.

**Props:**
```typescript
interface ListLayoutProps {
  header: ReactNode;        // PageHeader component
  filters?: ReactNode;      // Search, dropdowns, etc.
  content: ReactNode;       // Table, cards, etc.
  pagination?: ReactNode;   // Pagination component
  stickyHeader?: boolean;   // Default: true
  stickyFilters?: boolean;  // Default: true
  className?: string;
}
```

**Structure:**
```
ListLayout
├── Header (sticky on scroll)
├── Filters (sticky below header)
├── Content (scrollable)
└── Pagination (fixed bottom or inline)
```

**File:** `src/components/layout/ListLayout.jsx` (new)

---

## 6. Current Inventory

### Existing Components

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| **AppLayout** | `src/app/AppLayout.jsx` | ⚠️ Needs refactor | Has sidebar drawer, header, mobile bottom nav |
| **Sidebar** | `src/components/layout/Sidebar.jsx` | ✅ Good | 280px width, drawer on mobile, needs collapse on desktop |
| **Header** | `src/components/layout/Header.jsx` | ⚠️ Unused | Generic header, but AppLayout has inline header |
| **Container** | `src/components/layout/Container.jsx` | ✅ Good | Max-width, padding, centered options |
| **Stack** | `src/components/layout/Stack.jsx` | ✅ Good | Vertical/horizontal flex with spacing |

### Missing Components

1. **PageHeader** — Standardized page title + actions + breadcrumbs
2. **PageContainer** — Consistent page padding/max-width wrapper
3. **DashboardGrid** — Auto-fit card grid pattern
4. **TwoColumnLayout** — Main + sidebar pattern
5. **ListLayout** — Filter/search + content + pagination pattern

### Current Issues

- Header is inline in AppLayout (not reusable)
- No standardized page header pattern
- Pages manually add padding/spacing (inconsistent)
- Sidebar doesn't collapse on desktop (always 280px)
- No layout patterns for common page types

---

## 7. Implementation Roadmap

### Phase 1: Core Foundation ⏳ **CURRENT**

**Goal:** Establish foundation components for all pages.

**Tasks:**
1. ✅ **Refactor AppLayout**
   - Extract header to reusable component
   - Add sidebar collapse state (desktop)
   - Standardize breakpoints
   - Fix mobile drawer behavior
   - Update to use new breakpoints (sm: 480px)

2. ✅ **Create PageHeader component**
   - Title + breadcrumbs + actions
   - Responsive layout (stacked mobile, horizontal tablet+)
   - Optional tabs support

3. ✅ **Create PageContainer component**
   - Standard padding/max-width
   - Background options
   - Responsive padding (16px mobile, 32px desktop)

**Deliverables:**
- Refactored `AppLayout.jsx`
- New `PageHeader.jsx`
- New `PageContainer.jsx`
- Updated breakpoints in Tailwind config
- Updated spacing scale in CSS

**Testing:**
- Test on mobile (480px-768px)
- Test on tablet (768px-1024px)
- Test on desktop (1024px-1440px)
- Test on large desktop (>1440px)
- Verify sidebar collapse/expand
- Verify mobile drawer behavior

---

### Phase 2: Layout Patterns

**Goal:** Create reusable layout patterns for common page types.

**Tasks:**
4. **Create DashboardGrid component**
   - Auto-fit grid pattern
   - Responsive card sizing
   - Configurable minCardWidth and gap

5. **Create TwoColumnLayout component**
   - Main + sidebar pattern
   - Responsive stacking
   - Configurable sidebar width

6. **Create ListLayout component**
   - Filter/search + content + pagination
   - Sticky header/filters
   - Configurable sticky behavior

**Deliverables:**
- New `DashboardGrid.jsx`
- New `TwoColumnLayout.jsx`
- New `ListLayout.jsx`

---

### Phase 3: Refactor Existing Pages

**Goal:** Update existing pages to use new layout system.

**Tasks:**
7. **Update DashboardPage**
   - Use PageHeader + DashboardGrid
   - Standardize spacing
   - Remove manual layout code

8. **Update List pages (Customers, WorkOrders)**
   - Use PageHeader + ListLayout
   - Consistent filter/search pattern
   - Standardized pagination

9. **Update Detail pages**
   - Use PageHeader + PageContainer
   - Standardized layout
   - Consistent spacing

**Deliverables:**
- Refactored `DashboardPage.jsx`
- Refactored `CustomersListPage.jsx`
- Refactored `WorkOrdersListPage.jsx`
- Refactored detail pages

---

### Phase 4: Polish & Optimization

**Goal:** Add animations, optimize performance, finalize documentation.

**Tasks:**
10. **Add sidebar collapse animation**
    - Smooth transition (300ms)
    - Icon-only state styling

11. **Add page transition animations**
    - Fade-in on page load
    - Smooth scroll behavior

12. **Test on real devices**
    - Mobile devices (iOS, Android)
    - Tablets (iPad, Android tablets)
    - Desktop browsers

13. **Document layout patterns**
    - Usage examples
    - Best practices
    - Common patterns guide

**Deliverables:**
- Smooth animations
- Performance optimizations
- Complete documentation
- Device testing report

---

## 8. Design Decisions

### Sidebar Behavior

**Desktop (1024px+):**
- **Expanded:** 280px width, shows icons + labels
- **Collapsed:** 64px width, shows icons only
- **Toggle:** Button in topbar or sidebar footer
- **Animation:** 300ms smooth transition

**Tablet (768px-1024px):**
- **State:** Drawer (overlay)
- **Width:** 280px
- **Trigger:** Menu button in topbar
- **Backdrop:** Dark overlay with blur

**Mobile (< 768px):**
- **State:** Drawer (overlay)
- **Width:** 280px (or full width on very small screens)
- **Trigger:** Menu button in topbar
- **Backdrop:** Dark overlay with blur
- **Bottom nav:** Fixed bottom, 64px height, 3-5 primary actions

---

### Page Padding Standards

| Breakpoint | Padding | Usage |
|------------|---------|-------|
| Mobile (< 768px) | 16px | All pages |
| Tablet (768px-1024px) | 24px | All pages |
| Desktop (1024px+) | 32px | All pages |
| Large Desktop (>1440px) | 32px | All pages (can increase to 48px for hero sections) |

---

### Max-Width Standards

| Content Type | Max Width | Breakpoint |
|--------------|-----------|------------|
| Forms | 800px (md) | Desktop+ |
| Detail pages | 800px-1024px | Desktop+ |
| Lists | 1280px (xl) | Desktop+ |
| Dashboard | Full width | All |
| Modals | 500px-800px | All |

---

### Mobile Bottom Navigation

**Visibility:**
- **Mobile (< 768px):** Always visible
- **Tablet (768px-1024px):** Optional (can hide if space allows)
- **Desktop (1024px+):** Hidden

**Items:**
- Maximum 5 items
- Primary actions only (Dashboard, Customers, Work Orders, Tasks, Profile)
- Icon + label format
- Active state indicator

**Safe Area:**
- Respects `env(safe-area-inset-bottom)` for notched devices
- Padding-bottom: `calc(64px + env(safe-area-inset-bottom))`

---

## 9. File Structure

### Current Structure
```
src/
├── app/
│   └── AppLayout.jsx          (refactor)
├── components/
│   └── layout/
│       ├── Sidebar.jsx         (update: add collapse)
│       ├── Header.jsx          (unused, can remove or repurpose)
│       ├── Container.jsx      (keep as-is)
│       ├── Stack.jsx           (keep as-is)
│       └── index.js            (export all)
```

### Proposed Structure
```
src/
├── app/
│   └── AppLayout.jsx          (refactored)
├── components/
│   └── layout/
│       ├── AppLayout.jsx      (if extracted from app/)
│       ├── PageHeader.jsx      (new)
│       ├── PageContainer.jsx   (new)
│       ├── DashboardGrid.jsx  (new, Phase 2)
│       ├── TwoColumnLayout.jsx (new, Phase 2)
│       ├── ListLayout.jsx     (new, Phase 2)
│       ├── Sidebar.jsx         (updated)
│       ├── Container.jsx       (keep as-is)
│       ├── Stack.jsx           (keep as-is)
│       └── index.js            (export all)
```

---

## 10. Usage Examples

### PageHeader Example
```jsx
<PageHeader
  title="Müşteriler"
  description="Müşteri listesi ve yönetimi"
  breadcrumbs={[
    { label: 'Ana Sayfa', to: '/' },
    { label: 'Müşteriler' }
  ]}
  actions={
    <Button leftIcon={<Plus />}>
      Müşteri Ekle
    </Button>
  }
/>
```

### PageContainer Example
```jsx
<PageContainer maxWidth="xl" padding="default" background="white">
  {/* Page content */}
</PageContainer>
```

### DashboardGrid Example
```jsx
<DashboardGrid minCardWidth={280} gap={24}>
  <Card>Stat 1</Card>
  <Card>Stat 2</Card>
  <Card>Stat 3</Card>
</DashboardGrid>
```

### ListLayout Example
```jsx
<ListLayout
  header={<PageHeader title="İş Emirleri" actions={<Button>Yeni</Button>} />}
  filters={
    <div className="flex gap-4">
      <SearchInput />
      <Select options={statusOptions} />
    </div>
  }
  content={<Table data={workOrders} />}
  pagination={<Pagination />}
/>
```

---

## 11. Testing Checklist

### Phase 1 Testing

**AppLayout:**
- [ ] Sidebar collapses/expands on desktop
- [ ] Sidebar drawer opens/closes on mobile
- [ ] Topbar is fixed and 64px height
- [ ] Bottom nav appears only on mobile/tablet
- [ ] Main content adjusts for sidebar state
- [ ] Safe area insets work on notched devices

**PageHeader:**
- [ ] Title displays correctly
- [ ] Breadcrumbs work and navigate
- [ ] Actions align right on tablet+
- [ ] Actions stack below title on mobile
- [ ] Tabs display below title row
- [ ] Responsive layout works on all breakpoints

**PageContainer:**
- [ ] Max-width constraints work
- [ ] Padding is responsive (16px mobile, 32px desktop)
- [ ] Background options work
- [ ] Centered correctly

**Breakpoints:**
- [ ] sm (480px) breakpoint works
- [ ] md (768px) breakpoint works
- [ ] lg (1024px) breakpoint works
- [ ] xl (1440px) breakpoint works

**Spacing:**
- [ ] All spacing tokens (4, 8, 12, 16, 24, 32, 48, 64) available
- [ ] Spacing scale is consistent

---

## 12. Notes

### Breakpoint Updates
- Added `sm: 480px` breakpoint for better mobile/tablet distinction
- Updated all breakpoint references to new scale

### Spacing Updates
- Added `12px` (md) between `8px` (sm) and `16px` (lg)
- Complete scale: 4, 8, 12, 16, 24, 32, 48, 64

### Implementation Priority
- **Phase 1** is the foundation - must be completed and tested before moving to Phase 2
- Each phase will be tested before proceeding to next phase

---

**Next Steps:**
1. Implement Phase 1 components
2. Test on all breakpoints
3. Get approval before proceeding to Phase 2

---

*This document will be updated as implementation progresses.*
