import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { Badge } from '../../../../components/ui/Badge';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { useFinanceHealthCheck, useFinanceHealthCheckRecords } from '../../hooks';

const STATUS_VARIANT = {
  MISSING_INCOME: 'error',
  ZERO_VALUE_INCOME: 'error',
  CURRENCY_MISMATCH: 'warning',
  MISSING_EXPENSE: 'warning',
};

export function FinanceHealthBanner() {
  const { t } = useTranslation(['finance', 'common']);
  const [showModal, setShowModal] = useState(false);

  const { data: count = 0 } = useFinanceHealthCheck();
  const { data: records = [], isLoading } = useFinanceHealthCheckRecords({ enabled: showModal });

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
          {t('finance:healthBanner.message', { count })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowModal(true)}
          className="text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
        >
          {t('common:actions.viewDetails')}
        </Button>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t('common:errors.systemHealth')}
      >
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">
            {t('common:empty.noData')}
          </p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {records.map((r) => (
              <div
                key={r.source_id}
                className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 dark:border-[#262626] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {t(`finance:healthBanner.sourceType.${r.source_type}`)}{' '}
                    <span className="font-mono font-normal text-neutral-500 dark:text-neutral-400">
                      {r.reference_no ?? '—'}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {r.event_date
                      ? new Date(r.event_date).toLocaleDateString('tr-TR')
                      : '—'}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                  {r.income_status !== 'OK' && (
                    <Badge variant={STATUS_VARIANT[r.income_status] ?? 'warning'} size="sm">
                      {t(`finance:healthBanner.status.${r.income_status}`)}
                    </Badge>
                  )}
                  {r.expense_status !== 'OK' && (
                    <Badge variant={STATUS_VARIANT[r.expense_status] ?? 'warning'} size="sm">
                      {t(`finance:healthBanner.status.${r.expense_status}`)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
