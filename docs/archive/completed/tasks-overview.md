# Tasks Module

## Overview
The Tasks module provides a simple but effective to-do management system for internal office and field operations. It allows users to create, assign, and track administrative or follow-up tasks that aren't necessarily full work orders, ensuring that small but important actions (like customer follow-up calls or stock checks) are not forgotten.

## Routes
- `/tasks` - Unified task board with filtering and management

## Pages

### TasksPage (`/tasks`)
**Purpose:** Central hub for managing personal and team-assigned tasks.

**Features:**
- Quick-toggle status (Pending/Completed) via checkbox-style icons
- Priority-based visual indicators (Low, Normal, High, Urgent)
- Filtering by Status and Assignee
- Inline editing and deletion of tasks
- Due date and time tracking for time-sensitive actions

**Key Components:**
- `TaskModal` - Central form for creating and editing tasks
- `Card` - Interactive task items with hover-reveal actions
- `Badge` - Visual priority and status labels
- `EmptyState` - Guided action when no tasks match the filters

**API Calls:**
- `useTasks(filters)` - Fetches the task list based on status/assignee
- `useProfiles()` - Fetches the list of possible assignees
- `useUpdateTask()` - Mutation for toggling status or updating details
- `useDeleteTask()` - Mutation for removing a task

**User Flow:**
1. Scan the list for "Urgent" or "High" priority tasks
2. Use the status filter to see only "Pending" work
3. Click the circle icon to quickly mark a task as "Completed"
4. Open the "Add Task" modal to assign a new follow-up to a colleague

**File:** `src/features/tasks/TasksPage.jsx`

***

## Components

### TaskModal
**Purpose:** Unified interface for defining task details.
**Used in:** `TasksPage`
**Features:** 
- Fields for Title, Description, Priority, and Status.
- Date and Time pickers for deadlines.
- Assignee dropdown populated from the `profiles` table.
**File:** `src/features/tasks/TaskModal.jsx`

***

## API & Data

**API File:** `src/features/tasks/api.js`

**Key Functions:**
- `fetchTasks(filters)` - Queries `tasks_with_details` view for joined data
- `createTask(data)` - Standard insert
- `updateTask(id, data)` - Standard update
- `deleteTask(id)` - Standard delete
- `fetchProfiles()` - Retrieves user list for assignments

**React Query Hooks:**
- `useTasks()` - Main list hook
- `useProfiles()` - Assignee list hook
- `useCreateTask()` / `useUpdateTask()` - Mutation hooks

**Database Tables:**
- `tasks` - Core task data (title, status, priority, due_date)
- `profiles` - User table for assignments

***

## Business Rules
1. **Priority Levels:** Supports four levels: `low`, `normal`, `high`, `urgent`.
2. **Status Workflow:** Tasks move through `pending`, `in_progress`, `completed`, or `cancelled`.
3. **Assignees:** A task can be assigned to exactly one user from the `profiles` table.
4. **Visual Feedback:** Completed tasks are visually struck through and dimmed to distinguish them from active work.

***

## Technical Notes
- **Mock Data:** The API file includes a robust mock data fallback for development without a Supabase connection.
- **Views:** Uses `tasks_with_details` view to efficiently get assignee names without multiple client-side joins.
- **Real-time Feel:** Status toggles use optimistic-style updates (via React Query invalidation) for a snappy user experience.
