import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';

const DAY_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

/**
 * Mini month calendar sidebar for the Yıllık Plan page.
 * Shows dots on dates that have tasks, and calls onSelectDate when a date is clicked.
 *
 * @param {Object} props
 * @param {Array} props.tasks - All tasks (with due_date)
 * @param {function} props.onSelectDate - Called with ISO date string when a date is clicked
 * @param {string|null} props.selectedDate - Currently selected date (ISO string) or null
 */
export function MiniCalendarSidebar({ tasks = [], onSelectDate, selectedDate }) {
  const { t } = useTranslation('tasks');
  const [viewMonth, setViewMonth] = useState(() => new Date());

  // Build a Set of dates (YYYY-MM-DD strings) that have at least one task
  const taskDateSet = useMemo(() => {
    const s = new Set();
    for (const task of tasks) {
      if (task.due_date) s.add(task.due_date);
    }
    return s;
  }, [tasks]);

  // Build the 6-week grid of days for the current view month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const monthLabel = useMemo(() => {
    const raw = format(viewMonth, 'LLLL yyyy', { locale: trLocale });
    return raw.charAt(0).toLocaleUpperCase('tr') + raw.slice(1);
  }, [viewMonth]);

  const handlePrevMonth = () => setViewMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setViewMonth((m) => addMonths(m, 1));

  const handleDayClick = (day) => {
    const iso = format(day, 'yyyy-MM-dd');
    onSelectDate?.(iso);
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
            {t('miniCalendar.title')}
          </span>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 select-none">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 text-center uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calendarDays.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, viewMonth);
          const today = isToday(day);
          const hasTasks = taskDateSet.has(iso);
          const isSelected = selectedDate && isSameDay(day, new Date(selectedDate + 'T12:00:00'));

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative flex flex-col items-center justify-center w-8 h-8 mx-auto rounded-lg text-xs transition-colors',
                !inMonth && 'text-neutral-300 dark:text-neutral-600',
                inMonth && 'text-neutral-700 dark:text-neutral-300',
                inMonth && 'hover:bg-neutral-100 dark:hover:bg-[#262626]',
                today && !isSelected && 'font-bold text-primary-600 dark:text-primary-400',
                isSelected &&
                  'bg-primary-600 dark:bg-primary-500 text-white dark:text-white font-bold hover:bg-primary-700 dark:hover:bg-primary-600'
              )}
            >
              <span>{day.getDate()}</span>
              {/* Dot indicator for tasks on this day */}
              {hasTasks && (
                <span
                  className={cn(
                    'absolute bottom-0.5 w-1 h-1 rounded-full',
                    isSelected
                      ? 'bg-white/80'
                      : 'bg-violet-500 dark:bg-violet-400'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
