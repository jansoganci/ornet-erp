# Skill: /refactor — Safe Code Restructuring

## Description
Safely restructures code — extracting components, splitting features, moving files, renaming — while verifying no coding rules are violated. Ensures no dead imports, no broken query keys, no lost i18n keys, and all cross-references updated.

## Triggers
- User says "refactor", "extract", "split", "move", "rename", "clean up"
- User asks to break a large file into smaller ones
- User asks to extract a shared component from feature-specific code
- User asks to reorganize a feature module

## Inputs
- **What to refactor**: file path, component name, or feature name
- **Goal**: what the end state should look like (e.g., "extract the payment grid into its own component")
- (Optional) Where the extracted code should live

## Workflow

### Step 1 — Read before touching

Read ALL files that will be affected:
- The file(s) being refactored
- All files that import from the refactored file(s)
- All files that the refactored code imports from

Build a dependency map before making any changes.

### Step 2 — Ask ONE clarifying question (if needed)
Priority order:
1. If destination unclear: "Should the extracted component go in `components/ui/` (shared) or `features/{feature}/components/` (feature-specific)?"
2. If scope unclear: "Should I refactor just this one component, or the entire feature module?"

### Step 3 — Plan the refactor

Map out every change needed:

```
## Refactor Plan

### Files to create
- src/features/{feature}/components/{NewComponent}.jsx

### Files to modify
- src/features/{feature}/{OriginalFile}.jsx — remove extracted code, add import
- src/features/{feature}/index.js — add new export

### Files to verify (import consumers)
- src/features/{feature}/{OtherPage}.jsx — uses the extracted component?
```

### Step 4 — Execute changes in safe order

1. **Create new files first** — extracted components, split modules
2. **Update imports in consuming files** — point to new locations
3. **Remove old code** — delete from the original file
4. **Update barrel exports** — index.js

Never delete before the replacement is in place.

### Step 5 — Verify all 18 rules still pass

After refactoring, check each applicable rule:

#### Import integrity (Rule 17 — Dead imports)
- [ ] No unused imports in ANY modified file
- [ ] No commented-out imports
- [ ] All new imports resolve to existing files
- [ ] No circular imports created

#### API layer (Rule 10, 16)
- [ ] `supabase` is still only imported in `api.js` files
- [ ] No page components import `supabase` directly
- [ ] No hooks.js files import `supabase` directly

#### Query keys (Rule 1)
- [ ] All query keys still reference the correct keys object
- [ ] No orphaned query key references
- [ ] Mutations still invalidate the correct scoped keys
- [ ] If hooks.js was split, keys object is exported from one canonical location

#### i18n keys (no hardcoded strings)
- [ ] No translation keys were lost during the move
- [ ] Components still use the correct namespace
- [ ] No hardcoded Turkish strings introduced

#### Form wiring (Rule 7, 9)
- [ ] `handleSubmit` is still on form OR button, not both
- [ ] `setValue` calls are preserved for external field updates
- [ ] Zod schema imports are correct

#### State handling
- [ ] Loading, error, empty states still handled in all pages
- [ ] No state was lost during extraction

#### Dark mode
- [ ] Extracted components preserve all `dark:` variants
- [ ] No light-only styles in the extracted code

#### File extensions
- [ ] `.jsx` for files with JSX, `.js` for pure JS
- [ ] Barrel exports (index.js) contain no JSX

### Step 6 — Check cross-module references

If the refactored code is used by other feature modules:
- [ ] All cross-module imports updated
- [ ] No broken import paths
- [ ] Barrel exports include the moved/renamed items

### Step 7 — Verify route and nav references

If page components were renamed or moved:
- [ ] Route in `src/App.jsx` updated to import from new location
- [ ] Nav item in `navItems.js` still works (if applicable)

## Common Refactor Patterns

### Extract component from a page
```
Before: FeaturePage.jsx (500 lines with inline DataTable)
After:  FeaturePage.jsx (200 lines) + components/FeatureTable.jsx (300 lines)
```

Steps:
1. Create `components/FeatureTable.jsx` with the extracted JSX
2. Identify which props the extracted component needs (data, handlers, t)
3. Pass `t` function or use `useTranslation` in the new component
4. Import and render `<FeatureTable>` in the parent page
5. Remove extracted code from parent

### Split a large api.js
```
Before: api.js (30 functions covering 3 sub-domains)
After:  api.js (10 core), paymentsApi.js (10), reportsApi.js (10)
```

Steps:
1. Create new API files with the split functions
2. Move the `supabase` import to each new file
3. Update `hooks.js` imports to point to the correct API file
4. Update `index.js` to re-export from all API files
5. Verify no consumers import from the old location

### Move shared component to components/ui/
```
Before: features/subscriptions/components/StatusBadge.jsx (used by 3 features)
After:  components/ui/StatusBadge.jsx
```

Steps:
1. Move file to `components/ui/`
2. Update all imports across features (grep for old path)
3. Remove from feature's barrel exports
4. Add to UI barrel exports if one exists

### Rename a feature module
This is HIGH RISK — touch with care:
1. Rename folder
2. Update ALL imports across the entire codebase (grep for old path)
3. Update route in App.jsx
4. Update nav item in navItems.js
5. Update i18n namespace name (if changed)
6. Update query keys (if they used the old name)

## Output Format
```
## Refactor: {description}

### Changes Made
- **Created**: [list of new files]
- **Modified**: [list of modified files with what changed]
- **Deleted**: [list of deleted files/code, if any]

### Verification
- Dead imports: PASS/FAIL
- Query keys: PASS/FAIL
- i18n keys: PASS/FAIL
- API layer: PASS/FAIL
- Dark mode: PASS/FAIL
- File extensions: PASS/FAIL

### Import Map
[Which files import from which — showing the new dependency graph]
```

## Rules
- NEVER delete before the replacement exists
- NEVER create circular imports
- NEVER move `supabase` calls out of api.js files
- NEVER leave dead imports — clean up immediately (Rule 17)
- NEVER break barrel exports — update index.js
- ALWAYS read all affected files before changing anything
- ALWAYS verify imports resolve after every file move
- ALWAYS preserve dark mode variants in extracted components
- ALWAYS preserve i18n namespace usage in extracted components
- ALWAYS update route and nav references if pages are moved/renamed
- If in doubt about scope, refactor LESS — it's easier to do a second pass than to undo a broken refactor
