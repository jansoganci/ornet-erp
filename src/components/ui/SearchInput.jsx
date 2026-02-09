import { Search, X } from 'lucide-react';
import { Input } from './Input';
import { IconButton } from './IconButton';
import { useTranslation } from 'react-i18next';

export function SearchInput({ value, onChange, placeholder, className, ...props }) {
  const { t } = useTranslation('common');

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || t('actions.search')}
      leftIcon={<Search className="h-5 w-5 text-neutral-400" />}
      className={className}
      rightIcon={
        value ? (
          <IconButton
            icon={X}
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
            aria-label={t('actions.clear')}
            className="mr-1"
          />
        ) : null
      }
      {...props}
    />
  );
}
