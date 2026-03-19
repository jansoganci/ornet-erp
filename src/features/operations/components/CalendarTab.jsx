import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button, IconButton, Spinner, ErrorState } from '../../../components/ui';
import { calendarLocalizer, getCalendarCulture } from '../../calendar/calendarLocalizer';
import { getWeekRange, getMonthRange, getEventClassName, formatDateRangeLabel } from '../../calendar/utils';
import { useCalendarWorkOrders, useCalendarRealtime } from '../../calendar/hooks';
import { cn } from '../../../lib/utils';

const VIEW_WEEK = 'week';
const VIEW_MONTH = 'month';
const DAY_START = new Date(1970, 0, 1, 6, 0, 0);
const DAY_END = new Date(1970, 0, 1, 21, 0, 0);

export function CalendarTab() {
  const { t, i18n } = useTranslation(['operations', 'common']);
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState(VIEW_WEEK);

  const { dateFrom, dateTo } = useMemo(() => {
    return view === VIEW_MONTH ? getMonthRange(currentDate) : getWeekRange(currentDate);
  }, [currentDate, view]);

  const dateRangeLabel = useMemo(() => {
    return formatDateRangeLabel(dateFrom, dateTo, view, i18n.language);
  }, [dateFrom, dateTo, view, i18n.language]);

  const { events, isLoading, isError } = useCalendarWorkOrders({ dateFrom, dateTo });
  useCalendarRealtime();

  const culture = getCalendarCulture(i18n.language);

  const handleSelectEvent = (event) => {
    if (event?.resource?.id) {
      navigate(`/work-orders/${event.resource.id}`);
    }
  };

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === VIEW_MONTH) d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (view === VIEW_MONTH) d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View toggle + Today */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 bg-neutral-50 dark:bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => setView(VIEW_WEEK)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                view === VIEW_WEEK
                  ? 'bg-white dark:bg-[#262626] text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              )}
            >
              {t('common:time.thisWeek')}
            </button>
            <button
              type="button"
              onClick={() => setView(VIEW_MONTH)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                view === VIEW_MONTH
                  ? 'bg-white dark:bg-[#262626] text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              )}
            >
              {t('common:time.thisMonth')}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            {t('common:time.today')}
          </Button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} variant="ghost" size="sm" onClick={goPrev} />
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 min-w-[180px] text-center select-none">
            {dateRangeLabel}
          </h3>
          <IconButton icon={ChevronRight} variant="ghost" size="sm" onClick={goNext} />
        </div>
      </div>

      {/* Calendar */}
      {isError ? (
        <ErrorState message={t('common:errors.loadFailed')} />
      ) : (
        <div className="relative min-h-[500px] rounded-lg border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
          <Calendar
            localizer={calendarLocalizer}
            culture={culture}
            events={events}
            view={view}
            views={[VIEW_WEEK, VIEW_MONTH]}
            date={currentDate}
            onNavigate={setCurrentDate}
            onView={setView}
            onSelectEvent={handleSelectEvent}
            min={DAY_START}
            max={DAY_END}
            selectable={false}
            eventPropGetter={(event) => ({ className: getEventClassName(event) })}
            toolbar={false}
            style={{ minHeight: 500 }}
            className="rbc-calendar"
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#171717]/60 backdrop-blur-[1px] z-10">
              <Spinner size="lg" />
            </div>
          )}

          {!isLoading && events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center bg-white/80 dark:bg-[#171717]/80 backdrop-blur-sm rounded-2xl px-8 py-6">
                <CalendarDays className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                  {t('operations:tabs.calendar')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
