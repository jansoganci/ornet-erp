import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MapPin, Phone, User, Edit2, ClipboardList, Info, ChevronRight, CreditCard, Plus } from 'lucide-react';
import { 
  Card, 
  Button, 
  Badge, 
  IconButton 
} from '../../components/ui';
import { cn } from '../../lib/utils';

export function SiteCard({ 
  site, 
  subscriptions = [],
  onEdit, 
  onCreateWorkOrder,
  onViewHistory,
  onAddSubscription,
  className 
}) {
  const { t } = useTranslation(['customers', 'common', 'workOrders', 'subscriptions']);

  return (
    <Card 
      className={cn("group overflow-hidden", className)}
      padding="compact"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
              <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-500" />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                {site.site_name || t('customers:sites.fields.siteName')}
              </h4>
              <div className="flex items-center mt-1">
                <Badge variant={site.account_no ? "info" : "default"} size="sm" className="font-mono">
                  {site.account_no || '---'}
                </Badge>
                {!site.is_active && (
                  <Badge variant="error" size="sm" className="ml-2">
                    {t('common:status.inactive')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={() => onEdit(site)}
            aria-label={t('common:actions.edit')}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start text-sm text-neutral-600 dark:text-neutral-400">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-neutral-400" />
            <p className="line-clamp-2">
              {site.address} {site.district} {site.city}
            </p>
          </div>

          {(site.contact_name || site.contact_phone) && (
            <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
              <User className="w-4 h-4 mr-2 shrink-0 text-neutral-400" />
              <span className="truncate">
                {site.contact_name} {site.contact_phone && `(${site.contact_phone})`}
              </span>
            </div>
          )}

          {site.panel_info && (
            <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-md border border-neutral-100 dark:border-neutral-800">
              <Info className="w-3.5 h-3.5 mr-2 shrink-0" />
              <span className="truncate italic">{site.panel_info}</span>
            </div>
          )}

          {/* Subscriptions section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                {t('subscriptions:multiService.subscriptionsAtSite')}
              </span>
              {onAddSubscription && (
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={<Plus className="w-3 h-3" />}
                  onClick={() => onAddSubscription(site)}
                  className="text-[10px] h-6"
                >
                  {t('subscriptions:multiService.addService')}
                </Button>
              )}
            </div>
            {subscriptions.length > 0 ? (
              <div className="space-y-1.5">
                {subscriptions.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/subscriptions/${sub.id}`}
                    className="flex items-center justify-between p-2 rounded-md bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" size="sm" className="shrink-0">
                        {sub.service_type ? t(`subscriptions:serviceTypes.${sub.service_type}`) : '—'}
                      </Badge>
                      <Badge
                        variant={sub.status === 'active' ? 'success' : sub.status === 'paused' ? 'warning' : 'default'}
                        size="sm"
                        dot
                        className="shrink-0"
                      >
                        {t(`subscriptions:statuses.${sub.status}`)}
                      </Badge>
                      <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(Number(sub.base_price) || 0)}
                        {sub.billing_frequency && sub.billing_frequency !== 'monthly' && ` / ${t(`subscriptions:form.fields.${sub.billing_frequency}`)}`}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-1">
                {t('subscriptions:multiService.noOtherServices')}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-3">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ClipboardList className="w-4 h-4" />}
            onClick={() => onViewHistory(site.id)}
            className="w-full text-[11px] uppercase tracking-wider font-bold"
          >
            {t('workOrders:detail.history')}
          </Button>
          <Button
            size="sm"
            leftIcon={<ChevronRight className="w-4 h-4" />}
            onClick={() => onCreateWorkOrder(site.id)}
            className="w-full text-[11px] uppercase tracking-wider font-bold"
          >
            {t('customers:detail.actions.newWorkOrder')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
