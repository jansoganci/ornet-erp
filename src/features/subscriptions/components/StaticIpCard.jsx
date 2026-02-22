import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, Spinner } from '../../../components/ui';
import { formatDate } from '../../../lib/utils';
import { fetchActiveStaticIp, fetchStaticIpHistory, cancelStaticIp } from '../../simCards/staticIpApi';
import { StaticIpModal } from './StaticIpModal';

export function StaticIpCard({ simCardId, isAdmin = false }) {
  const { t } = useTranslation(['simCards', 'common']);
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: activeIp, isLoading } = useQuery({
    queryKey: ['staticIp', simCardId],
    queryFn: () => fetchActiveStaticIp(simCardId),
    enabled: !!simCardId,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['staticIpHistory', simCardId],
    queryFn: () => fetchStaticIpHistory(simCardId),
    enabled: !!simCardId && showHistory,
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelStaticIp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staticIp', simCardId] });
      queryClient.invalidateQueries({ queryKey: ['staticIpHistory', simCardId] });
      toast.success(t('simCards:staticIp.success.cancelled'));
    },
    onError: (err) => {
      toast.error(err?.message);
    },
  });

  return (
    <>
      <Card className="overflow-hidden">
        <div className="bg-blue-50/50 dark:bg-blue-950/10 px-5 py-3 border-b border-blue-100 dark:border-blue-900/20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider text-xs">
              {t('simCards:staticIp.title')}
            </h3>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModal(true)}
              className="text-xs"
            >
              {t('simCards:staticIp.assign')}
            </Button>
          )}
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : activeIp ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('simCards:staticIp.fields.ipAddress')}
                  </p>
                  <p className="text-base font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {activeIp.ip_address}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(activeIp.id)}
                    className="text-xs"
                  >
                    {t('simCards:staticIp.cancel')}
                  </Button>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                  {t('simCards:staticIp.fields.activatedAt')}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {formatDate(activeIp.activated_at)}
                </p>
              </div>
              {activeIp.notes && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('simCards:staticIp.fields.notes')}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {activeIp.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 py-2">
              {t('simCards:staticIp.noIp')}
            </p>
          )}

          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="mt-4 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {t('simCards:staticIp.history')}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {historyLoading ? (
                <Spinner size="sm" />
              ) : history.length === 0 ? (
                <p className="text-xs text-neutral-400">{t('simCards:staticIp.noIp')}</p>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <span className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                      {entry.ip_address}
                    </span>
                    <div className="text-right text-xs text-neutral-400">
                      <div>{formatDate(entry.activated_at)}</div>
                      {entry.cancelled_at && (
                        <div className="line-through text-neutral-300 dark:text-neutral-600">
                          {formatDate(entry.cancelled_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      <StaticIpModal
        simCardId={simCardId}
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
