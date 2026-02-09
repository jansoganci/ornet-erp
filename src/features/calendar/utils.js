import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format as formatDateFns } from 'date-fns';
import tr from 'date-fns/locale/tr';

/**
 * Get Monday–Sunday week range as ISO date strings for API (dateFrom, dateTo).
 * Uses Monday as first day of week (tr-TR convention).
 */
export function getWeekRange(date) {
  const d = date instanceof Date ? date : new Date(date);
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return {
    dateFrom: formatDateFns(start, 'yyyy-MM-dd'),
    dateTo: formatDateFns(end, 'yyyy-MM-dd'),
  };
}

/**
 * Format a Date for work order form query params (date=YYYY-MM-DD, time=HH:mm).
 */
export function dateToQueryParams(date) {
  const d = date instanceof Date ? date : new Date(date);
  return {
    date: formatDateFns(d, 'yyyy-MM-dd'),
    time: formatDateFns(d, 'HH:mm'),
  };
}

/**
 * Get first–last day of month as ISO date strings for API (dateFrom, dateTo).
 */
export function getMonthRange(date) {
  const d = date instanceof Date ? date : new Date(date);
  const start = startOfMonth(d);
  const end = endOfMonth(d);
  return {
    dateFrom: formatDateFns(start, 'yyyy-MM-dd'),
    dateTo: formatDateFns(end, 'yyyy-MM-dd'),
  };
}

/**
 * Parse scheduled_date (YYYY-MM-DD) and scheduled_time (HH:mm or HH:mm:ss) into a local Date.
 * Falls back to 09:00 if time is missing.
 */
function parseScheduledAt(scheduled_date, scheduled_time) {
  if (!scheduled_date) return null;
  const [y, m, d] = scheduled_date.split('-').map(Number);
  let hour = 9;
  let minute = 0;
  if (scheduled_time) {
    const parts = scheduled_time.split(':');
    hour = parseInt(parts[0], 10) || 9;
    minute = parseInt(parts[1], 10) || 0;
  }
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/**
 * Default event duration in milliseconds (1 hour).
 */
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

/**
 * Map a work order from the API to a calendar event shape.
 * react-big-calendar expects at least: title, start (Date), end (Date).
 * resource holds the full work order for event rendering.
 */
export function mapWorkOrderToEvent(workOrder) {
  const start =
    parseScheduledAt(workOrder.scheduled_date, workOrder.scheduled_time) ||
    (workOrder.scheduled_date
      ? parseScheduledAt(workOrder.scheduled_date, '09:00')
      : null);
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);

  return {
    id: workOrder.id,
    title: workOrder.company_name || workOrder.description || '',
    start,
    end,
    resource: workOrder,
  };
}

/**
 * Calendar event CSS class by work order status (for eventPropGetter).
 * Matches design-system status badge colors: pending=warning, scheduled=info,
 * in_progress=primary, completed=success, cancelled=neutral.
 */
export const calendarEventClassByStatus = {
  pending: '!bg-warning-50 !border-l-4 !border-warning-500 !text-warning-800 dark:!bg-warning-900/30 dark:!text-warning-200',
  scheduled: '!bg-info-50 !border-l-4 !border-info-500 !text-info-800 dark:!bg-info-900/30 dark:!text-info-200',
  in_progress: '!bg-primary-50 !border-l-4 !border-primary-500 !text-primary-800 dark:!bg-primary-900/30 dark:!text-primary-200',
  completed: '!bg-success-50 !border-l-4 !border-success-500 !text-success-800 dark:!bg-success-900/30 dark:!text-success-200',
  cancelled: '!bg-neutral-100 !border-l-4 !border-neutral-400 !text-neutral-600 dark:!bg-[#171717] dark:!text-neutral-400',
};

/**
 * Return className for a calendar event based on work order status (resource.status).
 */
export function getEventClassName(event) {
  const status = event?.resource?.status;
  return calendarEventClassByStatus[status] ?? '!bg-neutral-100 !border-l-4 !border-neutral-300 dark:!bg-[#171717] dark:!text-neutral-300';
}

/**
 * Map an array of work orders to calendar events.
 * Skips entries without a valid start date.
 */
export function mapWorkOrdersToEvents(workOrders) {
  if (!Array.isArray(workOrders)) return [];
  return workOrders.map(mapWorkOrderToEvent).filter(Boolean);
}

/**
 * Format a human-readable date range label for the calendar toolbar.
 * Week view: "2 – 8 Şubat 2026" or "30 Ocak – 5 Şubat 2026"
 * Month view: "Şubat 2026"
 */
export function formatDateRangeLabel(dateFrom, dateTo, view, language) {
  const start = new Date(dateFrom + 'T12:00:00');
  const end = new Date(dateTo + 'T12:00:00');
  const locale = language === 'tr' ? tr : undefined;
  const capitalize = (str) =>
    str.charAt(0).toLocaleUpperCase(language) + str.slice(1);

  if (view === 'month') {
    return capitalize(formatDateFns(start, 'LLLL yyyy', { locale }));
  }

  // Week view
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const monthYear = capitalize(formatDateFns(end, 'MMMM yyyy', { locale }));
    return `${start.getDate()} – ${end.getDate()} ${monthYear}`;
  }

  if (sameYear) {
    const startMonth = capitalize(formatDateFns(start, 'MMMM', { locale }));
    const endMonthYear = capitalize(formatDateFns(end, 'MMMM yyyy', { locale }));
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonthYear}`;
  }

  // Cross-year (rare)
  const startFull = capitalize(formatDateFns(start, 'd MMMM yyyy', { locale }));
  const endFull = capitalize(formatDateFns(end, 'd MMMM yyyy', { locale }));
  return `${startFull} – ${endFull}`;
}
