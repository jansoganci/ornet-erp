import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Custom dropdown select - avoids native OS picker on mobile.
 * Placeholder shown inside the box when value is empty or in emptyValues; no separate label.
 *
 * @param {object} props
 * @param {Array<{value: string, label: string, disabled?: boolean}>} props.options
 * @param {string} props.value - Current value
 * @param {function} props.onChange - (value: string) => void
 * @param {string} props.placeholder - Shown inside box when value is empty (e.g. "Yıl Seç")
 * @param {string[]} [props.emptyValues] - Values treated as empty for placeholder display (default: ['', 'all'])
 * @param {React.ReactNode} [props.leftIcon] - Icon on the left
 * @param {string} [props.size] - sm | md | lg
 * @param {string} [props.error]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @param {string} [props.triggerClassName] - Extra classes merged onto the trigger button (e.g. fixed height in toolbars)
 */
const sizes = {
  sm: 'h-10 md:h-8 text-base md:text-sm pl-3 pr-10',
  md: 'h-12 md:h-10 text-base pl-3 pr-10',
  lg: 'h-14 md:h-12 text-lg pl-4 pr-10',
};

export function ListboxSelect({
  options = [],
  value,
  onChange,
  placeholder,
  emptyValues = ['', 'all'],
  leftIcon: LeftIcon,
  size = 'md',
  error,
  disabled,
  className,
  triggerClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const isEmpty = value == null || emptyValues.includes(String(value));
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayText = isEmpty ? placeholder : (selectedOption?.label ?? value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (opt) => {
    onChange?.(opt.value);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {LeftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <span className="h-5 w-5 text-neutral-400 flex items-center justify-center">
            {React.isValidElement(LeftIcon) ? LeftIcon : <LeftIcon className="h-5 w-5 text-neutral-400" />}
          </span>
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'flex items-center justify-between w-full rounded-lg border shadow-sm transition-colors text-left',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600',
          'bg-white dark:bg-[#171717]',
          isEmpty ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-50',
          LeftIcon && 'pl-10',
          sizes[size],
          error
            ? 'border-error-500 focus-visible:border-error-500 focus-visible:ring-error-500/20'
            : 'border-neutral-300 dark:border-[#262626] focus-visible:ring-primary-600/20',
          disabled && 'bg-neutral-100 dark:bg-[#262626] cursor-not-allowed opacity-60',
          triggerClassName
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-neutral-400 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] shadow-lg py-1"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => !opt.disabled && handleSelect(opt)}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-neutral-900 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-[#262626]',
                  opt.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
}
