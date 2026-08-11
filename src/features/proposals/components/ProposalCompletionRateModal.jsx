import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { useLatestRate } from '../../finance/hooks';
import { calcVatTevkifatSummary } from '../../../lib/proposalCalc';
import { formatCurrency, formatDate } from '../../../lib/utils';

const DEVIATION_THRESHOLD = 0.20;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function AmountBreakdown({ currency, net, vatRate, emphasis = false }) {
  const { t } = useTranslation('proposals');
  const rate = Math.max(Number(vatRate) || 0, 0);
  const showVat = rate > 0;
  const { vatAmount, totalWithVat } = calcVatTevkifatSummary(net, rate, false, 0, 1);
  const rateLabel = rate.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const valueClass = emphasis
    ? 'text-lg font-semibold text-primary-700 dark:text-primary-300'
    : 'text-lg font-semibold text-neutral-900 dark:text-neutral-100';
  const rowClass = 'flex items-center justify-between gap-3 text-sm';

  if (!showVat) {
    return <p className={valueClass}>{formatCurrency(net, currency)}</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className={rowClass}>
        <span className="text-neutral-500 dark:text-neutral-400">
          {t('completionRate.netExclVat')}
        </span>
        <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
          {formatCurrency(net, currency)}
        </span>
      </div>
      <div className={rowClass}>
        <span className="text-neutral-500 dark:text-neutral-400">
          {t('completionRate.vatAtRate', { rate: rateLabel })}
        </span>
        <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
          {formatCurrency(vatAmount, currency)}
        </span>
      </div>
      <div className={`${rowClass} pt-1.5 mt-0.5 border-t border-neutral-200 dark:border-neutral-700`}>
        <span className="font-medium text-neutral-700 dark:text-neutral-200">
          {t('completionRate.totalWithVat')}
        </span>
        <span className={`tabular-nums ${valueClass}`}>
          {formatCurrency(totalWithVat, currency)}
        </span>
      </div>
    </div>
  );
}

export function ProposalCompletionRateModal({
  open,
  onClose,
  onConfirm,
  proposal,
  totalUsd: totalUsdProp,
  vatRate: vatRateProp,
  isLoading,
}) {
  const { t } = useTranslation(['proposals', 'common']);
  const { data: latestRateData } = useLatestRate('USD');

  const suggestedRate = latestRateData?.effective_rate ?? null;
  const rateDate     = latestRateData?.rate_date ?? null;
  const [rateInput, setRateInput] = useState('');

  // Prefer the live-computed grandTotal passed from the detail page (always
  // accurate from DB items). Fall back to the stored column for safety.
  const totalUsd = (typeof totalUsdProp === 'number' && totalUsdProp > 0)
    ? totalUsdProp
    : (Number(proposal?.total_amount_usd) || 0);
  const vatRate = typeof vatRateProp === 'number'
    ? vatRateProp
    : (Number(proposal?.vat_rate) || 0);
  const isBlocked   = totalUsd <= 0;                        // M3
  const effectiveRateInput = rateInput || (open && suggestedRate ? String(suggestedRate) : '');
  const enteredRate = parseFloat(effectiveRateInput) || 0;
  // Finance posts VAT on TRY net after FX (amount_try * vat_rate / 100).
  const amountTry   = (!isBlocked && enteredRate > 0)
    ? round2(totalUsd * enteredRate)
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
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 px-4 py-3 space-y-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('proposals:completionRate.proposalTotal')}
            </p>
            <AmountBreakdown currency="USD" net={totalUsd} vatRate={vatRate} />
          </div>
        )}

        <Input
          label={t('proposals:completionRate.rateLabel')}
          type="number"
          step="0.0001"
          min="0"
          value={effectiveRateInput}
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
          <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 px-4 py-3 space-y-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('proposals:completionRate.convertedAmount')}
            </p>
            <AmountBreakdown
              currency="TRY"
              net={amountTry}
              vatRate={vatRate}
              emphasis
            />
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
