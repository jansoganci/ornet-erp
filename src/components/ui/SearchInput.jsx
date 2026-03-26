import { Search, X } from 'lucide-react';
import { Input } from './Input';
import { IconButton } from './IconButton';
import { useTranslation } from 'react-i18next';

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  wrapperClassName,
  /** No search/clear icons — placeholder only (e.g. dense filter bars). */
  minimal = false,
  ...props
}) {
  const { t } = useTranslation('common');
  const normalizedValue = value ?? '';

  return (
    <Input
      {...props}
      value={normalizedValue}
      onChange={(e) => onChange?.(e.target.value ?? '')}
      placeholder={placeholder || t('actions.search')}
      leftIcon={minimal ? undefined : <Search className="h-5 w-5 text-neutral-400" />}
      wrapperClassName={wrapperClassName || 'w-full sm:max-w-sm'}
      className={className}
      rightIcon={
        !minimal && normalizedValue.length > 0 ? (
          <IconButton
            type="button"
            icon={X}
            size="sm"
            variant="ghost"
            onClick={() => onChange?.('')}
            aria-label={t('actions.clear')}
            className="mr-1 pointer-events-auto"
          />
        ) : null
      }
    />
  );
}
