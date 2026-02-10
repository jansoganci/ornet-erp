import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { useCreateTask } from '../hooks';

export function QuickPlanInput() {
  const { t } = useTranslation('tasks');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const titleRef = useRef(null);
  const createMutation = useCreateTask();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      createMutation.mutate(
        {
          title: title.trim(),
          due_date: dueDate || null,
          status: 'pending',
          priority: 'normal',
        },
        {
          onSuccess: () => {
            setTitle('');
            setDueDate('');
            titleRef.current?.focus();
          },
        }
      );
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            ref={titleRef}
            leftIcon={Plus}
            placeholder={t('quickAdd.placeholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={createMutation.isPending}
          />
        </div>
        <div className="w-full sm:w-44">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={createMutation.isPending}
            placeholder={t('quickAdd.dateHint')}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t('quickAdd.submitHint')}
      </p>
    </div>
  );
}
