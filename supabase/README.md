# Supabase Database Setup

## Quick Start

### Option 1: Run Complete Schema (Recommended)

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/xyybpwrkqdwfvcomvnrk
2. Navigate to **SQL Editor**
3. Copy the entire contents of `complete_schema.sql`
4. Paste and click **Run**

### Option 2: Run Migrations Separately

Run each file in order:
1. `00001_profiles.sql`
2. `00002_customers.sql`
3. `00003_work_orders.sql`
4. `00004_tasks.sql`
5. `00005_dashboard_functions.sql`

---

## Database Schema Overview

```
┌─────────────────┐
│   auth.users    │  (Supabase managed)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    profiles     │  role, full_name, phone
└────────┬────────┘
         │
         ├──────────────────────────────┐
         ▼                              ▼
┌─────────────────┐           ┌─────────────────┐
│   work_orders   │◄──────────│     tasks       │
└────────┬────────┘           └─────────────────┘
         │
         ▼
┌─────────────────┐
│   customers     │
└─────────────────┘
```

---

## Tables

### profiles
Extends Supabase auth.users with app-specific data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | References auth.users |
| role | TEXT | admin, field_worker, accountant |
| full_name | TEXT | Display name |
| phone | TEXT | Contact phone |

### customers
Customer/company records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_number | TEXT | Internal code (M-2024-001) |
| name | TEXT | Customer name |
| phone | TEXT | Primary phone |
| email | TEXT | Email address |
| address | TEXT | Full address |

### work_orders
Service and installation jobs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| type | TEXT | service, installation |
| status | TEXT | pending, scheduled, in_progress, completed, cancelled |
| assigned_to | UUID | FK to profiles |
| scheduled_date | DATE | When scheduled |
| amount | DECIMAL | Cost in TRY |

### tasks
To-do items, optionally linked to work orders.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Task title |
| status | TEXT | pending, in_progress, completed |
| assigned_to | UUID | FK to profiles |
| work_order_id | UUID | Optional FK to work_orders |
| due_date | DATE | Deadline |

---

## Row Level Security (RLS)

| Table | Admin | Field Worker | Accountant |
|-------|-------|--------------|------------|
| profiles | Full | Read all, Update own | Read all |
| customers | Full | Full (except delete) | Full (except delete) |
| work_orders | Full | Assigned only | Read all |
| tasks | Full | Assigned only | None |

---

## Helper Functions

### get_dashboard_stats()
Returns JSON with dashboard statistics.

```sql
SELECT get_dashboard_stats();
-- Returns: { today_work_orders, pending_work_orders, open_tasks, ... }
```

### get_today_schedule()
Returns today's work orders for current user.

```sql
SELECT * FROM get_today_schedule();
```

### get_my_pending_tasks(limit)
Returns pending tasks for current user.

```sql
SELECT * FROM get_my_pending_tasks(10);
```

### get_customer_work_history(customer_id)
Returns all work orders for a customer.

```sql
SELECT * FROM get_customer_work_history('uuid-here');
```

---

## After Running Migrations

1. **Get your anon key:**
   - Dashboard > Project Settings > API
   - Copy `anon public` key

2. **Update .env.local:**
   ```
   VITE_SUPABASE_URL=https://xyybpwrkqdwfvcomvnrk.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-key
   ```

3. **Create first admin user:**
   - Dashboard > Authentication > Users > Add user
   - Email + password
   - Then run in SQL Editor:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
   ```

4. **Test the app:**
   ```bash
   npm run dev
   ```
