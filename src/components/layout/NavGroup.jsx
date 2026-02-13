import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Collapsible navigation group with icon, label, and child links.
 * Used in Sidebar and MobileNavDrawer.
 */
export function NavGroup({
  id,
  labelKey,
  icon: IconComponent,
  children,
  isCollapsed,
  expanded,
  onToggle,
  onItemClick,
  forceExpanded = false,
  compact = false,
}) {
  const { t } = useTranslation();
  const isExpanded = forceExpanded || expanded;
  const label = t(labelKey?.includes(':') ? labelKey : `common:${labelKey}`);
  const isStatic = forceExpanded;

  const navLinkBaseClass = cn(
    'flex items-center rounded-lg text-sm font-medium transition-colors min-h-[44px] min-w-[44px]',
    compact ? 'gap-3 px-3 py-3' : 'gap-3 px-3 py-2',
    !isCollapsed && !compact && 'min-w-0'
  );

  const headerClass = cn(
    'flex items-center w-full rounded-lg text-sm font-medium min-h-[44px] min-w-[44px]',
    compact ? 'gap-3 px-3 py-3' : 'gap-3 px-3 py-2',
    !isStatic && 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer'
  );

  return (
    <div className="space-y-1">
      {isStatic ? (
        <div className={headerClass} role="group" aria-labelledby={`nav-group-${id}-label`}>
          <IconComponent className="w-5 h-5 flex-shrink-0" />
          <span id={`nav-group-${id}-label`} className="flex-1 truncate text-left font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className={headerClass}
          aria-expanded={isExpanded}
          aria-controls={`nav-group-${id}`}
        >
          <IconComponent className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-left">{label}</span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              )}
            </>
          )}
        </button>
      )}
      <div
        id={`nav-group-${id}`}
        className={cn(
          'overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out grid',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0">
          <div
            className={cn(
              'space-y-1',
              !isCollapsed && 'ml-2 pl-3 border-l border-neutral-200 dark:border-[#262626]'
            )}
          >
            {children.map((child) => {
              const ChildIcon = child.icon;
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.exact}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      navLinkBaseClass,
                      isCollapsed && !compact && 'justify-center',
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                    )
                  }
                >
                  <ChildIcon className="w-5 h-5 flex-shrink-0" />
                  {(!isCollapsed || compact) && (
                    <span className="truncate">
                      {t(child.labelKey?.includes(':') ? child.labelKey : `common:${child.labelKey}`)}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
