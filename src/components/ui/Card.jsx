import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border border-neutral-200 dark:border-[#262626] rounded-lg shadow-sm',
  interactive: 'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border border-neutral-200 dark:border-[#262626] rounded-lg shadow-sm hover:border-primary-600/80 dark:hover:border-primary-500/80 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200',
  selected: 'bg-primary-50 dark:bg-primary-950/30 border-2 border-primary-600 dark:border-primary-500 rounded-lg shadow-sm',
};

const paddings = {
  tight: 'p-3',
  compact: 'p-4',
  default: 'p-6',
};

function handleCardKeyDown(onClick, e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick?.(e);
  }
}

// Main Card component (backward compatible)
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
        isInteractive && variant !== 'interactive' && 'hover:border-primary-600/80 dark:hover:border-primary-500/80 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200',
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
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/50 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}

// Composite Card Components (new pattern)
export const CardHeader = forwardRef(function CardHeader(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
});

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(function CardTitle(
  { className, ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight text-neutral-900 dark:text-neutral-50',
        className
      )}
      {...props}
    />
  );
});

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(function CardDescription(
  { className, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn(
        'text-sm text-neutral-500 dark:text-neutral-400',
        className
      )}
      {...props}
    />
  );
});

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(function CardContent(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('p-6 pt-0', className)}
      {...props}
    />
  );
});

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef(function CardFooter(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center p-6 pt-0 border-t border-neutral-200 dark:border-[#262626]',
        className
      )}
      {...props}
    />
  );
});

CardFooter.displayName = 'CardFooter';
