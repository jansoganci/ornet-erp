import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';
import { useUpdateContactStatus } from '../hooks';

const VARIANT_MAP = {
  not_contacted: 'error',
  no_answer:     'warning',
  confirmed:     'success',
  cancelled:     'default',
};

// The three statuses a user can actively set from the card.
// 'cancelled' is set only via the explicit cancel action — not via this badge.
const SELECTABLE_STATUSES = ['not_contacted', 'no_answer', 'confirmed'];

/**
 * ContactStatusBadge
 *
 * Pass `requestId` to enable the interactive dropdown.
 * Omit `requestId` (or pass undefined) for a read-only display badge
 * (used in calendar, insights, or any view where inline editing is not needed).
 *
 * If the current status is 'cancelled' it is always read-only — that state
 * is controlled by the cancel flow, not this badge.
 */
export function ContactStatusBadge({ requestId, status, size = 'sm' }) {
  const { t } = useTranslation('operations');
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { mutateAsync } = useUpdateContactStatus();

  const isInteractive = !!requestId && status !== 'cancelled';

  const handleSelect = async (newStatus) => {
    setOpen(false);
    if (newStatus === status) return;
    setIsUpdating(true);
    try {
      await mutateAsync({ id: requestId, contactStatus: newStatus });
    } finally {
      setIsUpdating(false);
    }
  };

  const badgeContent = (
    <Badge
      variant={VARIANT_MAP[status] ?? 'default'}
      size={size}
      dot
      className={cn(isUpdating && 'opacity-50 cursor-wait')}
    >
      <span className="inline-flex items-center gap-0.5">
        {isUpdating ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          t(`contactStatus.${status}`)
        )}
        {isInteractive && !isUpdating && (
          <ChevronDown className="w-2.5 h-2.5 opacity-40" />
        )}
      </span>
    </Badge>
  );

  // Read-only: no requestId, status is cancelled, or mutation pending
  if (!isInteractive) {
    return badgeContent;
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => !isUpdating && setOpen((o) => !o)}
        disabled={isUpdating}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t(`contactStatus.${status}`)}
      >
        {badgeContent}
      </button>

      {open && (
        <>
          {/* Backdrop — closes menu on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1 z-50 min-w-[148px] bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl py-1"
          >
            {SELECTABLE_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={value === status}
                onClick={() => handleSelect(value)}
                className={cn(
                  'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
                  value === status
                    ? 'bg-neutral-50 dark:bg-neutral-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                <Badge variant={VARIANT_MAP[value]} size="sm" dot>
                  {t(`contactStatus.${value}`)}
                </Badge>
                {value === status && (
                  <span className="ml-auto text-neutral-400 dark:text-neutral-500 text-[10px]">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
