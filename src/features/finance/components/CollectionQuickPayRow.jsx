import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui';
import { PAYMENT_METHODS } from '../../subscriptions/schema';
import { useCollectionRecordPayment } from '../collectionHooks';
import { cn, formatCurrency } from '../../../lib/utils';

const fieldClass =
  'w-full min-w-0 px-2 py-1.5 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60';

function getInvoicePreference(payment) {
  return payment?.subscriptions?.official_invoice ?? payment?.should_invoice ?? true;
}

function buildDefaults(payment) {
  const shouldInvoice = !!getInvoicePreference(payment);
  return {
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    pos_code: '',
    should_invoice: shouldInvoice,
    vat_rate: shouldInvoice ? (payment?.subscriptions?.vat_rate ?? 20) : 0,
    reference_no: '',
  };
}

function applyMethodRules(method, prev) {
  return {
    ...prev,
    payment_method: method,
  };
}

/**
 * Faturalı ödemede KDV 0–100 arası zorunlu sayı; boş / NaN / aralık dışı → invalid.
 * Faturasızda rate her zaman 0.
 */
function resolveVatRate(shouldInvoice, raw) {
  if (!shouldInvoice) return { ok: true, rate: 0, error: null };
  if (raw === '' || raw == null) return { ok: false, rate: null, error: 'vatRequired' };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, rate: null, error: 'vatRequired' };
  if (n < 0 || n > 100) return { ok: false, rate: null, error: 'vatRange' };
  return { ok: true, rate: n, error: null };
}

function computeAmounts(baseAmount, shouldInvoice, vatRate) {
  const amount = Number(baseAmount) || 0;
  if (!shouldInvoice) {
    return { amount, vatAmount: 0, totalAmount: amount };
  }
  const vat = Math.round(amount * (vatRate / 100) * 100) / 100;
  return { amount, vatAmount: vat, totalAmount: amount + vat };
}

/**
 * Inline quick-pay form for one pending collection payment.
 * Remount via key={payment.id} when the row identity changes.
 * @param {'table' | 'card'} variant
 */
