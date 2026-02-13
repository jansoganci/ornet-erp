import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui';
import { NavGroup } from './NavGroup';
import { navItems } from './navItems';
import { useCurrentProfile } from '../../features/subscriptions/hooks';

function isFlatItem(item) {
  return !item.type || item.type !== 'group';
}

export function MobileNavDrawer({ open, onClose }) {
  const { t } = useTranslation();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, handleEscape]);

  const handleItemClick = () => {
    onClose();
  };

  const tCommon = (key) => t(key?.includes(':') ? key : `common:${key}`);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t('common:nav.more')}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet Panel */}
      <div
        className="relative w-full max-h-[70vh] bg-white dark:bg-[#171717] rounded-t-2xl shadow-xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 rounded-full bg-neutral-200 dark:bg-[#262626]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-[#262626]">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {t('common:nav.more')}
          </h2>
          <IconButton
            icon={<X className="w-5 h-5" />}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('common:actions.close')}
          />
        </div>

        {/* Nav Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-4">
          <nav className="space-y-1 px-4">
            {visibleNavItems.map((item) =>
              isFlatItem(item) ? (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={handleItemClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{tCommon(item.labelKey)}</span>
                </NavLink>
              ) : (
                <NavGroup
                  key={item.id}
                  id={item.id}
                  labelKey={item.labelKey}
                  icon={item.icon}
                  children={item.children}
                  isCollapsed={false}
                  expanded={true}
                  forceExpanded={true}
                  onToggle={() => {}}
                  onItemClick={handleItemClick}
                  compact={true}
                />
              )
            )}
          </nav>
        </div>
      </div>
    </div>,
    document.body
  );
}
