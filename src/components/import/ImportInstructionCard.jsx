import { ListOrdered } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.intro]
 * @param {{ title: string, description?: string }[]} [props.steps] — pre-translated; if omitted, use defaultSteps from parent via children only, OR pass steps from page using common keys in parent
 * @param {'default' | 'compact'} [props.variant]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.children] — module-specific extra note
 */
export function ImportInstructionCard({
  title,
  intro,
  steps,
  variant = 'default',
  className,
  children,
}) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 dark:border-[#262626] bg-neutral-50/80 dark:bg-neutral-900/40',
        isCompact ? 'p-3' : 'p-4 md:p-5',
        className
      )}
    >
      <div className={cn('flex gap-3', isCompact ? 'mb-2' : 'mb-3')}>
        <div className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400">
          <ListOrdered className={cn(isCompact ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {title && (
            <h3
              className={cn(
                'font-semibold text-neutral-900 dark:text-neutral-50',
                isCompact ? 'text-sm' : 'text-base'
              )}
            >
              {title}
            </h3>
          )}
          {intro && (
            <p
              className={cn(
                'text-neutral-600 dark:text-neutral-400 leading-relaxed',
                isCompact ? 'text-xs' : 'text-sm'
              )}
            >
              {intro}
            </p>
          )}
          {steps && steps.length > 0 && (
            <ol
              className={cn(
                'list-decimal list-inside space-y-1.5 text-neutral-700 dark:text-neutral-300',
                isCompact ? 'text-xs' : 'text-sm'
              )}
            >
              {steps.map((step, i) => (
                <li key={i} className="pl-0.5">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{step.title}</span>
                  {step.description ? (
                    <span className="text-neutral-600 dark:text-neutral-400"> — {step.description}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
