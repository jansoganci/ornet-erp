import { Link } from 'react-router-dom';
import { FileText, ExternalLink, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, Spinner } from '../../../components/ui';
import { formatCurrency, formatDate } from '../../../lib/utils';
import {
  useCancelParasutDraft,
  useFinalizeParasutInvoice,
  usePrepareParasutInvoice,
  useProposalParasutTransactions,
  useSubscriptionParasutTransactions,
  useWorkOrderParasutTransactions,
} from '../parasutHooks';

const statusVariant = {
  not_required: 'default',
  ready: 'info',
  draft: 'warning',
  sent: 'warning',
  confirmed: 'success',
  failed: 'error',
};

function parasutInvoiceUrl(invoiceId) {
  return invoiceId ? `https://uygulama.parasut.com/sales_invoices/${invoiceId}` : null;
}

export function ParasutInvoicePanel({ subscriptionId, proposalId, workOrderId }) {
  const { t } = useTranslation(['finance', 'common']);
  const enabled = import.meta.env.VITE_PARASUT_ENABLED === 'true';
  const subscriptionQuery = useSubscriptionParasutTransactions(subscriptionId);
  const proposalQuery = useProposalParasutTransactions(proposalId);
  const workOrderQuery = useWorkOrderParasutTransactions(workOrderId);
  const activeQuery = subscriptionId ? subscriptionQuery : proposalId ? proposalQuery : workOrderQuery;
  const transactions = activeQuery.data || [];
  const isLoading = activeQuery.isLoading;
  const prepareInvoice = usePrepareParasutInvoice();
  const finalizeInvoice = useFinalizeParasutInvoice();
  const cancelDraft = useCancelParasutDraft();

  if (!enabled) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-200/90 bg-neutral-50/90 px-5 py-3 dark:border-[#262626] dark:bg-[#141414]/80">
        <FileText className="h-4 w-4 text-primary-600" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
          {t('finance:parasut.title')}
        </h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          title={t('finance:parasut.emptyTitle')}
          description={t('finance:parasut.emptyDescription')}
        />
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
          {transactions.map((tx) => {
            const status = tx.parasut_sync_status || 'not_required';
            const customer = tx.customers || {};
            const disabledByContact = !customer.parasut_contact_id;
            const invoiceUrl = parasutInvoiceUrl(tx.parasut_invoice_id);
            const totalAmount = Number(tx.amount_try || 0) + Number(tx.output_vat || 0);

            return (
              <div key={tx.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {formatDate(tx.transaction_date)} · {formatCurrency(totalAmount)}
                    </p>
                    <Badge variant={statusVariant[status] || 'default'}>
                      {t(`finance:parasut.status.${status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {tx.description || t('finance:parasut.invoiceDescriptionFallback')}
                  </p>
                  {disabledByContact && (
                    <Link
                      to="/customers/parasut-matching"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
                    >
                      <Link2 className="h-4 w-4" />
                      {t('finance:parasut.matchCustomerFirst')}
                    </Link>
                  )}
                  {tx.parasut_error && (
                    <p className="mt-2 text-sm text-error-600 dark:text-error-400">{tx.parasut_error}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {status === 'ready' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabledByContact}
                      loading={prepareInvoice.isPending}
                      onClick={() => prepareInvoice.mutate(tx.id)}
                    >
                      {t('finance:parasut.actions.prepare')}
                    </Button>
                  )}
                  {status === 'draft' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        loading={finalizeInvoice.isPending}
                        onClick={() => finalizeInvoice.mutate(tx.id)}
                      >
                        {t('finance:parasut.actions.finalize')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={cancelDraft.isPending}
                        onClick={() => cancelDraft.mutate(tx.id)}
                      >
                        {t('finance:parasut.actions.cancelDraft')}
                      </Button>
                    </>
                  )}
                  {invoiceUrl && (
                    <a
                      href={invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-primary-600 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-500 dark:text-primary-500 dark:hover:bg-primary-950/30"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('finance:parasut.actions.view')}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
