import { useTranslation } from 'react-i18next';
import { ClipboardList, Wrench, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

const STEPS = [
  { key: 'general', icon: ClipboardList, labelKey: 'form.stepper.general' },
  { key: 'services', icon: Wrench, labelKey: 'form.stepper.services' },
];

export function ProposalStepper({ currentStep, onStepClick, completedSteps = [] }) {
  const { t } = useTranslation('proposals');

  return (
    <div className="flex items-center gap-2 w-full">
      {STEPS.map((step, index) => {
        const stepIndex = index;
        const isCurrent = currentStep === stepIndex;
        const isCompleted = completedSteps.includes(stepIndex);
        const isClickable = isCompleted || stepIndex <= Math.max(...completedSteps, 0);
        const IconComponent = step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(stepIndex)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isCurrent && 'bg-primary-600 text-white shadow-md shadow-primary-600/20',
                !isCurrent && isCompleted && 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
                !isCurrent && !isCompleted && isClickable && 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700',
                !isCurrent && !isCompleted && !isClickable && 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              )}
            >
              {isCompleted && !isCurrent ? (
                <Check className="w-4 h-4" />
              ) : (
                <IconComponent className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{t(step.labelKey)}</span>
            </button>

            {index < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 rounded-full transition-colors duration-200',
                isCompleted ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-neutral-200 dark:bg-neutral-700'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
