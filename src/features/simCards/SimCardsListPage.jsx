import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Plus, Download, Filter, MoreVertical, Edit2, Trash2, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { useSimCards, useDeleteSimCard, useSimFinancialStats } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  SearchInput, 
  Select,
  Card, 
  Spinner, 
  Badge, 
  EmptyState, 
  Skeleton, 
  ErrorState,
  Table
} from '../../components/ui';
import { SimCardStats } from './components/SimCardStats';

export function SimCardsListPage() {
  const { t } = useTranslation('simCards');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: simCards, isLoading, error, refetch } = useSimCards();
  const { data: simStats } = useSimFinancialStats();
  const deleteSimMutation = useDeleteSimCard();

  const filteredSimCards = simCards?.filter(sim => {
    const matchesSearch = 
      sim.phone_number?.toLowerCase().includes(search.toLowerCase()) ||
      sim.imsi?.toLowerCase().includes(search.toLowerCase()) ||
      sim.account_no?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sim.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAdd = () => navigate('/sim-cards/new');
  const handleImport = () => navigate('/sim-cards/import');
  const handleEdit = (id) => navigate(`/sim-cards/${id}/edit`);

  const handleExport = () => {
    if (!filteredSimCards?.length) return;

    const exportData = filteredSimCards.map(sim => ({
      [t('list.columns.phoneNumber')]: sim.phone_number,
      [t('list.columns.imsi')]: sim.imsi,
      [t('list.columns.iccid')]: sim.iccid,
      [t('list.columns.operator')]: t(`operators.${sim.operator}`),
      [t('list.columns.status')]: t(`status.${sim.status}`),
      [t('list.columns.customer')]: sim.customers?.company_name || '-',
      [t('list.columns.site')]: sim.customer_sites?.site_name || '-',
      [t('list.columns.costPrice')]: sim.cost_price,
      [t('list.columns.salePrice')]: sim.sale_price,
      [t('form.notes')]: sim.notes
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SIM_Cards");
    XLSX.writeFile(wb, `Ornet_SIM_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = async (id) => {
    if (window.confirm(tCommon('confirm.deleteMessage'))) {
      await deleteSimMutation.mutateAsync(id);
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'available': return 'info';
      case 'inactive': return 'warning';
      case 'sold': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl">
        <PageHeader title={t('title')} />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExport}
              disabled={!filteredSimCards?.length}
            >
              {tCommon('actions.export')}
            </Button>
            <Button
              variant="outline"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleImport}
            >
              {t('actions.import')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAdd}
              className="shadow-lg shadow-primary-600/20"
            >
              {t('actions.add')}
            </Button>
          </div>
        }
      />

      <SimCardStats simCards={simCards} statsData={simStats} />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('list.columns.phoneNumber') + ', ' + t('list.columns.imsi') + '...'}
              className="w-full"
            />
          </div>
          
          <div className="w-full md:w-64">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: t('list.filters.all') },
                { value: 'available', label: t('list.filters.available') },
                { value: 'active', label: t('list.filters.active') },
                { value: 'inactive', label: t('list.filters.inactive') },
                { value: 'sold', label: t('list.filters.sold') }
              ]}
              leftIcon={<Filter className="w-4 h-4" />}
            />
          </div>
        </div>
      </Card>

      {!filteredSimCards?.length ? (
        <EmptyState
          title={t('list.empty.title')}
          description={t('list.empty.description')}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('list.columns.phoneNumber')}</th>
                  <th className="px-4 py-3 font-medium">{t('list.columns.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('list.columns.operator')}</th>
                  <th className="px-4 py-3 font-medium">{t('list.columns.customer')}</th>
                  <th className="px-4 py-3 font-medium">{t('list.columns.salePrice')}</th>
                  <th className="px-4 py-3 font-medium text-right">{tCommon('actions.menu')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredSimCards.map((sim) => (
                  <tr key={sim.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900 dark:text-neutral-50">
                        {sim.phone_number}
                      </div>
                      <div className="text-xs text-neutral-500">{sim.imsi}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(sim.status)}>
                        {t(`status.${sim.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {t(`operators.${sim.operator}`)}
                    </td>
                    <td className="px-4 py-3">
                      {sim.customers?.company_name || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: sim.currency }).format(sim.sale_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(sim.id)}
                          leftIcon={<Edit2 className="w-4 h-4" />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sim.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          leftIcon={<Trash2 className="w-4 h-4" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
