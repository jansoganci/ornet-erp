import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Renders icon: component ref as element, or passthrough if already element/node */
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

export const Select = forwardRef(function Select(
  {
    label,
    options = [],
    placeholder,
    hint,
    error,
    size = 'md',
    leftIcon: LeftIcon,
    icon: Icon,
    className,
    wrapperClassName,
    disabled,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = props.id || generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint && !error ? `${selectId}-hint` : undefined;

  const ActiveLeftIcon = LeftIcon || Icon;

  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label
          htmlFor={selectId}
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
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId || hintId}
          className={cn(
            'block w-full rounded-lg border shadow-sm transition-colors appearance-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600',
            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
            ActiveLeftIcon ? 'pl-10' : 'pl-3',
            'pr-10',
            sizes[size],
            error
              ? 'border-error-500 focus-visible:border-error-500 focus-visible:ring-error-500/20'
              : 'border-neutral-300 dark:border-[#262626] focus-visible:border-primary-600 focus-visible:ring-primary-600/20',
            disabled && 'bg-neutral-100 dark:bg-[#262626] cursor-not-allowed text-neutral-500 dark:text-neutral-400',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown className="h-5 w-5 text-neutral-400" />
        </div>
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
