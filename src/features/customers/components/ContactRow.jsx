import { ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function ContactRow({ icon: Icon, iconBgClass, iconColorClass, label, value, href, showExternalIcon = false }) {
  const inner = (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border border-neutral-100 dark:border-[#262626] transition-colors',
      href
        ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer bg-white dark:bg-[#171717]'
        : 'bg-white dark:bg-[#171717]'
    )}>
      <div className={cn('p-2 rounded-lg flex-shrink-0', iconBgClass)}>
        <Icon className={cn('w-4 h-4', iconColorClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
          {label}
        </p>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate mt-0.5">
          {value}
        </p>
      </div>
      {showExternalIcon && (
        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }

  return inner;
}
