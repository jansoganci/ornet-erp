import { Plus } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <Card
      className={cn(
        'p-12 text-center border-dashed dark:border-[#262626] flex flex-col items-center justify-center gap-4',
        className
      )}
    >
      {Icon && (
        <div className="p-4 bg-neutral-100 dark:bg-[#171717] rounded-full text-neutral-400 dark:text-neutral-500">
          <Icon className="w-10 h-10" />
        </div>
      )}
      
      <div className="max-w-sm mx-auto">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <Button
          variant="primary"
          onClick={onAction}
          leftIcon={<Plus className="w-4 h-4" />}
          className="mt-2"
        >
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}
