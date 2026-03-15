import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilePlus, UserPlus, CalendarCheck, Target, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * QuickActionsBar — Compact button strip.
 * Sits as the second line of the dashboard welcome section.
 *
 * Props:
 *   isAdmin — boolean, controls visibility of action board button
 */
export function QuickActionsBar({ isAdmin = false }) {
  const { t } = useTranslation('dashboard');

  const actions = [
    { label: t('quickActions.addWorkOrder'), icon: FilePlus,      href: '/work-orders/new' },
    { label: t('quickActions.addCustomer'),  icon: UserPlus,      href: '/customers/new'   },
    { label: t('quickActions.dailyWork'),    icon: CalendarCheck, href: '/daily-work'       },
    { label: t('quickActions.tasks'),        icon: Target,        href: '/tasks'            },
    ...(isAdmin
      ? [{ label: t('quickActions.actionBoard'), icon: AlertCircle, href: '/action-board', danger: true }]
      : []),
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map(({ label, icon: Icon, href, danger }) => (
        <Link
          key={href}
          to={href}
          className={cn(
            'flex items-center gap-1.5 flex-shrink-0 rounded-lg border px-2.5 py-1.5',
            'text-xs font-medium whitespace-nowrap transition-all duration-150 hover:-translate-y-px',
            danger
              ? [
                  'border-red-200 text-red-600 bg-white hover:bg-red-50 hover:border-red-300',
                  'dark:bg-gray-800/40 dark:border-red-900/40 dark:text-red-400',
                  'dark:hover:bg-red-950/20 dark:hover:border-red-800/60',
                ]
              : [
                  'bg-white border-gray-200 text-neutral-600 hover:bg-gray-50 hover:border-gray-300',
                  'dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10',
                  'dark:text-neutral-300 dark:hover:bg-gray-800/60 dark:hover:border-white/20',
                ]
          )}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </div>
  );
}
