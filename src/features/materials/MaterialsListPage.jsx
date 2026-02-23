import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Package, Search, Edit2, Trash2, Filter, Upload, ClipboardList } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  Select,
  Table,
  Badge,
  Card,
  EmptyState,
  Spinner,
  ErrorState,
  IconButton,
  Modal,
  TableSkeleton,
  DateRangeFilter,
} from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMaterials, useDeleteMaterial, useMaterialCategories } from './hooks';
import { MaterialFormModal } from './MaterialFormModal';
import { MaterialUsageModal } from './components/MaterialUsageModal';

export function MaterialsListPage() {
  const { t } = useTranslation(['materials', 'common']);
  const { t: tCommon } = useTranslation('common');

  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const category = searchParams.get('category') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — setState in effect is intentional
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const handleFilterChange = (key, value) => {
    if (key === 'search') {
      setLocalSearch(value ?? '');
      return;
    }
    setSearchParams((prev) => {
      if (value && value !== 'all' && value !== '') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [usageModalMaterial, setUsageModalMaterial] = useState(null);

  // Hooks
  const navigate = useNavigate();
  const { data: materials = [], isLoading, error, refetch } = useMaterials({
    search: debouncedSearch,
    category: category === 'all' ? undefined : category,
    year: yearParam || undefined,
    month: monthParam || undefined,
  });
  const { data: categories = [] } = useMaterialCategories();
  const deleteMutation = useDeleteMaterial();

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedMaterial(null);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (materialToDelete) {
      await deleteMutation.mutateAsync(materialToDelete.id);
      setMaterialToDelete(null);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const yearOptions = [
    { value: 'all', label: t('materials:filters.all') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  const monthOptions = [
    { value: 'all', label: t('materials:filters.all') },
    ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

  const columns = [
    {
      header: t('materials:list.columns.code'),
      accessor: 'code',
      width: 120,
      render: (val) => <span className="font-mono font-bold text-red-600 dark:text-red-500">{val}</span>
    },
    {
      header: t('materials:usage.columnHeader'),
      id: 'usage',
      width: 80,
      render: (_, row) => (
        <IconButton
          icon={ClipboardList}
          size="sm"
          variant="ghost"
          aria-label={t('materials:usage.title')}
          onClick={(e) => {
            e.stopPropagation();
            setUsageModalMaterial(row);
          }}
        />
      )
    },
    {
      header: t('materials:list.columns.name'),
      accessor: 'name',
      render: (val) => (
        <div className="max-w-[300px]">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate" title={val}>
            {val}
          </p>
        </div>
      )
    },
    {
      header: t('materials:list.columns.category'),
      accessor: 'category',
      width: 150,
      render: (val) => (
        <Badge variant="secondary" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-none">
          {t(`materials:categories.${val}`) || val}
        </Badge>
      )
    },
    {
      header: t('materials:list.columns.unit'),
      accessor: 'unit',
      width: 100,
      render: (val) => <span className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest">{t(`materials:units.${val}`) || val}</span>
    },
    {
      header: t('materials:list.columns.status'),
      accessor: 'is_active',
      width: 120,
      render: (val) => (
        <Badge variant={val ? 'success' : 'error'} dot>
          {val ? t('materials:status.active') : t('materials:status.inactive')}
        </Badge>
      )
    },
    {
      header: tCommon('actions.actionsColumn'),
      id: 'actions',
      stickyRight: true,
      render: (_, row) => (
        <div className="flex justify-end space-x-1">
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            aria-label={tCommon('actions.edit')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
            onClick={(e) => { e.stopPropagation(); setMaterialToDelete(row); }}
            aria-label={tCommon('actions.delete')}
          />
        </div>
      )
    }
  ];

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('materials:title')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('materials:title') }
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/materials/import')}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              {t('materials:import.title')}
            </Button>
            <Button
              onClick={handleAdd}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-lg shadow-primary-600/20"
            >
              {t('materials:list.addButton')}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-3 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col lg:flex-row items-end gap-3">
          <div className="flex-1 min-w-[200px] w-full">
            <SearchInput
              placeholder={t('materials:list.searchPlaceholder')}
              value={localSearch}
              onChange={(v) => handleFilterChange('search', v)}
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <div className="w-full sm:flex-1 md:w-48">
              <Select
                label={t('materials:filters.category')}
                options={[
                  { value: 'all', label: t('materials:filters.all') },
                  ...categories.map(cat => ({ value: cat, label: t(`materials:categories.${cat}`) || cat }))
                ]}
                value={category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                leftIcon={<Filter className="w-4 h-4" />}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <Select
                label={t('materials:filters.selectYear')}
                options={yearOptions}
                value={yearParam}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <Select
                label={t('materials:filters.selectMonth')}
                options={monthOptions}
                value={monthParam}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" />
          <p className="text-sm text-neutral-500 animate-pulse">{tCommon('loading')}</p>
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('materials:list.noMaterials')}
          description={debouncedSearch ? tCommon('noResults') : t('materials:list.noMaterials')}
          actionLabel={t('materials:list.addButton')}
          onAction={handleAdd}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={materials}
            onRowClick={handleEdit}
            className="border-none"
          />
        </div>
      )}

      {/* Usage History Modal */}
      <MaterialUsageModal
        open={!!usageModalMaterial}
        onClose={() => setUsageModalMaterial(null)}
        material={usageModalMaterial}
      />

      {/* Form Modal */}
      <MaterialFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        material={selectedMaterial}
      />

      {/* Delete Confirmation */}
      <Modal
        open={!!materialToDelete}
        onClose={() => setMaterialToDelete(null)}
        title={tCommon('labels.areYouSure')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setMaterialToDelete(null)} className="flex-1">
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending} className="flex-1">
              {tCommon('actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">
          <span className="font-bold text-primary-600">{materialToDelete?.code}</span> - {materialToDelete?.name} {tCommon('deleteConfirm')}
        </p>
      </Modal>
    </PageContainer>
  );
}
