# Skill: /wire — Cross-Module Wiring

## Description
Connects two or more feature modules with proper dependency chains: DB triggers, foreign keys, API functions, React Query invalidation, and UI integration. Understands Ornet ERP's cross-module patterns (subscriptions → finance, proposals → work orders → finance, etc.).

## Triggers
- User says "wire X to Y", "connect these modules", "add a trigger from X to Y"
- User describes a cross-module feature (e.g., "when a work order completes, create a finance transaction")
- User asks to add a relationship between existing features

## Inputs
- **Source module**: The module where the action originates
- **Target module**: The module that should react
- **Relationship**: What triggers the connection and what should happen
- (Optional) Existing patterns to follow (e.g., "like subscriptions → finance")

## Workflow

### Step 1 — Map the dependency chain

Before writing any code, map the full chain:

```
[Source Action] → [DB Trigger/API Call] → [Target Table] → [Cache Invalidation] → [UI Update]
```

Ask ONE clarifying question if the chain is ambiguous (e.g., "Should this be a DB trigger or an API-level call?").

### Step 2 — Identify existing cross-module patterns

Check if a similar pattern already exists in the codebase:

| Pattern | Source → Target | Mechanism |
|---------|----------------|-----------|
| Subscription payment → Finance | `subscription_payments` INSERT → `financial_transactions` | DB trigger |
| Proposal completion → Finance | `proposals` status='completed' → `financial_transactions` | DB trigger (`auto_record_proposal_revenue`) |
| Work order completion → Finance | `work_orders` status='completed' → `financial_transactions` | DB trigger (`auto_record_work_order_revenue`) with proposal guard |
| Subscription cancel → SIM status | `subscriptions` status='cancelled' → `sim_cards` status | DB trigger |
| Proposal → Work orders | `proposals` ↔ `work_orders` via `proposal_work_orders` | Junction table + API |
| Recurring template → Finance | `recurring_expense_templates` → `financial_transactions` | DB function (scheduled) |

Follow the existing pattern that most closely matches the new requirement.

### Step 3 — Design the DB layer (if needed)

If the connection requires database changes:

#### Foreign keys
```sql
ALTER TABLE {source_table}
ADD COLUMN {target}_id UUID REFERENCES {target_table}(id);
```

#### Junction tables (many-to-many)
```sql
CREATE TABLE {source}_{target} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  {source}_id UUID NOT NULL REFERENCES {source_table}(id) ON DELETE CASCADE,
  {target}_id UUID NOT NULL REFERENCES {target_table}(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE({source}_id, {target}_id)
);
```

#### DB triggers
```sql
CREATE OR REPLACE FUNCTION auto_{action}_{target}()
RETURNS TRIGGER AS $$
BEGIN
  -- Guard clauses FIRST (e.g., proposal guard for WO → finance)
  IF {guard_condition} THEN
    RETURN NEW;
  END IF;

  -- Only fire on the specific status transition
  IF NEW.status = '{trigger_status}' AND
     (OLD.status IS NULL OR OLD.status != '{trigger_status}') THEN

    INSERT INTO {target_table} (...)
    VALUES (...);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_{action}_{target}
  AFTER INSERT OR UPDATE ON {source_table}
  FOR EACH ROW
  EXECUTE FUNCTION auto_{action}_{target}();
```

Rules for DB triggers:
- ALWAYS include guard clauses to prevent double-counting (Rule 18)
- ALWAYS check both NEW and OLD status to prevent re-firing
- ALWAYS use `ROUND(amount * vat_rate / 100, 2)` for VAT (Finance Rule B, C)
- ALWAYS write to `financial_transactions` for money flows (Finance Rule A)
- Create migration file: `supabase/migrations/{next_number}_{description}.sql`

### Step 4 — Update the source module API

Add API functions in the source module's `api.js`:

