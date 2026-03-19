import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, CheckCircle, SkipForward, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useUpdateContactStatus } from '../hooks';

export function CallQueueModal({ requests, onClose }) {
  const { t } = useTranslation('operations');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [note, setNote] = useState('');
  const [results, setResults] = useState({ confirmed: 0, noAnswer: 0, cancelled: 0 });

  const updateContact = useUpdateContactStatus();
  const total = requests.length;
  const current = requests[currentIndex];
  const isComplete = currentIndex >= total;

  const handleAction = (status) => {
    if (!current) return;

    updateContact.mutate(
      { id: current.id, contactStatus: status, contactNotes: note || null },
      {
        onSuccess: () => {
          setResults((prev) => ({
            ...prev,
            ...(status === 'confirmed' && { confirmed: prev.confirmed + 1 }),
            ...(status === 'no_answer' && { noAnswer: prev.noAnswer + 1 }),
            ...(status === 'cancelled' && { cancelled: prev.cancelled + 1 }),
          }));
          setNote('');
          setCurrentIndex((i) => i + 1);
        },
      }
    );
  };

  const handleSkip = () => {
    setNote('');
    setCurrentIndex((i) => i + 1);
  };

  // Completion summary
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <CheckCircle className="w-16 h-16 text-success-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
            {t('callQueue.complete')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {t('callQueue.summary', results)}
          </p>
          <Button variant="primary" onClick={onClose} className="w-full">
            {t('common:actions.close')}
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <PhoneOff className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            {t('callQueue.empty')}
          </h2>
          <Button variant="primary" onClick={onClose}>{t('common:actions.close')}</Button>
        </div>
      </div>
    );
  }

  const customer = current.customers;
  const site = current.customer_sites;
  const phone = site?.contact_phone || customer?.phone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {t('callQueue.title')}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('callQueue.remaining', { count: total - currentIndex })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>

        {/* Current request */}
        <div className="px-6 py-6">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-1">
            {customer?.company_name ?? '—'}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            {site?.site_name ?? ''}{site?.account_no ? ` (${site.account_no})` : ''}
          </p>

          {/* Phone */}
          {phone && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-neutral-50 dark:bg-[#0f0f0f] border border-neutral-200 dark:border-[#262626]">
              <Phone className="w-5 h-5 text-primary-600" />
              <span className="text-lg font-mono font-semibold text-neutral-900 dark:text-neutral-50 select-all">
                {phone}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(phone)}
                className="ml-auto text-xs text-primary-600 hover:text-primary-700"
              >
                {t('common:actions.copy')}
              </button>
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4 italic">
            &quot;{current.description}&quot;
          </p>

          {/* Contact attempts badge */}
          {current.contact_attempts > 0 && (
            <Badge variant="warning" size="sm" className="mb-4">
              {current.contact_attempts}x {t('callQueue.noAnswer')}
            </Badge>
          )}

          {/* Note field */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('callQueue.notePlaceholder')}
            className="block w-full h-10 rounded-lg border border-neutral-300 dark:border-[#262626] shadow-sm text-sm bg-white dark:bg-[#0f0f0f] text-neutral-900 dark:text-neutral-50 px-3 mb-6 placeholder:text-neutral-500 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          />

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleAction('no_answer')}
              disabled={updateContact.isPending}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 hover:bg-warning-100 dark:hover:bg-warning-900/40 transition-colors"
            >
              <PhoneOff className="w-6 h-6 text-warning-600 dark:text-warning-400" />
              <span className="text-xs font-medium text-warning-700 dark:text-warning-300">{t('callQueue.noAnswer')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('no_answer')}
              disabled={updateContact.isPending}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Phone className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('callQueue.busy')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('confirmed')}
              disabled={updateContact.isPending}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/40 transition-colors"
            >
              <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
              <span className="text-xs font-medium text-success-700 dark:text-success-300">{t('callQueue.confirmed')}</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171717] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <SkipForward className="w-6 h-6 text-neutral-400" />
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t('callQueue.skip')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
