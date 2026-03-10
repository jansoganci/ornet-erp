# UI/UX Audit & Improvement Plan 🎨

**Status:** Draft
**Auditor:** Senior UI/UX Builder
**Project:** Ornet ERP

---

## 1. Audit Findings Summary

### 🚩 Critical Issues (Blocks Usage / Accessibility)
- [x] **Keyboard Navigation:** Custom interactive elements (status toggles, cards) lack visible focus rings (`focus-visible`).
- [x] **Form Accessibility:** Some inputs lack proper `aria-describedby` links to error messages.
- [x] **Dead Ends:** Empty states in `Tasks` and `Work Orders` don't provide a direct "Create" action, forcing extra navigation.

### ⚠️ High Priority (UX Friction)
- [x] **Error Recovery:** Global/Section error states lack a "Retry" or "Refresh" mechanism.
- [x] **Visual Consistency:** Logout button radius (`rounded-xl`) differs from standard buttons (`rounded-md`).
- [ ] **Mobile Usability:** Sidebar transition on mobile feels abrupt; some tables lack clear horizontal scroll indicators.

### ✨ Polish (The "Airbnb" Standard)
- [x] **Loading Experience:** Replace generic spinners with `Skeleton` components for list views.
- [ ] **Micro-interactions:** Add subtle hover scales on interactive cards and smooth transitions for modal entries.
- [ ] **Form UX:** Implement auto-expanding textareas for notes and character counters for critical fields.

---

## 2. Proposed Improvements & Additions

### A. New Components to Build
1. **`Skeleton.jsx`**: A primitive for building loading states.
2. [x] **`EmptyState.jsx`**: A reusable component with icon, title, description, and action button.
3. **`Toast.jsx`**: (If missing) for non-blocking feedback after async actions (Save/Delete).

### B. Component Enhancements
- [x] **`Button.jsx`**: Ensure consistent `rounded` tokens and add `focus-visible` rings.
- [x] **`Input.jsx`**: Add support for "Success" states and better helper text positioning.
- [x] **`Card.jsx`**: Standardize padding tokens (`compact` vs `default`).

---

## 3. Implementation Roadmap

### Phase 1: Foundation & Accessibility (The "Steve Jobs" Clean-up)
- [x] **Standardize Design Tokens:** Sync all border-radius and spacing values across `Sidebar`, `Button`, and `Card`.
- [x] **Accessibility Audit Fixes:** Add focus states and ARIA labels to all interactive UI components.
- [x] **Reusable Empty State:** Create `src/components/ui/EmptyState.jsx` and implement it in Customers, Tasks, and Work Orders.

### Phase 2: Loading & Error States (The "Smooth" Experience)
- [x] **Skeleton Integration:** Create `Skeleton` component and apply to `CustomersListPage` and `TasksPage`.
- [x] **Error Boundaries:** Update section-level error states with "Retry" buttons and better illustrations.

### Phase 3: Micro-interactions & Mobile (The "Delight" Phase)
- [x] **Hover Effects:** Add `group-hover` animations to list items.
- [x] **Mobile Sidebar:** Refine the mobile drawer experience with better backdrop blur and transitions.
- [x] **Form Polish:** Add auto-resize to textareas and input masking for phone numbers.

---

## 4. Deliverables
1.  **`docs/ui-ux-audit.md`**: This document.
2.  **`src/components/ui/Skeleton.jsx`**: New component.
3.  **`src/components/ui/EmptyState.jsx`**: New component.
4.  **Updated UI Library**: Refined `Button`, `Input`, `Card`.
