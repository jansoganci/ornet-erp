import { useState, useMemo, useCallback } from 'react';
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
import { useCalendarWorkOrders, useCalendarTasks, useCalendarRealtime, calendarKeys } from './hooks';
import { EventDetailModal } from './EventDetailModal';
import { PlanDetailModal } from './components/PlanDetailModal';
import { CalendarFilterBar } from './components/CalendarFilterBar';
import { SlotActionPopover } from './components/SlotActionPopover';
import { TaskModal } from '../tasks/TaskModal';
import { useUpdateWorkOrder } from '../workOrders/hooks';
import { useProfiles } from '../tasks/hooks';
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
  const [sourceFilter, setSourceFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedPlanEvent, setSelectedPlanEvent] = useState(null);

  // Slot action popover state
  const [slotPopover, setSlotPopover] = useState({ open: false, position: null, slotDate: null, slotTime: null });

  // TaskModal for creating plan from slot click
  const [newPlanTask, setNewPlanTask] = useState(null);

  const { dateFrom, dateTo } = useMemo(() => {
    return view === VIEW_MONTH
      ? getMonthRange(currentDate)
      : getWeekRange(currentDate);
  }, [currentDate, view]);

  const dateRangeLabel = useMemo(() => {
    return formatDateRangeLabel(dateFrom, dateTo, view, i18n.language);
  }, [dateFrom, dateTo, view, i18n.language]);

  const {
    events: workOrderEvents,
    isLoading: isWoLoading,
    isError: isWoError,
  } = useCalendarWorkOrders({
    dateFrom,
    dateTo,
    status: statusFilter,
    type: typeFilter,
  });

  const {
    events: taskEvents,
    isLoading: isTasksLoading,
    isError: isTasksError,
  } = useCalendarTasks({
    dateFrom,
    dateTo,
    assigned_to: assigneeFilter,
  });

  const { data: profiles } = useProfiles();

  useCalendarRealtime();

  const events = useMemo(() => {
    if (sourceFilter === 'workOrders') return workOrderEvents;
    if (sourceFilter === 'plans') return taskEvents;
    return [...workOrderEvents, ...taskEvents];
  }, [sourceFilter, workOrderEvents, taskEvents]);

  const isLoading = isWoLoading || isTasksLoading;
  const isError = isWoError || isTasksError;

  const culture = getCalendarCulture(i18n.language);

  const handleSelectEvent = (event) => {
    if (!event) return;
    if (event.resource?._type === 'plan') {
      setSelectedPlanEvent(event);
    } else {
      setSelectedEvent(event);
    }
  };

  const handleSelectSlot = useCallback((slotInfo) => {
    const { date, time } = dateToQueryParams(slotInfo.start);

    // Try to get screen position from the click event or the slot box
    const box = slotInfo.box || slotInfo.bounds;
    const x = box?.x ?? box?.left ?? 300;
    const y = box?.y ?? box?.top ?? 300;

    // Clamp to viewport
    const clampedX = Math.min(x, window.innerWidth - 200);
    const clampedY = Math.min(y, window.innerHeight - 120);

    setSlotPopover({
      open: true,
      position: { x: clampedX, y: clampedY },
      slotDate: date,
      slotTime: time,
    });
  }, []);

  const handleSlotAddWorkOrder = () => {
    const { slotDate, slotTime } = slotPopover;
    navigate(`/work-orders/new?date=${encodeURIComponent(slotDate)}&time=${encodeURIComponent(slotTime)}`);
  };

  const handleSlotAddPlan = () => {
    const { slotDate, slotTime } = slotPopover;
    setNewPlanTask({
      title: '',
      description: '',
      status: 'pending',
      priority: 'normal',
      assigned_to: '',
      due_date: slotDate,
      due_time: slotTime,
    });
  };

  const handleEventDrop = ({ event, start }) => {
    // Only allow drag-drop for work orders, not plan items
    if (event?.resource?._type === 'plan') return;
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

  const assigneeOptions = useMemo(() => {
    const opts = [{ value: 'all', label: t('toolbar.assigned') + ': ' + t('filter.all') }];
    if (Array.isArray(profiles)) {
      profiles.forEach((p) => {
        opts.push({ value: p.id, label: p.full_name || p.id });
      });
    }
    return opts;
  }, [profiles, t]);

  const showWoFilters = sourceFilter !== 'plans';

  return (
    <PageContainer maxWidth="full" padding="default">
      <PageHeader title={t('nav.calendar')} />

      {/* Toolbar */}
      <div className="space-y-3 mb-4 mt-2">
        {/* Row 1: View toggle + Source filter + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
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

            {/* Source filter */}
            <CalendarFilterBar value={sourceFilter} onChange={setSourceFilter} />
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
          <div className="flex items-center gap-2 flex-wrap">
            {showWoFilters && (
              <>
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
              </>
            )}
            <Select
              options={assigneeOptions}
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              size="sm"
              wrapperClassName="w-40"
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
            draggableAccessor={(event) => event?.resource?._type !== 'plan'}
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

      {/* Slot action popover */}
      <SlotActionPopover
        open={slotPopover.open}
        position={slotPopover.position}
        onAddWorkOrder={handleSlotAddWorkOrder}
        onAddPlan={handleSlotAddPlan}
        onClose={() => setSlotPopover({ open: false, position: null, slotDate: null, slotTime: null })}
      />

      {/* Event detail modals */}
      <EventDetailModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />

      <PlanDetailModal
        open={!!selectedPlanEvent}
        onClose={() => setSelectedPlanEvent(null)}
        event={selectedPlanEvent}
      />

      {/* TaskModal for creating plans from slot click */}
      <TaskModal
        open={!!newPlanTask}
        onClose={() => setNewPlanTask(null)}
        task={newPlanTask}
      />
    </PageContainer>
  );
}
