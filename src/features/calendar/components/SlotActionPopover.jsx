import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ListTodo } from 'lucide-react';

/**
 * Popover shown when clicking an empty calendar slot.
 * Offers two options: create a work order or create a plan note.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {{ x: number, y: number }} props.position - screen position for the popover
 * @param {function} props.onAddWorkOrder
 * @param {function} props.onAddPlan
 * @param {function} props.onClose
 */
export function SlotActionPopover({ open, position, onAddWorkOrder, onAddPlan, onClose }) {
  const { t } = useTranslation('calendar');
  const ref = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    // Delay to avoid closing from the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open || !position) return null;

  // Keep popover within viewport
  const style = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 50,
  };

  return (
    <div ref={ref} style={style} className="animate-in fade-in zoom-in-95 duration-150">
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] shadow-lg overflow-hidden min-w-[180px]">
        <button
          type="button"
          onClick={() => {
            onAddWorkOrder();
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <ClipboardList className="w-4 h-4 text-primary-500" />
          {t('slotAction.addWorkOrder')}
        </button>
        <div className="border-t border-neutral-100 dark:border-[#262626]" />
        <button
          type="button"
          onClick={() => {
            onAddPlan();
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <ListTodo className="w-4 h-4 text-violet-500" />
          {t('slotAction.addPlan')}
        </button>
      </div>
    </div>
  );
}
