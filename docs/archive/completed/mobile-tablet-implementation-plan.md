# Mobile & Tablet Implementation Plan (Phase 3) 📱

This document outlines the technical implementation strategy for bringing Ornet ERP to a "premium" mobile and tablet experience.

---

## 1. Overview

### Current State
- Sidebar is hidden on mobile with no way to access profile/settings.
- Tables require horizontal scrolling, which is poor UX on touch devices.
- Modals are centered boxes that are hard to reach with thumbs.
- Interactive elements (buttons/links) often fall below the 44px touch target standard.

### Target State
- A fully functional **Mobile Drawer** for secondary navigation.
- **Responsive Tables** that automatically convert to card stacks on small screens.
- **Bottom Sheets** for mobile modals to improve ergonomics.
- Standardized **Touch Targets** and safe-area support for iOS/Android.

### Breakpoints
- **Mobile:** `< 768px` (Tailwind default) [x]
- **Tablet:** `768px - 1023px` (`md:` to `lg:`) [x]
- **Desktop:** `> 1024px` (`lg:`) [x]

---

## 2. Phase 3.1: Navigation & Layout (Critical) 🚩 [x]

### Task 1: Mobile Drawer Implementation [x]
- **What:** Transform the static Sidebar into a responsive drawer.
- **Why:** Access to profile, logout, and secondary links on mobile.
- **Where:** `src/components/layout/Sidebar.jsx`, `src/app/AppLayout.jsx`
- **How:**
    - Add `isOpen` and `onClose` props to `Sidebar`.
    - Use `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300` classes.
    - Add a backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden`.
    - **Tailwind:** `translate-x-0` (open) vs `-translate-x-full` (closed) on mobile. `md:translate-x-0` (always visible) on desktop.

### Task 2: Hamburger Menu in Header [x]
- **What:** Add a menu trigger to the mobile header.
- **Why:** To open the new Mobile Drawer.
- **Where:** `src/app/AppLayout.jsx`
- **How:**
    - Import `Menu` icon from `lucide-react`.
    - Add `IconButton` next to the app name in the mobile header.
    - **Tailwind:** `flex md:hidden` visibility.

### Task 3: Safe Area Padding (iOS) [x]
- **What:** Add support for modern mobile display notches and home indicators.
- **Why:** Prevents bottom nav from being clipped by the iOS home bar.
- **Where:** `src/app/AppLayout.jsx`, `src/components/layout/Sidebar.jsx`
- **How:**
    - Bottom Nav: Add `pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))]`.
    - Sidebar: Add `pb-[env(safe-area-inset-bottom)]`.

### Task 4: Touch Target Size Fixes [x]
- **What:** Ensure all interactive elements meet the 44x44px standard.
- **Where:** `src/components/ui/Button.jsx`, `src/components/ui/IconButton.jsx`
- **How:**
    - **Button:** Add `min-h-[44px]` for mobile (`md:min-h-0` to revert on desktop).
    - **IconButton:** Ensure `p-2` or `p-3` results in at least `w-11 h-11`.

---

## 3. Phase 3.2: Responsive Data (High Priority) 📊 [x]

### Task 1: Table to Card Stack Conversion [x]
- **What:** Hide the `<table>` element on mobile and show a vertical list of cards.
- **Why:** Horizontal scrolling on tables is difficult to read and interact with.
- **Where:** `src/components/ui/Table.jsx`
- **How:**
    - Wrap `<table>` in `hidden md:block`.
    - Create a mobile view: `grid grid-cols-1 gap-4 md:hidden`.
    - Map through `data` and render a `Card` for each row using the `columns` definition for labels.

### Task 2: Form Spacing Improvements [x]
- **What:** Increase vertical gap between inputs on mobile.
- **Why:** Prevents accidental taps on adjacent fields.
- **Where:** `src/features/customers/CustomerFormPage.jsx`, `src/features/workOrders/WorkOrderFormPage.jsx`
- **How:**
    - Update grid containers: `grid-cols-1 gap-y-8 md:grid-cols-2 md:gap-6`.

---

## 4. Phase 3.3: Form & Modal Polish (Medium) ✨ [x]

### Task 1: Modal to Bottom Sheet [x]
- **What:** Change modal positioning on mobile.
- **Why:** Easier to use with one hand (thumb reach).
- **Where:** `src/components/ui/Modal.jsx`
- **How:**
    - **Container:** `fixed inset-x-0 bottom-0 top-auto md:inset-0 md:flex md:items-center md:justify-center`.
    - **Panel:** `rounded-t-2xl rounded-b-none md:rounded-lg animate-slide-up md:animate-fade-in`.

### Task 2: Input Height Standardization [x]
- **What:** Ensure all form controls are touch-friendly.
- **Where:** `src/components/ui/Input.jsx`, `src/components/ui/Select.jsx`
- **How:**
    - Change default height from `h-10` to `h-12` on mobile (`md:h-10`).

---

## 5. Testing Checklist ✅

### Device Matrix
- [ ] **iPhone SE (375px):** Verify header doesn't wrap, bottom nav icons fit.
- [ ] **iPhone 14 Pro (393px):** Verify safe-area-inset-bottom padding.
- [ ] **iPad Mini (768px):** Verify sidebar switches from drawer to fixed.
- [ ] **iPad Pro (1024px):** Verify full desktop layout.

### Scenarios
1. **Navigation:** Open drawer -> Click link -> Drawer should close automatically.
2. **Data Entry:** Tap input -> Keyboard opens -> Ensure "Save" button isn't hidden behind keyboard (use `pb-24` on main).
3. **Table View:** View Work Orders on mobile -> Ensure status badges are visible without scrolling.

---

## 6. Time Estimates
- **Phase 3.1:** 2-3 hours
- **Phase 3.2:** 2 hours
- **Phase 3.3:** 1 hour
- **Total:** ~6 hours
