import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Users, ChevronRight, Hash, Building2 } from 'lucide-react';
import { 
  Card, 
  Badge, 
  IconButton 
} from '../../components/ui';

export function DailyWorkCard({ 
  workOrder, 
  onClick 
}) {
  const { t } = useTranslation(['workOrders', 'common', 'dailyWork']);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'cancelled': return 'error';
      case 'scheduled': return 'info';
      default: return 'default';
    }
  };

  const getWorkTypeVariant = (type) => {
    switch (type) {
      case 'installation': return 'primary';
      case 'service': return 'warning';
      case 'maintenance': return 'success';
      case 'survey': return 'info';
      default: return 'default';
    }
  };

  return (
    <Card 
      variant="interactive"
      padding="compact"
      onClick={() => onClick(workOrder)}
      className="group"
    >
      <div className="flex items-center space-x-4">
        {/* Time / Left Side */}
        <div className="flex flex-col items-center justify-center min-w-[60px] py-2 border-r border-neutral-100 dark:border-neutral-800">
          <Clock className="w-4 h-4 text-neutral-400 mb-1" />
          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {workOrder.scheduled_time || '--:--'}
          </span>
        </div>

        {/* Content / Middle */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              <Badge variant={getWorkTypeVariant(workOrder.work_type)} size="sm" className="shrink-0">
                {t(`common:workType.${workOrder.work_type}`)}
              </Badge>
              {workOrder.form_no && (
                <span className="text-[10px] font-mono text-neutral-400 truncate">
                  #{workOrder.form_no}
                </span>
              )}
            </div>
            <Badge variant={getStatusVariant(workOrder.status)} size="sm" dot>
              {t(`common:status.${workOrder.status}`)}
            </Badge>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-neutral-900 dark:text-neutral-100 truncate flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-neutral-400 shrink-0" />
              {workOrder.company_name}
            </h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-neutral-400 shrink-0" />
              {workOrder.site_name || workOrder.site_address}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex -space-x-2 overflow-hidden">
              {workOrder.assigned_workers?.map((worker) => (
                <div 
                  key={worker.id}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center"
                  title={worker.name}
                >
                  <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase">
                    {worker.name.charAt(0)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              {t('common:actions.view')}
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
