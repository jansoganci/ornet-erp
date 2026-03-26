import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wrench,
  AlertTriangle,
  Clock,
  FileText,
  FileWarning,
  FileCheck,
  XCircle,
  PauseCircle,
  CreditCard,
  RefreshCw,
  UserPlus,
  CheckSquare,
  BellRing,
  Smartphone,
  Banknote,
  Info,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localizeNotificationTitle } from '../../../lib/workOrderNotificationTitle';

// ─── Icon + color mapping per notification type ─────────────

const ICON_MAP = {
  open_work_order: { Icon: Wrench, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  overdue_work_order: { Icon: AlertTriangle, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  today_not_started: { Icon: Clock, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  proposal_awaiting_response: { Icon: FileText, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  proposal_no_response_2d: { Icon: FileWarning, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  proposal_approved_no_wo: { Icon: FileCheck, bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  subscription_cancelled: { Icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  subscription_paused: { Icon: PauseCircle, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  payment_due_soon: { Icon: CreditCard, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  renewal_due_soon: { Icon: RefreshCw, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  work_order_assigned: { Icon: UserPlus, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  task_due_soon: { Icon: CheckSquare, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  user_reminder: { Icon: BellRing, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  sim_card_cancelled: { Icon: Smartphone, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  pending_payments_summary: { Icon: Banknote, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
};

const DEFAULT_ICON = { Icon: Info, bg: 'bg-neutral-500/10', text: 'text-neutral-400', border: 'border-neutral-500/20' };

function getRoute(entityType, entityId, notificationType) {
  if (notificationType === 'pending_payments_summary') return '/subscriptions/collection';
  if (entityType === 'subscription' && !entityId) return '/subscriptions';
  if (!entityId && entityType !== 'task') return null;
  switch (entityType) {
    case 'work_order': return `/work-orders/${entityId}`;
    case 'proposal': return `/proposals/${entityId}`;
    case 'subscription': return entityId ? `/subscriptions/${entityId}` : '/subscriptions';
    case 'task': return '/tasks';
    case 'sim_card': return `/sim-cards/${entityId}/edit`;
    default: return null;
  }
}

export function NotificationFeedCard({
  notification_type,
  title,
  body,
  entity_type,
  entity_id,
  created_at,
  resolved_at,
  notification_id,
  notification_source,
  onResolve,
  isResolved = false,
}) {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  const displayTitle = localizeNotificationTitle(title, entity_type, (key) =>
    tCommon(`workType.${key}`)
  );

  const isUnread = !isResolved && notification_source === 'stored' && !resolved_at;
  const config = ICON_MAP[notification_type] ?? DEFAULT_ICON;
  const { Icon, bg, text, border } = config;

  const timestamp = isResolved ? resolved_at : created_at;
  const relativeTime = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: false, locale: tr })
    : '';

  const route = getRoute(entity_type, entity_id, notification_type);

  const handleClick = () => {
    if (route) navigate(route);
  };

  const handleResolve = (e) => {
    e.stopPropagation();
    if (notification_source === 'stored' && notification_id) {
      onResolve?.(notification_id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'group relative flex items-start gap-4 p-5 rounded-xl transition-all cursor-pointer',
        isUnread
          ? 'bg-white dark:bg-[#201f1f] border-l-4 border-l-blue-500 shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
          : 'bg-neutral-50 dark:bg-[#0e0e0e] border border-neutral-200/60 dark:border-neutral-800/40 opacity-80 hover:opacity-100'
      )}
    >
      {/* Icon */}
      <div className="relative flex-shrink-0">
        <div className={cn('h-11 w-11 rounded-full flex items-center justify-center border', bg, text, border)}>
          <Icon className="w-5 h-5" />
        </div>
        {/* Pulse indicator for unread */}
        {isUnread && (
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full ring-2 ring-white dark:ring-[#201f1f] animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className={cn('text-sm truncate', isUnread ? 'font-bold text-neutral-900 dark:text-neutral-50' : 'font-medium text-neutral-700 dark:text-neutral-300')}>
            {displayTitle}
          </h3>
          <span className={cn(
            'text-[10px] font-medium whitespace-nowrap flex-shrink-0 uppercase tracking-wide',
            isUnread
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded'
              : 'text-neutral-400 dark:text-neutral-500'
          )}>
            {relativeTime}
          </span>
        </div>

        {body && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 mb-2.5">
            {body}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {route && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(route); }}
              className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-wide"
            >
              {t('actions.viewLogs')}
            </button>
          )}
          {!isResolved && notification_source === 'stored' && notification_id && (
            <>
              {route && <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>}
              <button
                type="button"
                onClick={handleResolve}
                className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 uppercase tracking-wide"
              >
                {t('actions.dismiss')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
