import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wrench,
  AlertTriangle,
  Clock,
  FileText,
  FileExclamationPoint,
  FileCheck,
  XCircle,
  PauseCircle,
  CreditCard,
  RefreshCw,
  UserPlus,
  CheckSquare,
  BellRing,
  Check,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { fetchSubscriptionIdByPaymentId } from '../api';

/**
 * NotificationItem - Single notification row
 *
 * Displays icon, title, body, timestamp.
 * Click → navigates to related entity.
 * Resolve button for stored notifications only.
 *
 * @param {Object} props - Props from v_active_notifications
 */
const ICON_MAP = {
  open_work_order: { Icon: Wrench, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  overdue_work_order: { Icon: AlertTriangle, bg: 'bg-error-100 dark:bg-error-900/40', text: 'text-error-600 dark:text-error-400' },
  today_not_started: { Icon: Clock, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  proposal_awaiting_response: { Icon: FileText, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  proposal_no_response_2d: { Icon: FileExclamationPoint, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  proposal_approved_no_wo: { Icon: FileCheck, bg: 'bg-success-100 dark:bg-success-900/40', text: 'text-success-600 dark:text-success-400' },
  subscription_cancelled: { Icon: XCircle, bg: 'bg-error-100 dark:bg-error-900/40', text: 'text-error-600 dark:text-error-400' },
  subscription_paused: { Icon: PauseCircle, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  payment_due_soon: { Icon: CreditCard, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  renewal_due_soon: { Icon: RefreshCw, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  work_order_assigned: { Icon: UserPlus, bg: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-600 dark:text-primary-400' },
  task_due_soon: { Icon: CheckSquare, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  user_reminder: { Icon: BellRing, bg: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-600 dark:text-primary-400' },
};

function getRoute(entityType, entityId) {
  switch (entityType) {
    case 'work_order':
      return `/work-orders/${entityId}`;
    case 'proposal':
      return `/proposals/${entityId}`;
    case 'subscription':
      return `/subscriptions/${entityId}`;
    case 'subscription_payment':
      return null;
    case 'task':
      return '/tasks';
    case 'reminder':
      return null;
    default:
      return null;
  }
}

export function NotificationItem({
  notification_type,
  title,
  body,
  entity_type,
  entity_id,
  created_at,
  notification_id,
  notification_source,
  onResolve,
  onNavigate,
}) {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();

  const config = ICON_MAP[notification_type] ?? { Icon: FileText, bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400' };
  const { Icon, bg, text } = config;

  const relativeTime = created_at
    ? formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: tr })
    : '';

  const handleClick = async () => {
    if (entity_type === 'subscription_payment' && entity_id) {
      const subscriptionId = await fetchSubscriptionIdByPaymentId(entity_id);
      if (subscriptionId) {
        navigate(`/subscriptions/${subscriptionId}`);
      } else {
        navigate('/subscriptions');
      }
    } else {
      const route = getRoute(entity_type, entity_id);
      if (route) navigate(route);
    }
    onNavigate?.();
  };

  return (
    <div className="border-b border-neutral-100 dark:border-[#1f1f1f] last:border-b-0">
      <button
        type="button"
        role="menuitem"
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600"
        onClick={handleClick}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', bg, text)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {title}
          </p>
          {body && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {body}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {relativeTime}
            </span>
            {notification_source === 'stored' && notification_id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(notification_id);
                }}
                className="text-[11px] font-medium text-neutral-400 hover:text-success-600 dark:text-neutral-500 dark:hover:text-success-400 transition-colors"
                aria-label={t('actions.resolve')}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
