import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, MapPin, Upload, Download } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchInput } from '../../hooks/useSearchInput';
import { useAllSites } from '../customerSites/hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, SearchInput, Table, EmptyState, ErrorState } from '../../components/ui';
import { useRole } from '../../lib/roles';
import { fetchCustomer } from './api';
import { customerKeys } from './hooks';

export function CustomersListPage() {
  const { t } = useTranslation(['customers', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite } = useRole();
  const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });

  const { data: sites, isLoading, error, refetch } = useAllSites({ search: debouncedSearch, enabled: true });

  const handleRowClick = (site) => {
    navigate(`/customers/${site.customer_id}`);
  };

  const handleRowHover = useCallback((site) => {
    if (!site.customer_id) return;
    queryClient.prefetchQuery({
      queryKey: customerKeys.detail(site.customer_id),
      queryFn: () => fetchCustomer(site.customer_id),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  const handleAddCustomer = () => {
    navigate('/customers/new');
  };

  const handleImport = () => {
    navigate('/customers/import');
  };

  const handleExportExcel = () => {
    const headers = ['MÜŞTERİ', 'ABONE ÜNVANI', 'MERKEZ', 'ACC.', 'LOKASYON', 'İL', 'İLÇE', 'BAĞLANTI TARİHİ'];
    const rows = (sites || []).map((site) => [
      site.customers?.company_name || '',
      site.customers?.subscriber_title || '',
      site.alarm_center || '',
      site.account_no || '',
      site.site_name || '',
      site.city || '',
      site.district || '',
      site.connection_date ? format(new Date(site.connection_date), 'dd.MM.yyyy') : '',
    ]);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Müşteriler');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `musteri_export_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'company_name',
      header: t('list.siteColumns.company'),
      cellClassName: 'whitespace-normal',
      render: (_, site) => (
        <span className="font-medium text-neutral-900 dark:text-neutral-50 max-w-[200px] break-words">
          {site.customers?.company_name || '—'}
        </span>
      ),
    },
    {
      key: 'subscriber_title',
      header: t('list.siteColumns.subscriberTitle'),
      cellClassName: 'whitespace-normal align-top',
      headerClassName: 'whitespace-normal',
      minWidth: 140,
      maxWidth: 200,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50 min-w-0 break-words block">
          {site.customers?.subscriber_title || '—'}
        </span>
      ),
    },
    {
      key: 'alarm_center',
      header: t('list.siteColumns.alarmCenter'),
      hideOnMobile: true,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50">{site.alarm_center || '—'}</span>
      ),
    },
    {
      key: 'account_no',
      header: t('list.siteColumns.accountNo'),
      render: (_, site) => (
        <span className="font-mono text-neutral-900 dark:text-neutral-50">{site.account_no || '—'}</span>
      ),
    },
    {
      key: 'site_name',
      header: t('list.siteColumns.siteName'),
      cellClassName: 'whitespace-normal align-top',
      headerClassName: 'whitespace-normal',
      minWidth: 140,
      maxWidth: 200,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50 min-w-0 break-words block">
          {site.site_name || '—'}
        </span>
      ),
    },
    {
      key: 'city',
      header: t('list.siteColumns.city'),
      hideOnMobile: true,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50">{site.city || '—'}</span>
      ),
    },
    {
      key: 'district',
      header: t('list.siteColumns.district'),
      hideOnMobile: true,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50">{site.district || '—'}</span>
      ),
    },
    {
      key: 'connection_date',
      header: t('list.siteColumns.connectionDate'),
      hideOnMobile: true,
      render: (_, site) => (
        <span className="text-neutral-900 dark:text-neutral-50">
          {site.connection_date ? format(new Date(site.connection_date), 'dd.MM.yyyy') : '—'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default">
      <PageHeader
        title={t('list.title')}
        actions={
          canWrite && (
            <div className="flex gap-2 w-full sm:w-auto sm:flex-initial">
              <Button
                variant="outline"
                leftIcon={<Download className="w-5 h-5" />}
                onClick={handleExportExcel}
                className="flex-1 min-w-0 sm:flex-initial"
              >
                {t('list.exportButton')}
              </Button>
              <Button
                variant="outline"
                leftIcon={<Upload className="w-5 h-5" />}
                onClick={handleImport}
                className="hidden lg:inline-flex"
              >
                {t('common:import.bulkImportButton')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={handleAddCustomer}
                className="flex-1 min-w-0 sm:flex-initial"
              >
                {t('list.addButton')}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-6 mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('list.searchPlaceholder')}
        />

        {!isLoading && sites != null && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400 shrink-0">
            {t('list.siteCount', { count: sites.length })}
          </span>
        )}
      </div>

      {error && !isLoading && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {!error && (
        <Table
          columns={columns}
          data={sites || []}
          loading={isLoading}
          onRowClick={handleRowClick}
          onRowMouseEnter={handleRowHover}
          emptyState={
            <EmptyState
              icon={debouncedSearch ? null : MapPin}
              title={debouncedSearch ? t('list.noResults.title') : t('list.empty.title')}
              description={debouncedSearch ? t('list.noResults.description') : t('list.empty.description')}
              actionLabel={debouncedSearch ? null : t('list.empty.action')}
              onAction={debouncedSearch ? null : handleAddCustomer}
            />
          }
        />
      )}
    </PageContainer>
  );
}
