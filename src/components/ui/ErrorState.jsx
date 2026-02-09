import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../../lib/utils';

export function ErrorState({
  title,
  message,
  onRetry,
  className,
  variant = 'card', // 'card' or 'full'
}) {
  const { t } = useTranslation('common');

  const content = (
    <div className="flex flex-col items-center justify-center text-center gap-4">
      <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-full text-error-600 dark:text-error-400">
        <AlertCircle className="w-8 h-8" />
      </div>
      
      <div className="max-w-sm mx-auto">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
          {title || t('error.title') || 'An error occurred'}
        </h3>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          {message || t('error.description') || 'Something went wrong. Please try again.'}
        </p>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          className="mt-2"
        >
          {t('actions.retry') || 'Retry'}
        </Button>
      )}
    </div>
  );

  if (variant === 'full') {
    return (
      <div className={cn('flex-1 flex items-center justify-center p-6', className)}>
        {content}
      </div>
    );
  }

  return (
    <Card className={cn('p-8 border-error-100 dark:border-error-900/30', className)}>
      {content}
    </Card>
  );
}
