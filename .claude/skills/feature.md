# Skill: /feature — Feature Module Scaffolding

## Description
Scaffolds a complete new feature module following Ornet ERP's domain-driven architecture: api.js, hooks.js, schema.js, index.js, page components, translations, route, and navigation — all wired and ready to use.

## Triggers
- User says "create a new feature", "scaffold feature", "new module for X"
- User describes a new domain area that doesn't exist yet

## Inputs
- **Feature name** (English, camelCase for folder, PascalCase for components)
- **Description** of what the feature does
- (Optional) DB tables involved
- (Optional) Role restrictions (admin only, canWrite, etc.)

## Workflow

### Step 1 — Ask ONE clarifying question
Before scaffolding, ask the single most important question. Priority order:
1. If no DB tables mentioned: "Which Supabase table(s) does this feature read/write?"
2. If no role info: "Is this feature restricted to specific roles (admin, canWrite)?"
3. If scope is ambiguous: "Should this have CRUD (list + detail + form) or just a single page?"

Ask only ONE. Make reasonable assumptions for the rest.

### Step 2 — Create the feature folder structure

```
src/features/{featureName}/
├── api.js                          # Supabase API calls
├── hooks.js                        # React Query hooks with query keys
├── schema.js                       # Zod validation schemas
├── index.js                        # Barrel exports (pure JS, no JSX)
├── {FeatureName}ListPage.jsx       # List page (if CRUD)
├── {FeatureName}DetailPage.jsx     # Detail page (if CRUD)
├── {FeatureName}FormPage.jsx       # Create/Edit form (if CRUD)
└── components/                     # Feature-specific components (if needed)
```

### Step 3 — Generate api.js
```js
import { supabase } from '@/lib/supabase';

// Query functions
export async function fetch{FeatureName}s(filters) {
  const query = supabase
    .from('{table_name}')
    .select('*')
    .order('created_at', { ascending: false });
  // Apply filters...
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetch{FeatureName}ById(id) {
  const { data, error } = await supabase
    .from('{table_name}')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Mutation functions
export async function create{FeatureName}(values) {
  const { data, error } = await supabase
    .from('{table_name}')
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function update{FeatureName}(id, values) {
  const { data, error } = await supabase
    .from('{table_name}')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function delete{FeatureName}(id) {
  const { error } = await supabase
    .from('{table_name}')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
```

Rules for api.js:
- ALL Supabase calls live here — never in components or hooks (Rule 10, 15, 16)
- Realtime channels (`supabase.channel()`) also go here (Rule 15)
- Always `throw error` — never return `{ data, error }` to the caller

### Step 4 — Generate hooks.js
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { fetch{FeatureName}s, fetch{FeatureName}ById, create{FeatureName}, update{FeatureName}, delete{FeatureName} } from './api';

export const {featureName}Keys = {
  all: ['{featureName}s'],
  lists: () => [...{featureName}Keys.all, 'list'],
  list: (filters) => [...{featureName}Keys.lists(), filters],
  details: () => [...{featureName}Keys.all, 'detail'],
  detail: (id) => [...{featureName}Keys.details(), id],
};

export function use{FeatureName}s(filters) {
  return useQuery({
    queryKey: {featureName}Keys.list(filters),
    queryFn: () => fetch{FeatureName}s(filters),
  });
}

export function use{FeatureName}(id) {
  return useQuery({
    queryKey: {featureName}Keys.detail(id),
    queryFn: () => fetch{FeatureName}ById(id),
    enabled: !!id,
  });
}

export function useCreate{FeatureName}() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('{featureName}');

  return useMutation({
    mutationFn: create{FeatureName},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {featureName}Keys.lists() });
      toast.success(t('common:success.created'));
    },
    onError: () => {
      toast.error(t('common:errors.createFailed'));
    },
  });
}

export function useUpdate{FeatureName}() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('{featureName}');

  return useMutation({
    mutationFn: ({ id, ...values }) => update{FeatureName}(id, values),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: {featureName}Keys.lists() });
      queryClient.invalidateQueries({ queryKey: {featureName}Keys.detail(data.id) });
      toast.success(t('common:success.updated'));
    },
    onError: () => {
      toast.error(t('common:errors.updateFailed'));
    },
  });
}

