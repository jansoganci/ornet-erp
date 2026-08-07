import { useTranslation } from 'react-i18next';
import { MapPin, Phone, CreditCard } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../../lib/utils';

const SURFACE =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';
const TEXT_MUTED = 'text-neutral-500 dark:text-neutral-400';

function InfoCell({ label, value, children }) {
  if (!value && !children) return null;
  return (
    <div className="min-w-0">
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', TEXT_MUTED)}>{label}</p>
      {children || (
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50" title={value}>
          {value}
        </p>
      )}
    </div>
  );
}

/**
 * Merkez/ACC from site via subscriptions_detail (site_alarm_center, account_no).
 */
export function SubscriptionDetailInfoStrip({ subscription }) {
  const { t } = useTranslation(['subscriptions', 'common']);

  const siteAccountNo = subscription.account_no?.trim() || '';
  const alarmCenter = (subscription.site_alarm_center || '').trim();

  const alarmParts = [
    alarmCenter,
    siteAccountNo && `ACC: ${siteAccountNo}`,
  ].filter(Boolean);
  const alarmLine = alarmParts.join(' · ');

  const monthlyAmount = Number(subscription.base_price || 0)
    + Number(subscription.sms_fee || 0)
    + Number(subscription.line_fee || 0)
    + Number(subscription.static_ip_fee || 0)
    + Number(subscription.sim_amount || 0);
  const billingFrequencyLabel = subscription.billing_frequency
    ? t(`subscriptions:form.fields.${subscription.billing_frequency}`)
    : null;

  return (
    <section className={cn(SURFACE, 'hidden px-5 py-4 md:block')}>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          {t('subscriptions:detail.heroEyebrow')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <InfoCell label={t('subscriptions:list.columns.monthly')}>
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="truncate">{formatCurrency(monthlyAmount, 'TRY')}</span>
          </div>
        </InfoCell>
        <InfoCell
          label={t('subscriptions:detail.fields.activationDate')}
          value={subscription.start_date ? formatDate(subscription.start_date) : null}
        />
        {alarmLine && (
          <InfoCell label={t('subscriptions:form.fields.alarmCenter')}>
            <p
              className="line-clamp-2 text-sm text-neutral-700 dark:text-neutral-200"
              title={alarmLine}
            >
              {alarmLine}
            </p>
          </InfoCell>
        )}
        {subscription.sim_phone_number && (
          <InfoCell label={t('subscriptions:form.fields.simCard')}>
            <a
              href={`tel:${subscription.sim_phone_number}`}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{subscription.sim_phone_number}</span>
            </a>
          </InfoCell>
        )}
        {billingFrequencyLabel && (
          <InfoCell
            label={t('subscriptions:detail.fields.billingFrequency')}
            value={billingFrequencyLabel}
          />
        )}
      </div>
      {subscription.site_address && (
        <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', TEXT_MUTED)}>
            {t('common:labels.address')}
          </p>
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
            <p className="min-w-0 text-sm leading-relaxed text-neutral-700 break-words dark:text-neutral-200">
              {subscription.site_address}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
