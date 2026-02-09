import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, IconButton, Spinner, ErrorState, Select } from '../../components/ui';
import { calendarLocalizer, getCalendarCulture } from './calendarLocalizer';
import { getWeekRange, getMonthRange, dateToQueryParams, getEventClassName, formatDateRangeLabel } from './utils';
import { useCalendarWorkOrders, useCalendarRealtime, calendarKeys } from './hooks';
import { EventDetailModal } from './EventDetailModal';
import { useUpdateWorkOrder } from '../workOrders/hooks';
import { cn } from '../../lib/utils';

const DnDCalendar = withDragAndDrop(Calendar);

const VIEW_WEEK = 'week';
const VIEW_MONTH = 'month';

/** Visible time range: 06:00 – 21:00 */
const DAY_START = new Date(1970, 0, 1, 6, 0, 0);
const DAY_END = new Date(1970, 0, 1, 21, 0, 0);

export function CalendarPage() {
  const { t, i18n } = useTranslation('calendar');
  const tCommon = useTranslation('common').t;
  const tWorkOrders = useTranslation('workOrders').t;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateWorkOrderMutation = useUpdateWorkOrder();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState(VIEW_WEEK);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const { dateFrom, dateTo } = useMemo(() => {
    return view === VIEW_MONTH
      ? getMonthRange(currentDate)
      : getWeekRange(currentDate);
  }, [currentDate, view]);

  const dateRangeLabel = useMemo(() => {
    return formatDateRangeLabel(dateFrom, dateTo, view, i18n.language);
  }, [dateFrom, dateTo, view, i18n.language]);

  const { events, isLoading, isError } = useCalendarWorkOrders({
    dateFrom,
    dateTo,
    status: statusFilter,
    type: typeFilter,
  });

  useCalendarRealtime();

  const culture = getCalendarCulture(i18n.language);

  const handleSelectEvent = (event) => {
    if (event) setSelectedEvent(event);
  };

  const handleSelectSlot = (slotInfo) => {
    const { date, time } = dateToQueryParams(slotInfo.start);
    navigate(`/work-orders/new?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
  };

  const handleEventDrop = ({ event, start }) => {
    const wo = event?.resource;
    if (!wo?.id) return;
    const { date, time } = dateToQueryParams(start);
    updateWorkOrderMutation.mutate(
      { id: wo.id, scheduled_date: date, scheduled_time: time },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        },
      }
    );
  };

  const handleNavigate = (newDate) => {
    setCurrentDate(newDate);
  };

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === VIEW_MONTH) {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (view === VIEW_MONTH) {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const statusOptions = [
    { value: 'all', label: tWorkOrders('list.filters.all') },
    { value: 'pending', label: tWorkOrders('statuses.pending') },
    { value: 'scheduled', label: tWorkOrders('statuses.scheduled') },
    { value: 'in_progress', label: tWorkOrders('statuses.inProgress') },
    { value: 'completed', label: tWorkOrders('statuses.completed') },
    { value: 'cancelled', label: tWorkOrders('statuses.cancelled') },
  ];

  const typeOptions = [
    { value: 'all', label: tWorkOrders('list.filters.allTypes') },
    { value: 'survey', label: tCommon('workType.survey') },
    { value: 'installation', label: tCommon('workType.installation') },
    { value: 'service', label: tCommon('workType.service') },
    { value: 'maintenance', label: tCommon('workType.maintenance') },
    { value: 'other', label: tCommon('workType.other') },
  ];

  return (
    <PageContainer maxWidth="full" padding="default">
      <PageHeader title={t('nav.calendar')} />

      {/* Toolbar */}
      <div className="space-y-3 mb-4 mt-2">
        {/* Row 1: View toggle + Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* View toggle */}
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
              {t('view.weekly')}
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
              {t('view.monthly')}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              {tCommon('time.today')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/work-orders/new')}
            >
              {tWorkOrders('list.addButton')}
            </Button>
          </div>
        </div>

        {/* Row 2: Date navigation + Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <IconButton
              icon={ChevronLeft}
              variant="ghost"
              size="sm"
              onClick={goPrev}
              aria-label={tCommon('pagination.previous')}
            />
            <h2
              className="text-base lg:text-lg font-bold text-neutral-900 dark:text-neutral-50 min-w-[180px] lg:min-w-[220px] text-center select-none"
              aria-live="polite"
            >
              {dateRangeLabel}
            </h2>
            <IconButton
              icon={ChevronRight}
              variant="ghost"
              size="sm"
              onClick={goNext}
              aria-label={tCommon('pagination.next')}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="sm"
              wrapperClassName="w-36"
            />
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              size="sm"
              wrapperClassName="w-36"
            />
          </div>
        </div>
      </div>

      {/* Calendar grid — always rendered unless error */}
      {isError ? (
        <ErrorState
          title={t('error.loadListFailed')}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div className="relative min-h-[500px] rounded-lg border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
          <DnDCalendar
            localizer={calendarLocalizer}
            culture={culture}
            events={events}
            view={view}
            views={[VIEW_WEEK, VIEW_MONTH]}
            date={currentDate}
            onNavigate={handleNavigate}
            onView={setView}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            min={DAY_START}
            max={DAY_END}
            selectable
            resizable={false}
            eventPropGetter={(event) => ({ className: getEventClassName(event) })}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            toolbar={false}
            style={{ minHeight: 500 }}
            className="rbc-calendar"
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#171717]/60 backdrop-blur-[1px] z-10">
              <Spinner size="lg" />
            </div>
          )}

          {/* Empty state overlay — grid stays visible and clickable */}
          {!isLoading && events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center bg-white/80 dark:bg-[#171717]/80 backdrop-blur-sm rounded-2xl px-8 py-6">
                <CalendarDays className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                  {view === VIEW_MONTH ? t('empty.month') : t('empty.week')}
                </p>
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1 max-w-[240px]">
                  {t('empty.hint')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <EventDetailModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </PageContainer>
  );
}
