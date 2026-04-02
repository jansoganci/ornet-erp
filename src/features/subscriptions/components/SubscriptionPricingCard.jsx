import { useTranslation } from 'react-i18next';
import { DollarSign } from 'lucide-react';
import { Card } from '../../../components/ui';
import { cn, formatCurrency } from '../../../lib/utils';

export function SubscriptionPricingCard({ subscription, isAdmin = false, className }) {
  const { t } = useTranslation('subscriptions');

  const basePrice = Number(subscription.base_price) || 0;
  const smsFee = Number(subscription.sms_fee) || 0;
  const lineFee = Number(subscription.line_fee) || 0;
  const staticIpFee = Number(subscription.static_ip_fee) || 0;
  const simAmount = Number(subscription.sim_amount) || 0;
  const vatRate = Number(subscription.vat_rate) || 0;
  const cost = Number(subscription.cost) || 0;
  const staticIpCost = Number(subscription.static_ip_cost) || 0;

  const subtotal = basePrice + smsFee + lineFee + staticIpFee + simAmount;
  const vatAmount = subscription.official_invoice !== false
    ? Math.round(subtotal * vatRate / 100 * 100) / 100
    : 0;
  const total = subtotal + vatAmount;
  const profit = subtotal - cost - staticIpCost;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center space-x-2 border-b border-neutral-200/90 bg-neutral-50/90 px-5 py-3 dark:border-[#262626] dark:bg-[#141414]/80">
        <DollarSign className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
          {t('detail.sections.pricing')}
        </h3>
      </div>
      <div className="p-5 space-y-3">
        <PriceRow label={t('form.fields.basePrice')} value={basePrice} />
        <PriceRow label={t('form.fields.smsFee')} value={smsFee} />
        <PriceRow label={t('form.fields.lineFee')} value={lineFee} />
        {staticIpFee > 0 && (
          <PriceRow label={t('form.fields.staticIpFee')} value={staticIpFee} />
        )}
        {simAmount > 0 && (
          <PriceRow label={t('form.fields.simAmount')} value={simAmount} />
        )}

        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3 space-y-3">
          <PriceRow label={t('detail.fields.subtotal')} value={subtotal} bold />
          <PriceRow label={`${t('detail.fields.vatAmount')} (%${vatRate})`} value={vatAmount} />
          <PriceRow label={t('detail.fields.totalAmount')} value={total} bold highlight />
        </div>

        {isAdmin && (
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3 space-y-3">
            <PriceRow label={t('detail.fields.cost')} value={cost} muted />
            {staticIpCost > 0 && (
              <PriceRow label={t('detail.fields.staticIpCost')} value={staticIpCost} muted />
            )}
            <PriceRow
              label={t('detail.fields.profit')}
              value={profit}
              bold
              color={profit >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function PriceRow({ label, value, bold = false, highlight = false, muted = false, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-400'}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${
        color
          ? color
          : highlight
            ? 'text-primary-700 dark:text-primary-300 text-base'
            : 'text-neutral-900 dark:text-neutral-100'
      }`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