export function useDelete{FeatureName}() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('{featureName}');

  return useMutation({
    mutationFn: delete{FeatureName},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {featureName}Keys.lists() });
      toast.success(t('common:success.deleted'));
    },
    onError: () => {
      toast.error(t('common:errors.deleteFailed'));
    },
  });
}
```

Rules for hooks.js:
- Invalidate EXACT scoped keys — both `lists()` AND `detail(id)` on update (Rule 1)
- Role-gated queries must use `enabled: isAdmin` or similar (Rule 14)
- Error toasts use `t('common:errors.*')` — never raw `err?.message` (Rule 4)

### Step 5 — Generate schema.js
```js
import { z } from 'zod';

export const {featureName}Schema = z.object({
  // Define fields based on DB table columns
  // Use zodHelpers from @/lib/zodHelpers.js for dates: isoDateString()
});

export const {featureName}DefaultValues = {
  // Match schema fields with sensible defaults
};
```

Rules for schema.js:
- Always use zod — never skip validation (Rule 7)
- Use `isoDateString()` from `@/lib/zodHelpers.js` for date fields
- Date values must be UTC-safe with `T00:00:00Z` suffix (Rule 2)

### Step 6 — Generate index.js (barrel exports)
```js
// Pure JS — no JSX in barrel exports
export * from './hooks';
export * from './api';
export * from './schema';
```

### Step 7 — Generate page components (.jsx)
Each page component MUST:
- Use `useTranslation('{featureName}')` for all text
- Import from `@/components/layout` (PageContainer, PageHeader)
- Import from `@/components/ui/` (Button, Input, etc.)
- Handle all 4 states: loading (Spinner/Skeleton), error (ErrorState), empty (EmptyState), success
- Be mobile-first with responsive breakpoints
- Include full dark mode support
- Use `useNavigate` for navigation — never `window.location` (Rule 3)
- Forms use `react-hook-form` + `zodResolver` (Rule 6, 7)
- Forms wire `handleSubmit` to form OR button, never both (Rule 7)
- Guard `?.` and `??` on all nullable DB fields (Rule 5)
- Call `setValue()` for any external field updates in RHF (Rule 9)

### Step 8 — Generate translation file
Create `src/locales/tr/{featureName}.json`:
```json
{
  "list": {
    "title": "...",
    "addButton": "...",
    "empty": {
      "title": "...",
      "description": "..."
    },
    "columns": { }
  },
  "detail": {
    "title": "..."
  },
  "form": {
    "title": { "create": "...", "edit": "..." },
    "labels": { },
    "placeholders": { },
    "buttons": { "save": "...", "cancel": "..." }
  }
}
```

### Step 9 — Wire i18n namespace
Add to `src/lib/i18n.js`:
- Import the JSON file
- Add to `ns` array
- Add to `resources.tr` object

### Step 10 — Wire route
Add to `src/App.jsx` inside the protected routes:
```jsx
<Route path="/{feature-name}" element={<{FeatureName}ListPage />} />
<Route path="/{feature-name}/new" element={<{FeatureName}FormPage />} />
<Route path="/{feature-name}/:id" element={<{FeatureName}DetailPage />} />
<Route path="/{feature-name}/:id/edit" element={<{FeatureName}FormPage />} />
```

If role-restricted, wrap in the appropriate guard check.

### Step 11 — Wire navigation
Add to `src/components/layout/navItems.js`:
- Import icon from `lucide-react`
- Add nav item object to the appropriate group

## Checklist Before Finishing
- [ ] All files use `.jsx` extension for JSX, `.js` for pure JS
- [ ] No Supabase calls outside api.js
- [ ] All strings use i18n — no hardcoded Turkish
- [ ] Dark mode on every visual element
- [ ] Mobile-first responsive layout
- [ ] Loading, error, empty states handled
- [ ] Query keys are properly scoped
- [ ] Forms use react-hook-form + zod
- [ ] Route added to App.jsx
- [ ] Nav item added to navItems.js
- [ ] i18n namespace registered in i18n.js
