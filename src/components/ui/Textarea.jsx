import { forwardRef, useId, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export const Textarea = forwardRef(function Textarea(
  {
    label,
    hint,
    error,
    className,
    wrapperClassName,
    disabled,
    autoResize = true,
    rows = 3,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  
  const innerRef = useRef(null);
  
  // Combine external ref and internal ref
  const setRefs = (node) => {
    innerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  useEffect(() => {
    if (autoResize && innerRef.current) {
      const textarea = innerRef.current;
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      
      textarea.addEventListener('input', adjustHeight);
      adjustHeight(); // Initial adjustment
      
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, [autoResize]);

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
        <textarea
          ref={setRefs}
          id={inputId}
          disabled={disabled}
          rows={rows}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId || hintId}
          className={cn(
            'block w-full rounded-lg border shadow-sm transition-colors',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600',
            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
            'px-3 py-2 text-base md:text-sm',
            error
              ? 'border-error-500 focus-visible:border-error-500 focus-visible:ring-error-500/20'
              : 'border-neutral-300 dark:border-[#262626]',
            disabled && 'bg-neutral-100 dark:bg-[#262626] cursor-not-allowed text-neutral-500 dark:text-neutral-400',
            autoResize && 'overflow-hidden resize-none',
            className
          )}
          {...props}
        />
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
