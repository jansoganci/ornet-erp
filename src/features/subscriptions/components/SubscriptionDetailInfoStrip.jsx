import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Calendar, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '../../../lib/utils';

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

  return (
    <section className={cn(SURFACE, 'hidden px-4 py-3 sm:px-5 sm:py-4 md:block')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <InfoCell label={t('subscriptions:list.columns.site')}>
          <Link
            to={`/customers/${subscription.customer_id}`}
            className="group inline-flex min-w-0 items-center gap-1 text-sm font-medium text-neutral-900 hover:text-primary-600 dark:text-neutral-50 dark:hover:text-primary-400"
          >
            <span className="truncate">{subscription.site_name || '—'}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
          </Link>
        </InfoCell>
        {subscription.site_address && (
          <InfoCell label={t('customers:sites.fields.address', 'Adres')}>
            <p className="flex items-start gap-1.5 text-sm text-neutral-700 dark:text-neutral-200">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span className="line-clamp-2">{subscription.site_address}</span>
            </p>
          </InfoCell>
        )}
        {subscription.site_phone && (
          <InfoCell label={t('customers:sites.fields.contactPhone', 'Telefon')}>
            <a
              href={`tel:${subscription.site_phone}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400"
            >
              <Phone className="h-3.5 w-3.5" />
              {subscription.site_phone}
            </a>
          </InfoCell>
        )}
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
        {alarmLine && (
          <InfoCell label={t('subscriptions:form.fields.alarmCenter')} value={alarmLine} />
        )}
        <InfoCell
          label={t('subscriptions:detail.fields.startDate')}
          value={subscription.start_date ? formatDate(subscription.start_date) : null}
        />
        <InfoCell
          label={t('subscriptions:detail.fields.billingDay')}
          value={subscription.billing_day ? `${subscription.billing_day}. gün` : null}
        />
        <InfoCell
          label={t('subscriptions:detail.fields.managedBy')}
          value={subscription.managed_by_name || t('subscriptions:detail.noManager')}
        />
        <InfoCell
          label={t('subscriptions:detail.fields.soldBy')}
          value={subscription.sold_by_name || '—'}
        />
      </div>
    </section>
  );
}
