# Operations Module: 400 Error & Modal Input Crash Fix

**Date**: 2026-04-02  
**Status**: ✅ Fixed

---

## Issues Fixed

### 1. API 400 Error: PostgREST Foreign Key Ambiguity

**Symptom**: 
- Network error: `Failed to load resource: the server responded with a status of 400 (Bad Request)`
- URL: `operations_items?id=eq...&select=...`

**Root Cause**:
PostgREST requires explicit foreign key disambiguation when the relationship name differs from the table name. The `operations_items` table has a `created_by` column that references `profiles(id)`, but the query was using:

```javascript
profiles ( full_name )  // ❌ Ambiguous - which FK column?
```

**Fix**:
Changed to explicit foreign key notation in both `POOL_SELECT` and `ITEM_DETAIL_SELECT`:

```javascript
profiles!created_by ( full_name )  // ✅ Explicit FK column
```

**Files Changed**:
- `src/features/operations/api.js` (lines 22, 31)

---

### 2. Modal Input Crash: React Key Prop Causing Unmount

**Symptom**:
- Typing in the "Not" (notes) textarea of `CloseOutcomeModal` causes the modal to immediately close/unmount
- Input loses focus after first character

**Root Cause**:
The modal was using a dynamic `key` prop tied to the item ID:

```jsx
<CloseOutcomeModal
  key={closeOutcomeItemId ?? 'closed'}  // ❌ Destroys modal on re-render
  ...
/>
```

When the mutation completed, it triggered:
1. `queryClient.invalidateQueries({ queryKey: operationsItemKeys.lists() })`
2. List re-fetched
3. Parent component re-rendered
4. React saw the `key` change and destroyed the modal instance

**Fix Applied**:

1. **Removed dynamic `key` prop** from `RequestPoolTab.jsx`:
   ```jsx
   <CloseOutcomeModal
     open={closeOutcomeItemId != null}  // ✅ No key prop
     ...
   />
   ```

2. **Added `useEffect` reset** in `CloseOutcomeModal.jsx`:
   ```javascript
   useEffect(() => {
     if (open) {
       setOutcomeType('field_resolved');
       setNotes('');
     }
   }, [open]);
   ```

This ensures the form resets when the modal opens, without destroying the component instance.

**Files Changed**:
- `src/features/operations/components/RequestPoolTab.jsx` (line 123)
- `src/features/operations/components/CloseOutcomeModal.jsx` (lines 1, 17-23)

---

## Technical Lessons

### PostgREST Foreign Key Syntax
When a table has multiple foreign keys to the same target table, or when the FK column name differs from the table name, use explicit notation:

```javascript
// ❌ Ambiguous
profiles ( full_name )

// ✅ Explicit
profiles!created_by ( full_name )
profiles!updated_by ( full_name )
```

### React Key Prop Anti-Pattern
Never use a dynamic value as a `key` prop if that value can change while the component should remain mounted:

```jsx
// ❌ BAD: Modal unmounts when ID changes or parent re-renders
<Modal key={itemId} open={isOpen} />

// ✅ GOOD: Modal persists across re-renders
<Modal open={isOpen} />
```

Use `useEffect` with the `open` prop to reset internal state instead.

---

## Verification Steps

1. **Test API 400 Fix**:
   - Open Operations Board (`/operations`)
   - Verify the request pool loads without 400 errors
   - Check Network tab: `operations_items` request should return 200

2. **Test Modal Input Fix**:
   - Open Operations Board
   - Click "Kapat" (Close) on any request card
   - Select "Sahada Çözüldü" (Field Resolved)
   - Type multiple characters in the "Not" field
   - Verify modal stays open and input works normally

---

## Related Files

- `src/features/operations/api.js` - PostgREST query definitions
- `src/features/operations/hooks.js` - React Query hooks with invalidation
- `src/features/operations/components/RequestPoolTab.jsx` - Modal state management
- `src/features/operations/components/CloseOutcomeModal.jsx` - Modal component
- `supabase/migrations/00160_service_requests.sql` - Original table schema
- `supabase/migrations/00185_add_field_resolved_outcome.sql` - Outcome type constraint

---

## Migration Notes

No database migration required. This was a client-side query syntax and React lifecycle issue.
