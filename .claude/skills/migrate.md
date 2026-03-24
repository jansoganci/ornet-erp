# Skill: /migrate — Database Migration Scaffolding

## Description
Generates Supabase PostgreSQL migration files following Ornet ERP's established patterns: table creation, indexes, triggers, RLS policies, views, and RPC functions. Knows finance architecture rules, guard clause patterns, and the full existing schema.

## Triggers
- User says "create a migration", "add a column", "new table", "add a trigger", "update the view"
- User describes a schema change needed for a feature
- User says "migrate" or "database change"

## Inputs
- **Description** of what the migration should do
- (Optional) Related table(s) or feature module
- (Optional) Whether it touches finance (triggers finance architecture rules)

## Workflow

### Step 1 — Determine the next migration number
Check the latest file in `supabase/migrations/` and increment by 1. Format: `00{NNN}_{snake_case_description}.sql`

### Step 2 — Ask ONE clarifying question (if needed)
Priority order:
1. If creating a table but no columns described: "What columns does this table need?"
2. If adding a trigger but target unclear: "Which table should this trigger fire on?"
3. If role access unclear: "Which roles need access — all authenticated, or admin/accountant only?"

### Step 3 — Generate the migration file

Follow this exact section order (skip sections that don't apply):

```sql
-- Migration: 00{NNN}_{description}
-- Description: {what this migration does}

-- ============================================================================
-- 1. Table(s)
-- ============================================================================

-- 2. Indexes
-- ============================================================================

-- 3. Triggers
-- ============================================================================

-- 4. RLS Policies
-- ============================================================================

-- 5. Views
-- ============================================================================

-- 6. RPC Functions
-- ============================================================================
```

### Section Templates

#### New Table
```sql
CREATE TABLE {table_name} (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  {columns with types, NOT NULL, DEFAULT, CHECK constraints}

  -- Foreign keys
  {fk_column} UUID [NOT NULL] REFERENCES {parent_table}(id) [ON DELETE CASCADE],

  -- Metadata (always include these)
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Rules for tables:
- Always include `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Always include `created_at` and `updated_at` with `TIMESTAMPTZ`
- Include `created_by UUID REFERENCES profiles(id)` when tracking who created
- Include `deleted_at TIMESTAMPTZ` for soft-delete tables
- Use CHECK constraints for enum-like columns, not separate enum types
- Use `DECIMAL(12,2)` for money fields — never `FLOAT` or `REAL`
- Use `TIMESTAMPTZ` for all timestamps — never `TIMESTAMP`
- Date-only fields use `DATE`, time-only use `TIME`

#### Alter Table (add column)
```sql
ALTER TABLE {table_name}
ADD COLUMN {column_name} {type} [NOT NULL] [DEFAULT {value}]
  [REFERENCES {parent}(id)]
  [CHECK ({constraint})];

-- Add index if the column will be filtered/joined on
CREATE INDEX idx_{table}_{column} ON {table_name}({column_name});
```

#### Indexes
```sql
-- Describe what query pattern this index optimizes
CREATE INDEX idx_{table}_{purpose}
  ON {table_name}({column})
  [WHERE {partial_index_condition}];
```

Rules for indexes:
- Use partial indexes with `WHERE` for status-filtered queries
- Name format: `idx_{table}_{purpose}` (e.g., `idx_sr_status_open`)
- Always index foreign key columns
- Index columns used in `WHERE`, `ORDER BY`, `JOIN`

#### Auto-update timestamp trigger
```sql
-- Always add for tables with updated_at
CREATE TRIGGER update_{table}_updated_at
  BEFORE UPDATE ON {table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### RLS Policies
```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- SELECT: who can read
CREATE POLICY "{table}_select"
  ON {table_name} FOR SELECT
  TO authenticated
  USING ({condition});

-- INSERT: who can create
CREATE POLICY "{table}_insert"
  ON {table_name} FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ({allowed_roles})
    )
  );

-- UPDATE: who can modify
CREATE POLICY "{table}_update"
  ON {table_name} FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ({allowed_roles})
    )
  );

-- DELETE: who can delete (if applicable)
CREATE POLICY "{table}_delete"
  ON {table_name} FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

RLS patterns used in this project:
- **All authenticated can read**: `USING (true)` or `USING (deleted_at IS NULL)` for soft-delete
- **Admin + accountant can write**: `role IN ('admin', 'accountant')`
- **Admin only**: `role = 'admin'`
- **Own records**: `USING (created_by = auth.uid())`

#### Views (detail views with JOINs)
```sql
CREATE OR REPLACE VIEW {table}_detail AS
SELECT
  t.id,
  t.{columns},
  -- Joined fields
  c.company_name   AS customer_name,
  cs.site_name,
  p.full_name      AS created_by_name
FROM {table_name} t
LEFT JOIN customers c       ON c.id = t.customer_id
LEFT JOIN customer_sites cs ON cs.id = t.site_id
LEFT JOIN profiles p        ON p.id = t.created_by
[WHERE t.deleted_at IS NULL];
```