```js
// Link/unlink functions for junction tables
export async function link{Target}To{Source}(sourceId, targetId) {
  const { data, error } = await supabase
    .from('{source}_{target}')
    .insert({ {source}_id: sourceId, {target}_id: targetId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unlink{Target}From{Source}(sourceId, targetId) {
  const { error } = await supabase
    .from('{source}_{target}')
    .delete()
    .eq('{source}_id', sourceId)
    .eq('{target}_id', targetId);
  if (error) throw error;
}

// Fetch related items
export async function fetch{Source}{Target}s(sourceId) {
  const { data, error } = await supabase
    .from('{source}_{target}')
    .select('*, {target_table}(*)')
    .eq('{source}_id', sourceId);
  if (error) throw error;
  return data;
}
```

### Step 5 — Update React Query hooks

Add hooks in the source module's `hooks.js`:

```js
// Add query key for the relationship
export const {source}Keys = {
  // ...existing keys...
  {target}s: (sourceId) => [...{source}Keys.detail(sourceId), '{target}s'],
};

// Fetch hook
export function use{Source}{Target}s(sourceId) {
  return useQuery({
    queryKey: {source}Keys.{target}s(sourceId),
    queryFn: () => fetch{Source}{Target}s(sourceId),
    enabled: !!sourceId,
  });
}

// Link mutation — invalidate BOTH modules' caches
export function useLink{Target}To{Source}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }) => link{Target}To{Source}(sourceId, targetId),
    onSuccess: (_, { sourceId }) => {
      // Invalidate source module queries
      queryClient.invalidateQueries({ queryKey: {source}Keys.{target}s(sourceId) });
      queryClient.invalidateQueries({ queryKey: {source}Keys.detail(sourceId) });
      // Invalidate target module queries
      queryClient.invalidateQueries({ queryKey: {target}Keys.lists() });
    },
  });
}
```

Critical cache invalidation rules:
- Invalidate BOTH source and target module query keys (Rule 1)
- Invalidate specific scoped keys, not just parent keys
- If a DB trigger creates rows in another table, invalidate that table's queries too

### Step 6 — Update UI components

Wire the relationship into the source module's detail/form pages:
- Detail page: show related items from target module
- Form page: add selector/link UI for target items
- Use existing Combobox components if selecting from target module

### Step 7 — Update views (if applicable)

If either module has a Supabase view (e.g., `proposals_detail`, `work_orders_detail`), update it to include the relationship data.

### Step 8 — Verify the chain end-to-end

Walk through the full chain and verify:
1. Source action fires (create/update/delete)
2. DB trigger or API call creates the target record
3. React Query caches for BOTH modules are invalidated
4. UI updates in both source and target modules
5. Guard clauses prevent double-counting
6. Finance flows write to `financial_transactions` (not other tables)
7. VAT uses dynamic `vat_rate` from the source record

## Output Format
```
## Wiring Plan: {Source} → {Target}

### Dependency Chain
[Source Action] → [Mechanism] → [Target Effect] → [Cache Invalidation] → [UI Update]

### Files Modified
- `supabase/migrations/{number}_{name}.sql` — [what it does]
- `src/features/{source}/api.js` — [functions added]
- `src/features/{source}/hooks.js` — [hooks added]
- `src/features/{source}/{Page}.jsx` — [UI changes]
- `src/features/{target}/hooks.js` — [key exports if needed]

### Migration SQL
[Full migration]

### Code Changes
[Diffs or full new functions]

### Cache Invalidation Map
[Which mutations invalidate which query keys]
```

## Rules
- NEVER bypass the proposal/WO finance guard clause (Rule 18)
- NEVER create financial records outside `financial_transactions` (Finance Rule A)
- NEVER hardcode VAT rates (Finance Rule B)
- ALWAYS invalidate both source and target query caches (Rule 1)
- ALWAYS add guard clauses to DB triggers to prevent double-firing
- ALWAYS follow existing patterns — check how subscriptions → finance or proposals → work orders are wired before inventing a new pattern
