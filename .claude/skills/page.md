# Skill: /page — Add Page to Existing Feature

## Description
Adds a new page, tab, or sub-view to an existing feature module. Lighter than `/feature` — extends existing api.js, hooks.js, and schema.js instead of creating them from scratch. Wires the route and nav item.

## Triggers
- User says "add a page to X", "new tab in X", "add a report page to finance"
- User describes a new view within an already-existing feature module
- User says "add a sub-page", "new section in X"

## Inputs
- **Target feature**: Which existing feature module (e.g., `finance`, `subscriptions`, `customers`)
- **Page name**: What to call the new page (e.g., `CashFlowPage`, `CustomerMapPage`)
- **Description**: What the page shows/does
- (Optional) New API calls needed
- (Optional) Role restrictions

## Workflow

### Step 1 — Read the existing feature module

Before writing anything, read ALL existing files in `src/features/{feature}/`:
- `api.js` — understand existing Supabase calls and what tables are already queried
- `hooks.js` — understand existing query keys and hook patterns
- `schema.js` — understand existing validation schemas
- Page components — understand existing UI patterns in this feature
- `index.js` — understand current exports

This prevents duplication and ensures consistency with what's already there.

### Step 2 — Ask ONE clarifying question (if needed)
Priority order:
1. If data source unclear: "Does this page need new data from Supabase, or does it use existing hooks?"
2. If page type unclear: "Is this a list page, detail page, form page, or dashboard/report page?"
3. If placement unclear: "Should this be a top-level route or a tab within an existing page?"

### Step 3 — Extend api.js (if new data needed)

Add new functions to the EXISTING `api.js` — do NOT create a new file unless the feature already splits API files (like subscriptions has `paymentsApi.js`).

```js
// ADD to existing api.js — do not duplicate existing imports or functions

export async function fetch{NewData}(filters) {
  const { data, error } = await supabase
    .from('{table}')
    .select('{columns}')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

Rules:
- Check if the data is already fetched by an existing function — reuse if possible
- If the feature already has split API files (e.g., `collectionApi.js`), follow that pattern
- All Supabase calls in api.js only (Rule 10, 16)

### Step 4 — Extend hooks.js (if new hooks needed)

Add new query keys and hooks to the EXISTING `hooks.js`.

```js
// ADD to existing query keys object
export const {feature}Keys = {
  // ...existing keys (DO NOT duplicate)...
  {newData}: (filters) => [...{feature}Keys.all, '{newData}', filters],
};

// ADD new hook
export function use{NewData}(filters) {
  return useQuery({
    queryKey: {feature}Keys.{newData}(filters),
    queryFn: () => fetch{NewData}(filters),
  });
}
```

Rules:
- Extend existing `{feature}Keys` object — do NOT create a separate keys object
- Follow the exact same hook naming/structure used in the rest of the file
- Role-gated data must use `enabled: isAdmin` or similar (Rule 14)
- If the feature already has split hook files (e.g., `collectionHooks.js`), follow that pattern

### Step 5 — Extend schema.js (if new form needed)

Add new schemas to the EXISTING `schema.js`:

```js
// ADD to existing schema.js
export const {newForm}Schema = z.object({ ... });
export const {newForm}DefaultValues = { ... };
```

### Step 6 — Create the page component (.jsx)

Create `src/features/{feature}/{PageName}Page.jsx`:

```jsx
import { useTranslation } from 'react-i18next';
import { PageContainer, PageHeader } from '@/components/layout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { use{NewData} } from './hooks';

export function {PageName}Page() {
  const { t } = useTranslation('{feature}');
  const { data, isLoading, error } = use{NewData}();

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  if (!data?.length) {
    return (
      <PageContainer>
        <PageHeader title={t('{pageName}.title')} />
        <EmptyState
          title={t('{pageName}.empty.title')}
          description={t('{pageName}.empty.description')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t('{pageName}.title')} />
      {/* Page content */}
    </PageContainer>
  );
}
```

Page component rules:
- Use the SAME i18n namespace as the feature (`useTranslation('{feature}')`)
- Import from `@/components/ui/` and `@/components/layout/`
- Handle all 4 states: loading, error, empty, success
- Mobile-first responsive layout with `sm:`, `md:`, `lg:` breakpoints
- Full dark mode: `bg-white dark:bg-[#171717]`, `text-neutral-900 dark:text-neutral-50`, `border-neutral-200 dark:border-[#262626]`
- Use `useNavigate()` — never `window.location` (Rule 3)
- Guard nullable fields with `?.` and `??` (Rule 5)
- Never import `supabase` directly (Rule 16)
- Forms use `react-hook-form` + `zodResolver` (Rule 7)
- `handleSubmit` on form OR button, never both (Rule 7)

### Step 7 — Add translations

Add new keys to the EXISTING translation file `src/locales/tr/{feature}.json`:

```json
{
  "existingKeys": "...",
  "{pageName}": {
    "title": "...",
    "empty": {
      "title": "...",
      "description": "..."
    }
  }
}
```

Do NOT create a new translation file — extend the existing one for this feature's namespace.

### Step 8 — Wire the route

Add to `src/App.jsx` inside the appropriate route group:

```jsx
<Route path="/{feature}/{page-name}" element={<{PageName}Page />} />
```

If role-restricted, add the guard wrapper.

### Step 9 — Wire navigation (if top-level page)

If the page should appear in the sidebar, add to `src/components/layout/navItems.js`:
- Import icon from `lucide-react`
- Add to the appropriate nav group

If it's a sub-tab within an existing page, skip this step — the parent page handles tab navigation.

### Step 10 — Update barrel exports

Add the new page component to `src/features/{feature}/index.js`:

```js
export { {PageName}Page } from './{PageName}Page';
```

## Checklist Before Finishing
- [ ] Read ALL existing feature files before making changes
- [ ] Extended (not duplicated) existing api.js, hooks.js, schema.js
- [ ] New page uses `.jsx` extension
- [ ] Same i18n namespace as the rest of the feature
- [ ] Loading, error, empty states handled
- [ ] Dark mode on every visual element
- [ ] Mobile-first responsive layout
- [ ] Route added to App.jsx
- [ ] Nav item added (if top-level page)
- [ ] No Supabase imports in the page component
- [ ] No dead imports from the changes
- [ ] Query keys extend the existing keys object (not a new one)

## Key Difference from /feature
| Aspect | /feature | /page |
|--------|----------|-------|
| Creates new folder | Yes | No |
| Creates api.js from scratch | Yes | Extends existing |
| Creates hooks.js from scratch | Yes | Extends existing |
| Creates schema.js from scratch | Yes | Extends existing |
| Creates new i18n namespace | Yes | Extends existing |
| Registers namespace in i18n.js | Yes | No (already registered) |
| Creates index.js | Yes | Updates existing |
