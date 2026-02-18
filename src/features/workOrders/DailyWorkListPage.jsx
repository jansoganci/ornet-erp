import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Plus, Circle } from 'lucide-react';
import { PageContainer } from '../../components/layout';
import { Spinner, EmptyState, ErrorState, Button, CardSkeleton } from '../../components/ui';
import { useDailyWorkList } from './hooks';
import { useProfiles } from '../tasks/hooks';
import { DailyWorkCard } from './DailyWorkCard';
import { TodayPlansSection } from './TodayPlansSection';
import { useReminders, useCompleteReminder } from '../notifications/hooks';
import { ReminderFormModal } from '../notifications';
import { cn } from '../../lib/utils';

/** Given a date string (YYYY-MM-DD), return the Monday of that week (ISO string). Monday = first day of week. */
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 7 : day) + 1;
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/** Given Monday ISO string, return array of 7 ISO date strings (Mon..Sun). */
function getWeekDates(weekStartStr) {
  const dates = [];
  const start = new Date(weekStartStr + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const WEEKDAY_OPTIONS = { weekday: 'short' };

export function DailyWorkListPage() {
  const { t } = useTranslation(['dailyWork', 'common', 'workOrders']);
  const navigate = useNavigate();

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(todayIso));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [completingReminder, setCompletingReminder] = useState(null);
  const [fadingOut, setFadingOut] = useState(false);

  const { data: workOrders = [], isLoading, error, refetch } = useDailyWorkList(selectedDate, selectedWorkerId);
  const { data: profiles = [], isLoading: isLoadingProfiles } = useProfiles();
  const { data: reminders = [] } = useReminders();
  const completeReminder = useCompleteReminder();

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const goPrevWeek = () => {
    const m = new Date(weekStart + 'T12:00:00');
    m.setDate(m.getDate() - 7);
    const nextMonday = m.toISOString().split('T')[0];
    setWeekStart(nextMonday);
    setSelectedDate(nextMonday);
  };

  const goNextWeek = () => {
    const m = new Date(weekStart + 'T12:00:00');
    m.setDate(m.getDate() + 7);
    const nextMonday = m.toISOString().split('T')[0];
    setWeekStart(nextMonday);
    setSelectedDate(nextMonday);
  };

  const showTodayPlans = selectedDate === todayIso;

  const todayReminders = useMemo(() => {
    const base = reminders.filter((r) => !r.completed_at && r.remind_date === selectedDate);
    if (completingReminder) {
      return base.filter((r) => r.id !== completingReminder.id);
    }
    return base;
  }, [reminders, selectedDate, completingReminder]);

  const handleCompleteReminder = (reminder) => {
    setCompletingReminder(reminder);
    setFadingOut(false);
    completeReminder.mutate(reminder.id);
  };

  useEffect(() => {
    if (!completingReminder) return;
    const startFade = setTimeout(() => setFadingOut(true), 10);
    const clear = setTimeout(() => {
      setCompletingReminder(null);
      setFadingOut(false);
    }, 310);
    return () => {
      clearTimeout(startFade);
      clearTimeout(clear);
    };
  }, [completingReminder]);

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <div className="mt-12">
          <CardSkeleton count={4} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-5">
      {/* Week bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goPrevWeek}
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-50 dark:hover:bg-[#262626] transition-colors"
          aria-label={t('dailyWork:week.prevWeek')}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDates.map((dateIso) => {
            const d = new Date(dateIso + 'T12:00:00');
            const dayNum = d.getDate();
            const weekdayShort = new Intl.DateTimeFormat('tr-TR', WEEKDAY_OPTIONS).format(d);
            const isToday = dateIso === todayIso;
            const isSelected = dateIso === selectedDate;
            return (
              <button
                key={dateIso}
                type="button"
                onClick={() => setSelectedDate(dateIso)}
                className={cn(
                  'py-2 px-1 rounded-lg text-center text-sm font-medium transition-colors',
                  isToday && 'bg-neutral-200 dark:bg-[#262626] text-neutral-900 dark:text-neutral-50',
                  isSelected && !isToday && 'ring-2 ring-primary-500 dark:ring-primary-400 text-neutral-900 dark:text-neutral-50',
                  !isToday && !isSelected && 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-[#262626]'
                )}
                aria-label={`${weekdayShort} ${dayNum}`}
                aria-pressed={isSelected}
              >
                <span className="block text-[10px] uppercase text-neutral-500 dark:text-neutral-400">{weekdayShort}</span>
                <span className="block tabular-nums">{dayNum}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={goNextWeek}
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-50 dark:hover:bg-[#262626] transition-colors"
          aria-label={t('dailyWork:week.nextWeek')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Worker filter – minimal one row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => setSelectedWorkerId('')}
          className={cn(
            'text-left transition-colors',
            selectedWorkerId === ''
              ? 'font-semibold text-neutral-900 dark:text-neutral-50'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50'
          )}
        >
          {t('dailyWork:filters.allWorkers')}
        </button>
        {profiles.map((p) => (
          <span key={p.id} className="flex items-center gap-x-2">
            <span className="text-neutral-300 dark:text-[#404040]">|</span>
            <button
              type="button"
              onClick={() => setSelectedWorkerId(p.id)}
              disabled={isLoadingProfiles}
              className={cn(
                'text-left transition-colors disabled:opacity-50',
                selectedWorkerId === p.id
                  ? 'font-semibold text-neutral-900 dark:text-neutral-50'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50'
              )}
            >
              {p.full_name}
            </button>
          </span>
        ))}
        </div>
        {selectedDate === todayIso && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReminderModalOpen(true)}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('notifications:reminder.addButton')}
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" />
          <p className="text-sm text-neutral-500 animate-pulse">{t('common:loading')}</p>
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={t('dailyWork:empty.title')}
          description={t('dailyWork:empty.description')}
          actionLabel={t('workOrders:list.addButton')}
          onAction={() => navigate('/work-orders/new')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {workOrders.map((wo) => (
              <DailyWorkCard
                key={wo.id}
                workOrder={wo}
                onClick={(order) => navigate(`/work-orders/${order.id}`)}
              />
            ))}
          </div>

          {selectedDate === todayIso && (todayReminders.length > 0 || completingReminder) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {t('notifications:reminder.myReminders')}
              </h3>
              <div className="space-y-1">
                {todayReminders.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleCompleteReminder(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-neutral-50 dark:bg-[#1a1a1a] hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors text-left"
                  >
                    <Circle className="w-5 h-5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                    <span className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                      {r.title}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                      {format(new Date(r.remind_date + 'T12:00:00'), 'd MMMM', { locale: tr })}
                      {r.remind_time ? ` · ${r.remind_time}` : ''}
                    </span>
                  </button>
                ))}
                {completingReminder && (
                  <div
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg bg-neutral-50 dark:bg-[#1a1a1a] transition-opacity duration-300',
                      fadingOut ? 'opacity-0' : 'opacity-100'
                    )}
                    aria-hidden
                  >
                    <Circle className="w-5 h-5 flex-shrink-0 text-neutral-400" />
                    <span className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                      {completingReminder.title}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {format(new Date(completingReminder.remind_date + 'T12:00:00'), 'd MMMM', { locale: tr })}
                      {completingReminder.remind_time ? ` · ${completingReminder.remind_time}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showTodayPlans && (
        <TodayPlansSection
          selectedDate={selectedDate}
          selectedWorkerId={selectedWorkerId}
        />
      )}

      <ReminderFormModal
        open={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
      />
    </PageContainer>
  );
}
