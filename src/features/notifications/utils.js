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

export const ICON_MAP = {
  open_work_order: { Icon: Wrench, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  overdue_work_order: { Icon: AlertTriangle, bg: 'bg-error-100 dark:bg-error-900/40', text: 'text-error-600 dark:text-error-400' },
  today_not_started: { Icon: Clock, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  proposal_awaiting_response: { Icon: FileText, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  proposal_no_response_2d: { Icon: FileWarning, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  proposal_approved_no_wo: { Icon: FileCheck, bg: 'bg-success-100 dark:bg-success-900/40', text: 'text-success-600 dark:text-success-400' },
  subscription_cancelled: { Icon: XCircle, bg: 'bg-error-100 dark:bg-error-900/40', text: 'text-error-600 dark:text-error-400' },
  subscription_paused: { Icon: PauseCircle, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  payment_due_soon: { Icon: CreditCard, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  renewal_due_soon: { Icon: RefreshCw, bg: 'bg-info-100 dark:bg-info-900/40', text: 'text-info-600 dark:text-info-400' },
  work_order_assigned: { Icon: UserPlus, bg: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-600 dark:text-primary-400' },
  task_due_soon: { Icon: CheckSquare, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
  user_reminder: { Icon: BellRing, bg: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-600 dark:text-primary-400' },
  sim_card_cancelled: { Icon: Smartphone, bg: 'bg-error-100 dark:bg-error-900/40', text: 'text-error-600 dark:text-error-400' },
  pending_payments_summary: { Icon: Banknote, bg: 'bg-warning-100 dark:bg-warning-900/40', text: 'text-warning-600 dark:text-warning-400' },
};

export const DEFAULT_ICON = { Icon: Info, bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400' };

export function getRoute(entityType, entityId, notificationType) {
  if (notificationType === 'pending_payments_summary') return '/subscriptions/collection';
  if (entityType === 'subscription' && !entityId) return '/subscriptions';
  if (!entityId && entityType !== 'task') return null;
  switch (entityType) {
    case 'work_order': return `/work-orders/${entityId}`;
    case 'proposal': return `/proposals/${entityId}`;
    case 'subscription': return entityId ? `/subscriptions/${entityId}` : '/subscriptions';
    case 'task': return '/tasks';
    case 'sim_card': return `/sim-cards/${entityId}/edit`;
    case 'reminder': return null;
    default: return null;
  }
}