export function CollectionQuickPayRow({ payment, variant = 'table', onViewSubscription, className }) {
  const { t } = useTranslation(['collection', 'subscriptions']);
  const recordMutation = useCollectionRecordPayment();
  const [form, setForm] = useState(() => buildDefaults(payment));

  const isBank = form.payment_method === 'bank_transfer';
  const vatLocked = !form.should_invoice;
  const shouldInvoice = !!form.should_invoice;

  const vatResolved = useMemo(
    () => resolveVatRate(shouldInvoice, form.vat_rate),
    [shouldInvoice, form.vat_rate],
  );

  const liveAmounts = useMemo(() => {
    if (!vatResolved.ok) return null;
    return computeAmounts(payment?.amount, shouldInvoice, vatResolved.rate);
  }, [payment?.amount, shouldInvoice, vatResolved]);

  const methodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`subscriptions:payment.methods.${m}`),
  }));

  const setField = (key, value) => {
    setForm((prev) => {
      if (key === 'payment_method') {
        return applyMethodRules(value, prev);
      }
      if (key === 'should_invoice') {
        const on = !!value;
        return {
          ...prev,
          should_invoice: on,
          vat_rate: on ? (payment?.subscriptions?.vat_rate ?? 20) : 0,
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const validate = () => {
    if (!form.payment_date) {
      toast.error(t('collection:quickPay.errors.dateRequired'));
      return false;
    }
    if (!String(form.pos_code || '').trim()) {
      toast.error(t('collection:quickPay.errors.posRequired'));
      return false;
    }
    const vat = resolveVatRate(!!form.should_invoice, form.vat_rate);
    if (!vat.ok) {
      toast.error(t(`collection:quickPay.errors.${vat.error}`));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate() || recordMutation.isPending) return;

    const shouldInv = !!form.should_invoice;
    const vat = resolveVatRate(shouldInv, form.vat_rate);
    if (!vat.ok) return;

    try {
      await recordMutation.mutateAsync({
        paymentId: payment.id,
        data: {
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          pos_code: String(form.pos_code).trim(),
          should_invoice: shouldInv,
          vat_rate: vat.rate,
          reference_no: isBank ? form.reference_no || null : null,
          invoice_no: null,
          invoice_type: null,
          notes: null,
        },
      });
    } catch {
      // onError toast in useCollectionRecordPayment
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (e.target?.tagName === 'TEXTAREA') return;
    e.preventDefault();
    handleSave();
  };

  const preview = (
    <div
      className={cn(
        'grid grid-cols-3 gap-2 rounded-md border px-2 py-1.5 min-w-[12rem]',
        vatResolved.ok
          ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50'
          : 'border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20',
      )}
      aria-live="polite"
    >
      <div className="text-center min-w-0">
        <p className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 truncate">
          {t('collection:quickPay.preview.net')}
        </p>
        <p className="text-xs font-bold tabular-nums text-neutral-900 dark:text-neutral-100 truncate">
          {formatCurrency(Number(payment?.amount) || 0)}
        </p>
      </div>
      <div className="text-center min-w-0">
        <p className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 truncate">
          {t('collection:quickPay.preview.vat')}
        </p>
        <p className="text-xs font-bold tabular-nums text-neutral-900 dark:text-neutral-100 truncate">
          {liveAmounts ? formatCurrency(liveAmounts.vatAmount) : '—'}
        </p>
      </div>
      <div className="text-center min-w-0">
        <p className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 truncate">
          {t('collection:quickPay.preview.total')}
        </p>
        <p className="text-xs font-bold tabular-nums text-primary-700 dark:text-primary-300 truncate">
          {liveAmounts ? formatCurrency(liveAmounts.totalAmount) : '—'}
        </p>
      </div>
    </div>
  );

  const fields = (
    <>
      {preview}

      <label className="flex flex-col gap-0.5 min-w-[8.5rem]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {t('collection:quickPay.fields.paymentDate')}
        </span>
        <input
          type="date"
          className={fieldClass}
          value={form.payment_date}
          onChange={(e) => setField('payment_date', e.target.value)}
          disabled={recordMutation.isPending}
        />
      </label>

      <label className="flex flex-col gap-0.5 min-w-[7.5rem]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {t('collection:quickPay.fields.paymentMethod')}
        </span>
        <select
          className={fieldClass}
          value={form.payment_method}
          onChange={(e) => setField('payment_method', e.target.value)}
          disabled={recordMutation.isPending}
        >
          {methodOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5 min-w-[6.5rem]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {t('collection:quickPay.fields.posCode')}
        </span>
        <input
          type="text"
          className={fieldClass}
          value={form.pos_code}
          onChange={(e) => setField('pos_code', e.target.value)}
          disabled={recordMutation.isPending}
          autoComplete="off"
        />
      </label>

      <label className="flex flex-col gap-0.5 min-w-[4.5rem] items-start">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {t('collection:quickPay.fields.shouldInvoice')}
        </span>
        <input
          type="checkbox"
          className="mt-2 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
          checked={shouldInvoice}
          onChange={(e) => setField('should_invoice', e.target.checked)}
          disabled={recordMutation.isPending}
        />
      </label>

      <label className="flex flex-col gap-0.5 min-w-[4.5rem]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {t('collection:quickPay.fields.vatRate')}
        </span>
        <input
          type="number"
          min={0}
          max={100}
          step="any"
          className={cn(fieldClass, !vatResolved.ok && shouldInvoice && 'border-amber-400 dark:border-amber-600')}
          value={form.vat_rate}
          onChange={(e) => setField('vat_rate', e.target.value === '' ? '' : Number(e.target.value))}
          disabled={recordMutation.isPending || vatLocked}
        />
      </label>

      {isBank && (
        <label className="flex flex-col gap-0.5 min-w-[7rem]">
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            {t('collection:quickPay.fields.referenceNo')}
          </span>
          <input
            type="text"
            className={fieldClass}
            value={form.reference_no}
            onChange={(e) => setField('reference_no', e.target.value)}
            disabled={recordMutation.isPending}
            autoComplete="off"
          />
        </label>
      )}

      <div className="flex items-end gap-1 shrink-0">
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={recordMutation.isPending}
          onClick={handleSave}
        >
          {t('collection:actions.saveQuickPay')}
        </Button>
        {variant === 'table' && onViewSubscription ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onViewSubscription}
            title={t('collection:actions.viewSubscription')}
            disabled={recordMutation.isPending}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </div>
    </>
  );

  if (variant === 'card') {
    return (
      <div
        className={cn('flex flex-wrap gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800', className)}
        onKeyDown={onKeyDown}
      >
        {fields}
      </div>
    );
  }

  return (
    <td className={cn('px-3 py-2 align-top', className)}>
      <div className="flex flex-wrap gap-2 items-end" onKeyDown={onKeyDown}>
        {fields}
      </div>
    </td>
  );
}
