import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
}) {
  const { t } = useTranslation('common');
  const modalRef = useRef(null);
  const previousFocus = useRef(null);

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Focus the modal for accessibility
      modalRef.current?.focus();
    } else {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
      previousFocus.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, handleEscape]);

  const handleTabKey = useCallback((e) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleTabKey}
        className={cn(
          'relative bg-white dark:bg-[#171717] shadow-xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col transition-colors',
          'rounded-t-2xl md:rounded-lg animate-slide-up md:animate-fade-in',
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-50"
            >
              {title}
            </h2>
            <IconButton
              icon={X}
              variant="ghost"
              size="sm"
              aria-label={t('actions.close')}
              onClick={onClose}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-neutral-700 dark:text-neutral-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
