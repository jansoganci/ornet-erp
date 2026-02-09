# Calendar Module

## Overview
The Calendar module provides a visual scheduling interface for managing work orders. It allows dispatchers and technicians to view the workload across weekly or monthly timeframes, reschedule jobs via drag-and-drop, and quickly identify gaps in the service schedule.

## Routes
- `/calendar` - Main interactive calendar interface

## Pages

### CalendarPage (`/calendar`)
**Purpose:** Centralized visual scheduling hub for all field operations.

**Features:**
- Weekly and Monthly view toggles
- Drag-and-Drop rescheduling of work orders
- Status and Work Type filtering
- Real-time updates via Supabase Postgres changes
- Click-to-create: Selecting a time slot pre-fills the Work Order form
- Event tooltips and detailed summary modals

**Key Components:**
- `DnDCalendar` - Enhanced `react-big-calendar` with drag-and-drop capabilities
- `EventDetailModal` - Quick-view summary of a scheduled job
- `PageHeader` - Integrated with custom date range labels
- `Select` - For status and type filtering in the toolbar

**API Calls:**
- `useCalendarWorkOrders(filters)` - Fetches and maps work orders to calendar events
- `useUpdateWorkOrder()` - Used for updating dates/times after a drag-and-drop action
- `useCalendarRealtime()` - Subscribes to database changes to keep the UI in sync

**User Flow:**
1. Switch between Week/Month view to assess workload
2. Drag a job from Monday to Tuesday to reschedule
3. Click an empty slot to schedule a new job at that specific time
4. Click an existing job to see details or navigate to the full work order page

**File:** `src/features/calendar/CalendarPage.jsx`

***

## Components

### EventDetailModal
**Purpose:** Displays a compact summary of a work order when clicked on the calendar.
**Used in:** `CalendarPage`
**Features:** Shows customer, site, address, assigned workers, and truncated description.
**File:** `src/features/calendar/EventDetailModal.jsx`

***

## API & Data

**API File:** (Uses `src/features/workOrders/api.js`)

**Key Functions (Utils):**
- `mapWorkOrdersToEvents(workOrders)` - Transforms API data into the shape required by the calendar library
- `getWeekRange(date)` / `getMonthRange(date)` - Calculates ISO date boundaries for API filtering
- `dateToQueryParams(date)` - Formats calendar slots for the Work Order creation URL

**React Query Hooks:**
- `useCalendarWorkOrders()` - Specialized hook that combines fetching and mapping
- `useCalendarRealtime()` - Real-time synchronization hook

**Database Tables:**
- `work_orders` - The source of all calendar events

***

## Business Rules
1. **Time Boundaries:** The weekly calendar view is restricted to 06:00 – 21:00 to focus on standard operating hours.
2. **Rescheduling:** Dragging an event updates both the `scheduled_date` and `scheduled_time` in the database.
3. **Color Coding:** Events are color-coded based on their status (e.g., Warning/Orange for Pending, Success/Green for Completed).
4. **Localization:** The calendar automatically switches between Turkish and English based on the app's `i18next` language setting.

***

## Technical Notes
- **Library:** Built on `react-big-calendar` with the `date-fns` localizer.
- **Performance:** Uses `useMemo` for date range calculations and event mapping to prevent unnecessary re-renders.
- **Real-time:** Uses Supabase `postgres_changes` to invalidate the calendar query whenever a work order is added, moved, or deleted by any user.
- **Styling:** Custom CSS overrides are used to align the third-party calendar library with the app's Red/Stone design system.
