import { forwardRef, isValidElement } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  primary: 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30',
  secondary: 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
  ghost: 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
  danger: 'text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/30',
};

const sizes = {
  sm: 'p-1.5 min-w-[32px] min-h-[32px]',
  md: 'p-2.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
  lg: 'p-3 min-w-[52px] min-h-[52px]',
};

export const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    variant = 'secondary',
    size = 'md',
    className,
    'aria-label': ariaLabel,
    ...props
  },
  ref
) {
  if (!ariaLabel) {
    console.warn('IconButton requires an aria-label for accessibility');
  }

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
        variants[variant],
        sizes[size],
        className
      )}
      aria-label={ariaLabel}
      {...props}
    >
      {Icon && (isValidElement(Icon) ? Icon : <Icon className="w-5 h-5" />)}
    </button>
  );
});
