import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Edit2 } from 'lucide-react';
import { Modal, IconButton } from '../../../components/ui';
import { formatCurrency, formatDate } from '../../../lib/utils';

const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const MAX_POPOVER_ITEMS = 8;

// Detects touch-primary devices (mobile / tablet)
function isTouchPrimary() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export function ExpenseGroupedView({ groups, onEditTransaction }) {
  const { t } = useTranslation(['finance', 'common']);

  // hoverState: { group, rect, colorIndex } — null when nothing hovered
  const [hoverState, setHoverState] = useState(null);
  // modalGroup: group object — null when modal is closed
  const [modalGroup, setModalGroup] = useState(null);

  const closeTimerRef = useRef(null);

  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHoverState(null), 120);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current);
  }, []);

  // Close popover on scroll so it doesn't float away from its anchor
  useEffect(() => {
    const close = () => setHoverState(null);
    window.addEventListener('scroll', close, { passive: true });
    return () => {
      window.removeEventListener('scroll', close);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleRowMouseEnter = useCallback(
    (e, group, colorIndex) => {
      if (isTouchPrimary()) return;
      cancelClose();
      const rect = e.currentTarget.getBoundingClientRect();
      setHoverState({ group, rect, colorIndex });
    },
    [cancelClose]
  );

  // Flip popover above the row when there isn't enough space below
  const popoverStyle = useMemo(() => {
    if (!hoverState) return {};
    const { rect } = hoverState;
    const ESTIMATED_HEIGHT = 340;
    const MARGIN = 8;
    const right = Math.max(MARGIN, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= ESTIMATED_HEIGHT) {
      return { top: rect.bottom + 6, right };
    }
    return { bottom: window.innerHeight - rect.top + 6, right };
  }, [hoverState]);

  return (
    <>
      {/* ── Grouped summary table ── */}
      <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50/80 dark:bg-[#1a1a1a]/80">
          <span className="flex-1 text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t('finance:expense.fields.category')}
          </span>
          <span className="hidden sm:block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-24 text-right">
            {t('finance:grouped.countHeader')}
          </span>
          <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-28 text-right">
            {t('finance:expense.fields.amount')}
          </span>
          {/* placeholder for mobile chevron */}
          <div className="w-4 md:hidden" />
        </div>

        {/* Rows */}
        {groups.map((group, index) => {
          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const isActive = hoverState?.group.key === group.key;

          return (
            <div
              key={group.key}
              className={`
                flex items-center gap-3 px-4 py-3.5
                border-b border-neutral-100 dark:border-[#1e1e1e] last:border-b-0
                transition-colors select-none
                ${isTouchPrimary() ? 'cursor-pointer active:bg-neutral-50 dark:active:bg-[#1c1c1c]' : 'cursor-default'}
                ${isActive ? 'bg-neutral-50 dark:bg-[#1c1c1c]' : ''}
              `}
              onMouseEnter={(e) => handleRowMouseEnter(e, group, index)}
              onMouseLeave={scheduleClose}
              onClick={() => isTouchPrimary() && setModalGroup({ ...group, colorIndex: index })}
            >
              {/* Color dot + category name */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate text-sm">
                  {group.categoryName}
                </span>
              </div>

              {/* Count (hidden on very small screens) */}
              <span className="hidden sm:block text-sm text-neutral-400 dark:text-neutral-500 tabular-nums w-24 text-right">
                {t('finance:grouped.count', { count: group.count })}
              </span>

              {/* Total */}
              <span className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums w-28 text-right text-sm">
                {formatCurrency(group.total)}
              </span>

              {/* Chevron — mobile only */}
              <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0 md:hidden" />
            </div>
          );
        })}
      </div>

      {/* ── Desktop portal popover ── */}
      {hoverState &&
        createPortal(
          <div
            className="fixed z-[500] w-80 sm:w-96 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-[#333] rounded-xl shadow-2xl overflow-hidden"
            style={popoverStyle}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {/* Popover header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100 dark:border-[#2a2a2a]">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[hoverState.colorIndex % CATEGORY_COLORS.length] }}
              />
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 flex-1 truncate">
                {hoverState.group.categoryName}
              </span>
              <span className="text-sm font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
                {formatCurrency(hoverState.group.total)}
              </span>
            </div>

            {/* Popover item list */}
            <div className="divide-y divide-neutral-50 dark:divide-[#262626] max-h-72 overflow-y-auto">
              {hoverState.group.items.slice(0, MAX_POPOVER_ITEMS).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-[#262626] transition-colors group/item"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
                      {tx.description || tx.expense_categories?.name_tr || '—'}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {formatDate(tx.transaction_date)}
                      {tx.customers?.company_name ? ` · ${tx.customers.company_name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums flex-shrink-0">
                    {formatCurrency(tx.amount_try)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTransaction(tx);
                    }}
                    title={t('common:actions.edit')}
                    className="opacity-0 group-hover/item:opacity-100 p-1 rounded-md text-neutral-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all flex-shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {hoverState.group.items.length > MAX_POPOVER_ITEMS && (
                <div className="px-4 py-2 text-xs text-neutral-400 dark:text-neutral-500 text-center bg-neutral-50/50 dark:bg-[#1a1a1a]/50">
                  {t('finance:grouped.moreItems', {
                    count: hoverState.group.items.length - MAX_POPOVER_ITEMS,
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ── Mobile modal ── */}
      <Modal
        open={!!modalGroup}
        onClose={() => setModalGroup(null)}
        title={modalGroup?.categoryName}
        size="lg"
      >
        {modalGroup && (
          <div className="-mx-6 -mt-2 -mb-6">
            <div className="divide-y divide-neutral-100 dark:divide-[#262626]">
              {modalGroup.items.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {tx.description || tx.expense_categories?.name_tr || '—'}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {formatDate(tx.transaction_date)}
                      {tx.customers?.company_name ? ` · ${tx.customers.company_name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {formatCurrency(tx.amount_try)}
                  </span>
                  <IconButton
                    icon={Edit2}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setModalGroup(null);
                      onEditTransaction(tx);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Total footer */}
            <div className="flex justify-between items-center px-6 py-3 bg-neutral-50 dark:bg-[#1a1a1a] border-t border-neutral-200 dark:border-[#262626]">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('finance:grouped.count', { count: modalGroup.items.length })}
              </span>
              <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatCurrency(
                  modalGroup.items.reduce((s, tx) => s + (Number(tx.amount_try) || 0), 0)
                )}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
