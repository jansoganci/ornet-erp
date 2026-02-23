import { useTranslation } from 'react-i18next';
import { User, X, Check, Users } from 'lucide-react';
import { useProfiles } from '../tasks/hooks';
import { 
  Badge, 
  Spinner, 
  IconButton,
  Card
} from '../../components/ui';
import { cn } from '../../lib/utils';

export function WorkerSelector({ 
  value = [], 
  onChange,
  error 
}) {
  const { t } = useTranslation(['workOrders', 'common']);
  const { data: profiles = [], isLoading } = useProfiles({ role: 'field_worker' });

  const handleToggle = (profileId) => {
    if (value.includes(profileId)) {
      onChange(value.filter(id => id !== profileId));
    } else {
      if (value.length < 3) {
        onChange([...value, profileId]);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            {t('workOrders:form.fields.assignedTo')}
          </h3>
        </div>
        <Badge variant={value.length === 0 ? 'error' : 'primary'} size="sm">
          {value.length} / 3
        </Badge>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner size="md" />
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">
          {t('workOrders:form.noFieldWorkers')}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((profile) => {
            const isSelected = value.includes(profile.id);
            const isDisabled = !isSelected && value.length >= 3;

            return (
              <Card
                key={profile.id}
                variant={isSelected ? 'selected' : 'interactive'}
                padding="compact"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isDisabled) handleToggle(profile.id);
                }}
                className={cn(
                  'relative transition-all duration-200',
                  isDisabled && 'opacity-50 cursor-not-allowed grayscale'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "p-2 rounded-full transition-colors",
                    isSelected 
                      ? "bg-primary-600 text-white" 
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                  )}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-bold truncate",
                      isSelected ? "text-primary-900 dark:text-primary-100" : "text-neutral-900 dark:text-neutral-100"
                    )}>
                      {profile.full_name}
                    </p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-tight">
                      {t(`common:roles.${profile.role}`)}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="bg-primary-600 text-white rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-sm text-error-600 dark:text-error-400 mt-1">
          {error}
        </p>
      )}
      
      {value.length >= 3 && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
          {t('workOrders:validation.assignedToMax')}
        </p>
      )}
    </div>
  );
}
