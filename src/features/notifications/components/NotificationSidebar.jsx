import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, Clock, Plus } from 'lucide-react';
import { startOfWeek, isAfter, parseISO } from 'date-fns';
import { Card, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { ReminderFormModal } from './ReminderFormModal';

// ─── Types categorized as "alerts" ──────────────────────────

const ALERT_TYPES = new Set([
  'overdue_work_order',
  'subscription_cancelled',
  'subscription_paused',
  'sim_card_cancelled',
  'payment_due_soon',
  'pending_payments_summary',
]);

// ─── Notification Health Card ───────────────────────────────

function HealthCard({ notifications }) {
  const { t } = useTranslation('notifications');

  const stats = useMemo(() => {
    if (!notifications?.length) return { alertsThisWeek: 0, storedCount: 0, overdueCount: 0 };

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    let alertsThisWeek = 0;
    let storedCount = 0;
    let overdueCount = 0;

    for (const n of notifications) {
      if (n.notification_source === 'stored') storedCount++;
      if (n.notification_type === 'overdue_work_order') overdueCount++;

      if (ALERT_TYPES.has(n.notification_type) && n.created_at) {
        try {
          if (isAfter(parseISO(n.created_at), weekStart)) alertsThisWeek++;
        } catch { /* skip bad dates */ }
      }
    }

    return { alertsThisWeek, storedCount, overdueCount };
  }, [notifications]);

  const maxAlerts = 20;
  const alertPercent = Math.min((stats.alertsThisWeek / maxAlerts) * 100, 100);
  const overduePercent = Math.min((stats.overdueCount / 10) * 100, 100);

  return (
    <Card className="p-5">
      <h4 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-4">
        {t('sidebar.health')}
      </h4>
      <div className="space-y-4">
        {/* Alerts This Week */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('sidebar.alertsThisWeek')}</span>
            <span className="text-sm font-bold text-red-500">{stats.alertsThisWeek}</span>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-red-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${alertPercent}%` }}
            />
          </div>
        </div>

        {/* Stored Notifications */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('sidebar.storedNotifications')}</span>
            <span className="text-sm font-bold text-primary-500">{stats.storedCount}</span>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-primary-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min((stats.storedCount / 30) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Overdue Items */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('sidebar.overdueItems')}</span>
            <span className={cn('text-sm font-bold', stats.overdueCount > 0 ? 'text-amber-500' : 'text-neutral-400')}>
              {stats.overdueCount}
            </span>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', stats.overdueCount > 0 ? 'bg-amber-500' : 'bg-neutral-300')}
              style={{ width: `${overduePercent}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Quick Reminder Card ────────────────────────────────────

function QuickReminderCard() {
  const { t } = useTranslation('notifications');
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Card className="p-5">
        <h4 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-4">
          {t('sidebar.quickReminder')}
        </h4>
        <Button
          variant="outline"
          className="w-full"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          {t('reminder.addButton')}
        </Button>
      </Card>
      <ReminderFormModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────

export function NotificationSidebar({ notifications, loading }) {
  if (loading) return null;

  return (
    <div className="space-y-6">
      <HealthCard notifications={notifications} />
      <QuickReminderCard />
    </div>
  );
}
