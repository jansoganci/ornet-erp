import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-500 dark:active:bg-primary-700 shadow-sm',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-[#171717] dark:text-neutral-50 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 shadow-sm',
  outline: 'bg-transparent border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 dark:border-primary-500 dark:text-primary-500 dark:hover:bg-primary-950/30 dark:active:bg-primary-950/50',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-[#262626] dark:active:bg-neutral-700',
  danger: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 dark:bg-error-600 dark:hover:bg-error-500 dark:active:bg-error-700 shadow-sm',
  success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 dark:bg-success-600 dark:hover:bg-success-500 dark:active:bg-success-700 shadow-sm',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm min-h-[44px] md:min-h-0',
  lg: 'px-6 py-3 text-base min-h-[48px] md:min-h-0',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-0',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2" />}
      {!loading && LeftIcon && <span className="mr-2">{LeftIcon}</span>}
      {children}
      {!loading && RightIcon && <span className="ml-2">{RightIcon}</span>}
    </button>
  );
});
