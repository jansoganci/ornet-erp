import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { useLatestRate } from '../../finance/hooks';
import { formatCurrency, formatDate } from '../../../lib/utils';

const DEVIATION_THRESHOLD = 0.20;

export function ProposalCompletionRateModal({ open, onClose, onConfirm, proposal, totalUsd: totalUsdProp, isLoading }) {
  const { t } = useTranslation(['proposals', 'common']);
  const { data: latestRateData } = useLatestRate('USD');

  const suggestedRate = latestRateData?.effective_rate ?? null;
  const rateDate     = latestRateData?.rate_date ?? null;
  const [rateInput, setRateInput] = useState('');

  useEffect(() => {
    if (open && suggestedRate) {
      setRateInput(String(suggestedRate));
    }
  }, [open, suggestedRate]);

  // Prefer the live-computed grandTotal passed from the detail page (always
  // accurate from DB items). Fall back to the stored column for safety.
  const totalUsd = (typeof totalUsdProp === 'number' && totalUsdProp > 0)
    ? totalUsdProp
    : (Number(proposal?.total_amount_usd) || 0);
  const isBlocked   = totalUsd <= 0;                        // M3
  const enteredRate = parseFloat(rateInput) || 0;
  const amountTry   = (!isBlocked && enteredRate > 0)
    ? Math.round(totalUsd * enteredRate * 100) / 100
    : null;

  const deviation =
    suggestedRate && enteredRate > 0
      ? Math.abs(enteredRate - suggestedRate) / suggestedRate
      : 0;
  const showWarning = deviation > DEVIATION_THRESHOLD;

  const isValid = enteredRate > 0 && !isBlocked;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({ exchangeRate: enteredRate, rateSuggested: suggestedRate });
  };

  // M4: format rate date for display
  const rateDateLabel = rateDate ? formatDate(rateDate) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('proposals:completionRate.title')}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!isValid}
            loading={isLoading}
          >
            {t('proposals:completionRate.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* M3 — blocked state: no USD total on proposal */}
        {isBlocked ? (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {t('proposals:completionRate.noUsdTotal')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 px-4 py-3 space-y-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('proposals:completionRate.proposalTotal')}
            </p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totalUsd, 'USD')}
            </p>
          </div>
        )}

        <Input
          label={t('proposals:completionRate.rateLabel')}
          type="number"
          step="0.0001"
          min="0"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          disabled={isBlocked}
          hint={
            suggestedRate
              ? t('proposals:completionRate.suggestedHint', {
                  rate: suggestedRate.toFixed(4),
                  date: rateDateLabel ?? '—',        // M4
                })
              : t('proposals:completionRate.noSuggestedRate')
          }
          autoFocus={!isBlocked}
        />

        {amountTry !== null && (
          <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 px-4 py-3 space-y-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('proposals:completionRate.convertedAmount')}
            </p>
            <p className="text-lg font-semibold text-primary-700 dark:text-primary-300">
              {formatCurrency(amountTry, 'TRY')}
            </p>
          </div>
        )}

        {showWarning && !isBlocked && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('proposals:completionRate.deviationWarning', {
                pct: Math.round(deviation * 100),
              })}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
