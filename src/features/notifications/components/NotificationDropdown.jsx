import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useActiveNotifications, useResolveNotification } from '../hooks';
import { NotificationItem } from './NotificationItem';
import { Button, Skeleton } from '../../../components/ui';

/**
 * NotificationDropdown - Notification list panel
 *
 * Desktop: Popover dropdown (400px width)
 * Mobile: Bottom sheet with backdrop
 *
 * @param {boolean} isOpen - Dropdown visibility
 * @param {function} onClose - Close callback
 */
export function NotificationDropdown({ isOpen, onClose, total }) {
  const { t } = useTranslation('notifications');
  const dropdownRef = useRef(null);
  const bodyRef = useRef(null);
  const { data: notifications, isLoading, error, refetch } = useActiveNotifications(1);
  const resolveMutation = useResolveNotification();

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Tab focus trap: cycle within dropdown
  useEffect(() => {
    if (!isOpen) return;
    const container = dropdownRef.current;
    if (!container) return;

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = container.querySelectorAll('button, [role="menuitem"]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus management: focus first item on open
  useEffect(() => {
    if (!isOpen) return;
    const timer = requestAnimationFrame(() => {
      const first = bodyRef.current?.querySelector('button') || bodyRef.current;
      first?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [isOpen, notifications, isLoading, error]);

  const handleNavigate = () => {
    onClose();
  };

  const handleResolve = (id) => {
    resolveMutation.mutate(id);
  };

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isOpen) return null;

  const content = (
    <div
      id="notification-dropdown"
      role="menu"
      aria-label={t('title')}
      className="flex flex-col w-full max-w-[400px] bg-white dark:bg-[#171717] rounded-lg shadow-lg border border-neutral-200 dark:border-[#262626] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-[#262626]">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('title')}
          {total != null && total > 0 && (
            <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
              ({total})
            </span>
          )}
        </h2>
      </div>

      {/* Body - tabIndex for focus fallback when loading/empty */}
      <div
        ref={bodyRef}
        tabIndex={(!notifications?.length && !error) ? -1 : undefined}
        className="max-h-[min(600px,70vh)] overflow-y-auto overscroll-contain"
      >
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="p-4 flex flex-col items-center gap-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('error.loadFailed')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('actions.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !error && (!notifications || notifications.length === 0) && (
          <div className="p-8 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Bell className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('empty.title')}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('empty.description')}
            </p>
          </div>
        )}

        {!isLoading && !error && notifications?.length > 0 && (
          <div className="py-1">
            {notifications.map((n) => (
              <NotificationItem
                key={n.notification_id || `${n.entity_type}-${n.entity_id}-${n.created_at}`}
                notification_type={n.notification_type}
                title={n.title}
                body={n.body}
                entity_type={n.entity_type}
                entity_id={n.entity_id}
                created_at={n.created_at}
                notification_id={n.notification_id}
                notification_source={n.notification_source}
                onResolve={handleResolve}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
      >
        <div
          className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
        <div
          ref={dropdownRef}
          className="relative w-full max-h-[70vh] bg-white dark:bg-[#171717] rounded-t-2xl shadow-xl overflow-hidden flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 rounded-full bg-neutral-200 dark:bg-[#262626]" />
          </div>
          {content}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 z-50 w-[400px] animate-slide-down"
    >
      {content}
    </div>
  );
}
