import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Calendar, ChevronRight, Building2, CreditCard, ShieldCheck } from 'lucide-react';
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
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 break-words">{value}</p>
      )}
    </div>
  );
}

export function SubscriptionDetailInfoStrip({ subscription }) {
  const { t } = useTranslation(['subscriptions', 'customers']);

  const alarmLine = [subscription.alarm_center, subscription.alarm_center_account && `ACC: ${subscription.alarm_center_account}`]
    .filter(Boolean)
    .join(' · ');
  const locationLine = [subscription.site_name, subscription.site_address].filter(Boolean).join(' · ');
  const monthlyAmount = Number(subscription.base_price || 0)
    + Number(subscription.sms_fee || 0)
    + Number(subscription.line_fee || 0)
    + Number(subscription.static_ip_fee || 0)
    + Number(subscription.sim_amount || 0);

  return (
    <section className={cn(SURFACE, 'hidden px-5 py-4 md:block')}>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          {t('subscriptions:detail.heroEyebrow')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7 xl:gap-5">
        <InfoCell label={t('subscriptions:list.columns.customer')}>
          <Link
            to={`/customers/${subscription.customer_id}`}
            className="group inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-neutral-900 hover:text-primary-600 dark:text-neutral-50 dark:hover:text-primary-400"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="truncate">{subscription.company_name || '—'}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
          </Link>
        </InfoCell>
        <InfoCell label={t('subscriptions:detail.fields.serviceType')}>
          <div className="inline-flex items-start gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-50">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{subscription.service_type ? t(`subscriptions:serviceTypes.${subscription.service_type}`) : '—'}</span>
          </div>
        </InfoCell>
        <InfoCell label={t('subscriptions:list.columns.site')}>
          <Link
            to={`/customers/${subscription.customer_id}`}
            className="group inline-flex min-w-0 items-center gap-1 text-sm font-medium text-neutral-900 hover:text-primary-600 dark:text-neutral-50 dark:hover:text-primary-400"
          >
            <span className="truncate">{locationLine || '—'}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
          </Link>
        </InfoCell>
        <InfoCell label={t('subscriptions:list.columns.monthly')}>
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            <CreditCard className="h-3.5 w-3.5 text-neutral-400" />
            <span>{formatCurrency(monthlyAmount, 'TRY')}</span>
          </div>
        </InfoCell>
        {subscription.sim_phone_number && (
          <InfoCell label={t('subscriptions:form.fields.simCard')}>
            <a
              href={`tel:${subscription.sim_phone_number}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400"
            >
              <Phone className="h-3.5 w-3.5" />
              {subscription.sim_phone_number}
            </a>
          </InfoCell>
        )}
        <InfoCell
          label={t('subscriptions:detail.fields.activationDate', 'Aktivasyon Tarihi')}
          value={subscription.start_date ? formatDate(subscription.start_date) : null}
        />
        {alarmLine && (
          <InfoCell label={t('subscriptions:form.fields.alarmCenter')}>
            <p className="flex items-start gap-1.5 text-sm text-neutral-700 dark:text-neutral-200">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>{alarmLine}</span>
            </p>
          </InfoCell>
        )}
      </div>
    </section>
  );
}
