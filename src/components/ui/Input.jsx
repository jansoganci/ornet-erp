import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

/** Renders icon: component ref (e.g. Search) as element, or passthrough if already element/node */
function renderIcon(Icon, className) {
  if (Icon == null) return null;
  if (React.isValidElement(Icon)) return Icon;
  const isComponent =
    typeof Icon === 'function' ||
    (typeof Icon === 'object' && Icon !== null && Icon.$$typeof != null);
  if (isComponent) return React.createElement(Icon, { className });
  return Icon;
}

const sizes = {
  sm: 'h-8 text-sm',
  md: 'h-12 md:h-10 text-base',
  lg: 'h-14 md:h-12 text-lg',
};

export const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    size = 'md',
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    icon: Icon,
    className,
    wrapperClassName,
    disabled,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;

  const ActiveLeftIcon = LeftIcon || Icon;

  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {ActiveLeftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="h-5 w-5 text-neutral-400 flex items-center justify-center">
              {renderIcon(ActiveLeftIcon, 'h-5 w-5 text-neutral-400')}
            </span>
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId || hintId}
          className={cn(
            'block w-full rounded-lg border shadow-sm transition-colors',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
            sizes[size],
            ActiveLeftIcon ? 'pl-10' : 'pl-3',
            RightIcon ? 'pr-10' : 'pr-3',
            error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20'
              : 'border-neutral-300 dark:border-[#262626] focus:border-primary-600 focus:ring-primary-600/20',
            disabled && 'bg-neutral-100 dark:bg-[#262626] cursor-not-allowed text-neutral-500 dark:text-neutral-400',
            className
          )}
          {...props}
        />
        {RightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="h-5 w-5 text-neutral-400 flex items-center justify-center">
              {renderIcon(RightIcon, 'h-5 w-5 text-neutral-400')}
            </span>
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
});
