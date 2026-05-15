import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, Spinner, Table } from '../../../components/ui';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useParasutHistory } from '../parasutHistoryHooks';
import { useCustomer } from '../hooks';

export function ParasutHistoryTab({ customerId }) {
  const { t } = useTranslation(['customers', 'finance']);
  const { data: customer } = useCustomer(customerId);
  const { data: invoices = [], isLoading } = useParasutHistory(customerId);

  if (!customer?.parasut_contact_id) {
    return (
      <div className="space-y-3">
        <EmptyState
          title={t('customers:parasutHistory.notMatchedTitle')}
          description={t('customers:parasutHistory.notMatchedDescription')}
        />
        <div className="text-center">
          <Link className="text-sm font-medium text-primary-600 hover:underline" to="/customers/parasut-matching">
            {t('finance:parasut.matchCustomerFirst')}
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        title={t('customers:parasutHistory.emptyTitle')}
        description={t('customers:parasutHistory.emptyDescription')}
      />
    );
  }

  return (
    <Table
      columns={[
        {
          key: 'issue_date',
          header: t('customers:parasutHistory.columns.date'),
          render: (_value, row) => formatDate(row.attributes?.issue_date),
        },
        {
          key: 'invoice_no',
          header: t('customers:parasutHistory.columns.invoiceNo'),
          render: (_value, row) => row.attributes?.invoice_no || row.id,
        },
        {
          key: 'net_total',
          header: t('customers:parasutHistory.columns.amount'),
          render: (_value, row) => formatCurrency(Number(row.attributes?.net_total || row.attributes?.gross_total || 0)),
        },
        {
          key: 'status',
          header: t('customers:parasutHistory.columns.status'),
          render: (_value, row) => row.attributes?.status || '-',
        },
      ]}
      data={invoices}
    />
  );
}
