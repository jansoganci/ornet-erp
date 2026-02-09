import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-sm',
  interactive: 'bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-sm hover:border-neutral-300 dark:hover:border-[#404040] hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200',
  selected: 'bg-primary-50 dark:bg-primary-950/30 border-2 border-primary-600 dark:border-primary-500 rounded-lg shadow-sm',
};

const paddings = {
  compact: 'p-4',
  default: 'p-6',
};

function handleCardKeyDown(onClick, e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick?.(e);
  }
}

export function Card({
  variant = 'default',
  padding = 'default',
  header,
  footer,
  onClick,
  className,
  children,
  ...props
}) {
  const isClickable = Boolean(onClick);
  const isInteractive = variant === 'interactive' || onClick;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => handleCardKeyDown(onClick, e) : undefined}
      className={cn(
        variants[variant],
        isInteractive && variant !== 'interactive' && 'hover:border-neutral-300 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200',
        isClickable && 'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-0',
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
          {header}
        </div>
      )}
      <div className={cn(paddings[padding], header && 'pt-0', footer && 'pb-0')}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a] rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}
