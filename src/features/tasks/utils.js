import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  parseISO,
  isBefore,
  isWithinInterval,
} from 'date-fns';

/**
 * Groups a flat task array into time-horizon buckets.
 *
 * @param {Array} tasks – task objects with `due_date` (string|null) and `status`
 * @returns {{ overdue: Array, thisWeek: Array, thisMonth: Array, upcoming: Array, noDueDate: Array, completed: Array }}
 */
export function groupPlansByHorizon(tasks = []) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthEnd = endOfMonth(now);

  const groups = {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    upcoming: [],
    noDueDate: [],
    completed: [],
  };

  for (const task of tasks) {
    // Completed tasks always go to completed bucket
    if (task.status === 'completed') {
      groups.completed.push(task);
      continue;
    }

    // No due date
    if (!task.due_date) {
      groups.noDueDate.push(task);
      continue;
    }

    const dueDate = startOfDay(parseISO(task.due_date));

    // Overdue: before today
    if (isBefore(dueDate, todayStart)) {
      groups.overdue.push(task);
      continue;
    }

    // This week: today through end of week
    if (
      isWithinInterval(dueDate, { start: todayStart, end: weekEnd })
    ) {
      groups.thisWeek.push(task);
      continue;
    }

    // This month: after this week but within current month
    if (
      isWithinInterval(dueDate, { start: weekEnd, end: monthEnd })
    ) {
      groups.thisMonth.push(task);
      continue;
    }

    // Upcoming: after current month
    groups.upcoming.push(task);
  }

  return groups;
}