#### RPC Functions
```sql
CREATE OR REPLACE FUNCTION fn_{action}_{entity}(
  p_param1  {type},
  p_param2  {type}  DEFAULT NULL
)
RETURNS {return_type}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_{var} {type};
BEGIN
  -- Lock row if mutating
  SELECT * INTO v_{var}
  FROM {table}
  WHERE id = p_param1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '{Entity} not found: %', p_param1;
  END IF;

  -- Guard clauses (status checks, permission checks)
  IF v_{var}.status != '{expected}' THEN
    RAISE EXCEPTION 'Invalid status: %', v_{var}.status;
  END IF;

  -- Business logic
  {operations}

  RETURN {result};
END;
$$;
```

Rules for RPC functions:
- Always use `SECURITY DEFINER` + `SET search_path = public`
- Always `FOR UPDATE` when mutating rows to prevent race conditions
- Always check `NOT FOUND` after SELECT
- Always validate status/state before proceeding
- Use `COALESCE(p_user_id, auth.uid())` for user context

#### Finance Triggers
```sql
CREATE OR REPLACE FUNCTION auto_{action}_{target}()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vat_rate DECIMAL(5,2);
  v_exists BOOLEAN;
BEGIN
  -- 1. Status transition guard
  IF NEW.status <> '{trigger_status}' OR OLD.status = '{trigger_status}' THEN
    RETURN NEW;
  END IF;

  -- 2. Idempotency guard (prevent duplicate finance rows)
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions
    WHERE {linking_column} = NEW.id LIMIT 1
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- 3. Proposal guard (for work order triggers ONLY)
  -- NEVER remove this — see CODING-LESSONS.md Rule 18
  IF NEW.proposal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Dynamic VAT rate — NEVER hardcode
  v_vat_rate := COALESCE(NEW.vat_rate, 20);

  -- 5. Insert into financial_transactions (single source of truth)
  INSERT INTO financial_transactions (
    type, amount, vat_rate, vat_amount,
    description, transaction_date,
    customer_id, {linking_column}
  ) VALUES (
    'income',
    NEW.{amount_field},
    v_vat_rate,
    ROUND(NEW.{amount_field} * v_vat_rate / 100, 2),
    {description},
    COALESCE(NEW.{date_field}, CURRENT_DATE),
    {customer_id},
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_{action}_{target}
  AFTER INSERT OR UPDATE ON {source_table}
  FOR EACH ROW
  EXECUTE FUNCTION auto_{action}_{target}();
```

Finance trigger rules (CRITICAL):
- **financial_transactions is the single source of truth** — always write there
- **Dynamic vat_rate**: `COALESCE(record.vat_rate, 20)` — never hardcode `0.20`
- **Amounts are NET** (KDV haric) — VAT calculated as `ROUND(amount * vat_rate / 100, 2)`
- **Idempotency guard**: check `EXISTS` before inserting to prevent duplicates
- **Status transition guard**: check both `NEW.status` and `OLD.status`
- **Proposal guard on WO triggers**: `IF NEW.proposal_id IS NOT NULL THEN RETURN NEW` — NEVER remove (Rule 18)

### Step 4 — Verify against existing schema

Before finalizing:
- Check that referenced tables exist
- Check that column names don't conflict with existing columns
- Check that view names don't conflict with existing views
- Check that function names don't conflict with existing functions
- If altering a view, use `CREATE OR REPLACE VIEW` (not `DROP` + `CREATE`)

### Step 5 — Note required frontend changes

After generating the migration, list what needs to change in the frontend:
```
## Frontend Changes Needed
- [ ] Update `src/features/{feature}/api.js` — add/update query for new columns/table
- [ ] Update `src/features/{feature}/hooks.js` — add/update React Query hooks
- [ ] Update `src/features/{feature}/schema.js` — add/update Zod schema fields
- [ ] Update components that display the affected data
```

## Output Format
```
## Migration: 00{NNN}_{description}

### What it does
[1-2 sentence summary]

### SQL
[Full migration file content]

### Frontend Changes Needed
[Checklist of files that need updating]
```

## Rules
- NEVER use `FLOAT` or `REAL` for money — always `DECIMAL(12,2)`
- NEVER use `TIMESTAMP` — always `TIMESTAMPTZ`
- NEVER hardcode VAT rates in triggers
- NEVER remove the proposal guard clause from WO triggers
- NEVER create finance records outside `financial_transactions`
- ALWAYS include `updated_at` trigger for tables with that column
- ALWAYS enable RLS on new tables
- ALWAYS use partial indexes for status-filtered queries
- ALWAYS use `FOR UPDATE` when mutating rows in RPC functions
- ALWAYS check `NOT FOUND` after SELECT in RPC functions
