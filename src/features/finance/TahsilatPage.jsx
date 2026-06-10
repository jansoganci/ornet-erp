import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PageContainer } from '../../components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SearchInput,
  Spinner,
} from '../../components/ui';
import { ChannelKpiCard } from './components/dashboard/ChannelKpiCard';
import { AddPaymentModal } from './components/AddPaymentModal';
import { useCollectionDocuments, useCollectionSummaries } from './hooks';
import { formatCurrency, formatDate } from '../../lib/utils';

const SERVICE_CATEGORIES = ['kira', 'merkez', 'montaj', 'servis', 'satis', 'mal_gonderme', 'diger'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

function CustomerStatusBadge({ row }) {
  const { t } = useTranslation('finance');

  if (Number(row.unpaid_count) > 0) {
    return <Badge variant="error">{t('tahsilat.status.unpaid')}</Badge>;
  }
  if (Number(row.partial_count) > 0) {
    return <Badge variant="warning">{t('tahsilat.status.partial')}</Badge>;
  }
  return <Badge variant="success">{t('tahsilat.status.paid')}</Badge>;
}

function DocumentStatusBadge({ status }) {
  const { t } = useTranslation('finance');
  const variant = status === 'paid' ? 'success' : status === 'partial' ? 'warning' : 'error';
  return <Badge variant={variant}>{t(`tahsilat.status.${status}`, { defaultValue: status })}</Badge>;
}

function docToReceivableRow(doc) {
  return {
    id: doc.transaction_id,
    amount_try: doc.sale_price_net,
    output_vat: Number(doc.vat_amount) || 0,
  };
}

const MAIN_SUMMARY_COLUMNS = 10;

function CustomerDocumentsPanel({ customerId, filters, onAddPayment }) {
  const { t } = useTranslation('finance');
  const documentFilters = useMemo(
    () => ({
      customer_id: customerId,
      service_category: filters.serviceCategory || undefined,
      payment_status: filters.paymentStatus || undefined,
      search: filters.search || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
    }),
    [customerId, filters]
  );

  const { data: documents = [], isLoading } = useCollectionDocuments(documentFilters);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40">
        <Spinner />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-6 px-4 text-sm text-neutral-500 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40">
        {t('tahsilat.table.noDocuments')}
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40">
      <div className="overflow-x-auto px-3 py-2 sm:px-4">
        <table className="w-full text-sm min-w-[56rem]">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.date')}
              </th>
              <th className="text-left py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap min-w-[10rem]">
                {t('tahsilat.table.description')}
              </th>
              <th className="text-left py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.category')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.salePrice')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.outputVat')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.totalInclVat')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.cost')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.profit')}
              </th>
              <th className="text-left py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.status')}
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('tahsilat.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {documents.map((doc) => (
              <tr key={doc.transaction_id}>
                <td className="py-2.5 px-2 text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                  {doc.transaction_date ? formatDate(doc.transaction_date) : '—'}
                </td>
                <td className="py-2.5 px-2 text-sm text-neutral-700 dark:text-neutral-200">
                  <span className="line-clamp-2">{doc.description || '—'}</span>
                </td>
                <td className="py-2.5 px-2 text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                  {doc.service_category
                    ? t(`tahsilat.category.${doc.service_category}`, { defaultValue: doc.service_category })
                    : '—'}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap">
                  {formatCurrency(doc.sale_price_net, 'TRY')}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap">
                  {formatCurrency(doc.vat_amount, 'TRY')}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-sm font-semibold whitespace-nowrap">
                  {formatCurrency(doc.total_with_vat, 'TRY')}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap">
                  {formatCurrency(doc.cost, 'TRY')}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap">
                  {formatCurrency(doc.profit, 'TRY')}
                </td>
                <td className="py-2.5 px-2 whitespace-nowrap">
                  <DocumentStatusBadge status={doc.payment_status} />
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  {doc.payment_status !== 'paid' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onAddPayment(docToReceivableRow(doc))}
                    >
                      {t('receivables.addPayment.title')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TahsilatPage() {
  const { t } = useTranslation('finance');
  const PAGE_SIZE = 50;

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(0);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const summaryFilters = useMemo(
    () => ({
      search: search || undefined,
      payment_status: paymentStatus || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [search, paymentStatus, page]
  );

  const { data: summaries = [], isLoading } = useCollectionSummaries(summaryFilters);

  const kpis = useMemo(() => {
    const totalOutstanding = summaries.reduce((sum, row) => sum + Number(row.outstanding || 0), 0);
    const totalCollected = summaries.reduce((sum, row) => sum + Number(row.total_collected || 0), 0);
    const unpaidCount = summaries.reduce((sum, row) => sum + Number(row.unpaid_count || 0), 0);
    const totalBilled = summaries.reduce((sum, row) => sum + Number(row.total_billed || 0), 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    return {
      totalOutstanding,
      totalCollected,
      unpaidCount,
      collectionRate,
    };
  }, [summaries]);

  const filterProps = useMemo(
    () => ({
      search,
      dateFrom,
      dateTo,
      serviceCategory,
      paymentStatus,
    }),
    [search, dateFrom, dateTo, serviceCategory, paymentStatus]
  );

  const toggleCustomer = (customerId) => {
    setExpandedCustomerId((current) => (current === customerId ? null : customerId));
  };

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
          {t('tahsilat.title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChannelKpiCard
          title={t('tahsilat.kpi.totalOutstanding')}
          value={formatCurrency(kpis.totalOutstanding, 'TRY')}
          loading={isLoading}
          variant="negative"
          emphasis
        />
        <ChannelKpiCard
          title={t('tahsilat.kpi.totalCollected')}
          value={formatCurrency(kpis.totalCollected, 'TRY')}
          loading={isLoading}
          variant="positive"
        />
        <ChannelKpiCard
          title={t('tahsilat.kpi.unpaidCount')}
          value={String(kpis.unpaidCount)}
          loading={isLoading}
        />
        <ChannelKpiCard
          title={t('tahsilat.kpi.collectionRate')}
          value={`${kpis.collectionRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`}
          loading={isLoading}
        />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
            }}
            placeholder={t('tahsilat.filters.search')}
            minimal
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t('tahsilat.filters.dateFrom')}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t('tahsilat.filters.dateTo')}
          />
          <select
            value={serviceCategory}
            onChange={(e) => setServiceCategory(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm px-3"
          >
            <option value="">{t('tahsilat.filters.allCategories')}</option>
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`tahsilat.category.${category}`)}
              </option>
            ))}
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm px-3"
          >
            <option value="">{t('tahsilat.filters.allStatuses')}</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`tahsilat.status.${status}`)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-12 flex justify-center">
          <Spinner />
        </Card>
      ) : summaries.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            title={t('tahsilat.noResults')}
            description={t('tahsilat.noResultsDesc')}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 shrink-0 py-3 px-4" />
                  <th className="w-[30%] min-w-0 text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest">
                    {t('tahsilat.table.customer')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.documentCount')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.totalBilled')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.collected')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.outstanding')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.cost')}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.profit')}
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.status')}
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                    {t('tahsilat.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {summaries.map((row) => {
                  const isExpanded = expandedCustomerId === row.customer_id;

                  return (
                    <Fragment key={row.customer_id}>
                      <tr
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleCustomer(row.customer_id)}
                            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 w-[30%] min-w-0">
                          <span
                            className="block truncate font-medium text-neutral-900 dark:text-neutral-100"
                            title={row.customer_name}
                          >
                            {row.customer_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">{row.document_count}</td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {formatCurrency(row.total_billed, 'TRY')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {formatCurrency(row.total_collected, 'TRY')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-primary-600 whitespace-nowrap">
                          {formatCurrency(row.outstanding, 'TRY')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                          {formatCurrency(Number(row.total_cost) || 0, 'TRY')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {formatCurrency(Number(row.total_profit) || 0, 'TRY')}
                        </td>
                        <td className="py-3 px-4">
                          <CustomerStatusBadge row={row} />
                        </td>
                        <td className="py-3 px-4" />
                      </tr>
                      {isExpanded && (
                        <tr className="bg-neutral-50/50 dark:bg-neutral-900/20">
                          <td colSpan={MAIN_SUMMARY_COLUMNS} className="p-0 align-top">
                            <CustomerDocumentsPanel
                              customerId={row.customer_id}
                              filters={filterProps}
                              onAddPayment={setSelectedTransaction}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t('common:pagination.previous')}
            </Button>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('common:pagination.page')} {page + 1}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={summaries.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common:pagination.next')}
            </Button>
          </div>
        </Card>
      )}

      <AddPaymentModal
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </PageContainer>
  );
}
