import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Breadcrumb item interface
 * @typedef {Object} BreadcrumbItem
 * @property {string} label - Display label
 * @property {string} [to] - Optional route path
 */

/**
 * Tab item interface
 * @typedef {Object} TabItem
 * @property {string} id - Unique tab identifier
 * @property {string} label - Display label
 * @property {() => void} onClick - Click handler
 * @property {boolean} [isActive] - Active state
 */

/**
 * PageHeader Component
 * 
 * Standardized page header with title, breadcrumbs, actions, and optional tabs.
 * Responsive layout: stacked on mobile, horizontal on tablet+.
 * 
 * @param {Object} props
 * @param {string} props.title - Page title (required)
 * @param {string} [props.description] - Subtitle/description below title
 * @param {BreadcrumbItem[]} [props.breadcrumbs] - Breadcrumb navigation items
 * @param {React.ReactNode} [props.actions] - Right-aligned action buttons
 * @param {TabItem[]} [props.tabs] - Optional tabs below title row
 * @param {string} [props.className] - Additional CSS classes
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  tabs,
  className,
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            return (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                )}
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast
                        ? 'text-neutral-900 dark:text-neutral-50 font-medium'
                        : 'text-neutral-500 dark:text-neutral-400'
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Title Section */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold font-heading text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          {description && (
            <div className="mt-2 text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
              {description}
            </div>
          )}
        </div>

        {/* Actions Section */}
        {actions && (
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-2 -mb-2 border-b border-neutral-200 dark:border-[#262626]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap',
                tab.isActive
                  ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-500'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
