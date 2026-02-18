import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Phone, ChevronRight } from 'lucide-react';
import { Card, Badge } from '../../../components/ui';

export function WorkOrderSiteCard({ workOrder }) {
  const { t } = useTranslation(['workOrders', 'customers']);

  const addressLine2 = [workOrder.district, workOrder.city].filter(Boolean).join(' ');
  const hasAddress = workOrder.site_address || addressLine2;

  return (
    <Card className="overflow-hidden border-primary-100 dark:border-primary-900/20">
      <div className="bg-primary-50/50 dark:bg-primary-950/10 px-6 py-4 border-b border-primary-100 dark:border-primary-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          <h3 className="font-bold text-primary-900 dark:text-primary-100 uppercase tracking-wider text-xs">
            {t('workOrders:detail.siteInfo')}
          </h3>
        </div>
        <Badge variant="info" className="font-mono">
          {workOrder.account_no || '—'}
        </Badge>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
              {t('workOrders:detail.companyInfo')}
            </p>
            <Link
              to={`/customers/${workOrder.customer_id}`}
              className="group flex items-center"
            >
              <span className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 transition-colors">
                {workOrder.company_name}
              </span>
              <ChevronRight className="w-4 h-4 ml-1 text-neutral-300 group-hover:text-primary-600 transition-colors" />
            </Link>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
              {t('customers:sites.fields.siteName')}
            </p>
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              {workOrder.site_name || '—'}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
              {t('customers:sites.fields.address')}
            </p>
            <div className="flex items-start">
              <MapPin className="w-4 h-4 mr-2 mt-0.5 text-neutral-400 shrink-0" />
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {hasAddress ? (
                  <>
                    {workOrder.site_address}
                    {addressLine2 && (
                      <>
                        <br />
                        {addressLine2}
                      </>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>
          {workOrder.site_phone && (
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                {t('customers:sites.fields.contactPhone')}
              </p>
              <a
                href={`tel:${workOrder.site_phone}`}
                className="flex items-center text-sm font-bold text-primary-600"
              >
                <Phone className="w-4 h-4 mr-2 shrink-0" />
                {workOrder.site_phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
