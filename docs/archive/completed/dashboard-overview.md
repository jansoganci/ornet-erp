# Dashboard Module

## Overview
The Dashboard module provides a high-level command center for the application. It aggregates critical data from across the system—work orders, tasks, customers, and SIM cards—into a single view, allowing users to quickly assess daily operations, monitor key performance indicators (KPIs), and access frequently used actions.

## Routes
- `/` - The main application dashboard

## Pages

### DashboardPage (`/`)
**Purpose:** Centralized landing page for all users to manage their daily workload and monitor system health.

**Features:**
- Real-time operational stats (Today's jobs, Pending jobs, Open tasks, Total customers)
- SIM card financial highlights (Active count and Monthly profit)
- "Today's Schedule" timeline with customer details and job priority
- "Pending Tasks" list with quick-toggle status completion
- "Quick Actions" panel for rapid entry of new records (Customer, Work Order, Task)
- Role-aware greeting and current date display

**Key Components:**
- `StatCard` - Reusable metric display with icons and color variants
- `TaskModal` - Integrated for creating new tasks without leaving the dashboard
- `Badge` - Used for priority and status indicators in the schedule and task lists
- `Skeleton` - Provides a smooth loading experience for schedule and task sections

**API Calls:**
- `useDashboardStats()` - Fetches high-level counts via `get_dashboard_stats` RPC
- `useTodaySchedule()` - Fetches the current day's jobs via `get_today_schedule` RPC
- `usePendingTasks()` - Fetches the user's top 5 pending tasks via `get_my_pending_tasks` RPC
- `useSimFinancialStats()` - Fetches SIM-specific revenue and count data

**User Flow:**
1. Log in and land on the Dashboard to see the day's "at a glance" summary
2. Check the "Today's Schedule" to see the first appointment time and location
3. Use "Quick Actions" to register a new customer or job immediately
4. Mark a pending task as "Completed" directly from the dashboard list

**File:** `src/pages/DashboardPage.jsx`

***

## Components

### StatCard
**Purpose:** Displays a single metric with an icon, label, and value.
**Used in:** `DashboardPage`
**Features:** Supports multiple color variants (Primary, Success, Warning, Info) and includes a built-in loading state.
**File:** `src/features/dashboard/StatCard.jsx`

***

## API & Data

**API File:** `src/features/dashboard/api.js`

**Key Functions:**
- `fetchDashboardStats()` - Calls RPC `get_dashboard_stats`
- `fetchTodaySchedule()` - Calls RPC `get_today_schedule`
- `fetchPendingTasks()` - Calls RPC `get_my_pending_tasks` with a limit of 5

**React Query Hooks:**
- `useDashboardStats()` - Main KPIs hook
- `useTodaySchedule()` - Daily timeline hook
- `usePendingTasks()` - Personal to-do hook

**Database Tables:**
- Aggregates data from `work_orders`, `tasks`, `customers`, `sim_cards`, and `profiles`.

***

## Business Rules
1. **Real-time Awareness:** The dashboard is designed to be the "source of truth" for the current day's field operations.
2. **Technician Focus:** "Pending Tasks" are filtered to the currently logged-in user to ensure personal accountability.
3. **Data Fallback:** The API includes comprehensive mock data fallbacks to ensure the dashboard remains functional even if specific RPCs are missing or Supabase is temporarily unavailable.

***

## Technical Notes
- **RPC Driven:** To ensure high performance, the dashboard relies on specialized Postgres RPCs that perform aggregations on the server rather than the client.
- **Cross-Module Integration:** This module is the most "connected" in the app, importing hooks and components from `tasks`, `workOrders`, `simCards`, and `auth`.
- **Responsive Design:** The layout shifts from a single-column stack on mobile to a multi-column grid on desktop to maximize information density.
