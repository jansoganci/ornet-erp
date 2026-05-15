import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Package, Edit2, Trash2, Upload, History, Menu, Pencil } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  Table,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  TableSkeleton,
} from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMobileSidebar } from '../../contexts/MobileSidebarContext';
import { useMaterials, useDeleteMaterial, useMaterialCategories, useUpdateMaterial } from './hooks';
import { MaterialFormModal } from './MaterialFormModal';
import { MaterialUsageModal } from './components/MaterialUsageModal';
import { QuickMaterialPriceField } from './components/QuickMaterialPriceField';
import { QuickMaterialCurrencySelect } from './components/QuickMaterialCurrencySelect';
import { cn, formatCurrency } from '../../lib/utils';

export function MaterialsListPage() {
  const { t } = useTranslation(['materials', 'common']);
  const { t: tCommon } = useTranslation('common');
  const { openMobileSidebar } = useMobileSidebar();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const category = searchParams.get('category') || 'all';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [usageModalMaterial, setUsageModalMaterial] = useState(null);
  const [quickEditMode, setQuickEditMode] = useState(false);

  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const filterPayload = useMemo(
    () => ({
      search: debouncedSearch,
      category: category === 'all' ? undefined : category,
    }),
    [debouncedSearch, category],
  );

  const navigate = useNavigate();
  const { data: materials = [], isLoading, error, refetch } = useMaterials(filterPayload);
  const { data: allMaterials = [], isLoading: isLoadingAll } = useMaterials({});
  const { data: categories = [] } = useMaterialCategories();
  const deleteMutation = useDeleteMaterial();
  const updateMaterialMutation = useUpdateMaterial();

  const handleQuickFieldUpdate = useCallback(
    async (materialId, patch) => {
      await updateMaterialMutation.mutateAsync({ id: materialId, data: patch });
    },
    [updateMaterialMutation],
  );

  const currencyOptions = useMemo(
    () => [
      { value: 'TRY', label: tCommon('currencies.TRY') },
      { value: 'USD', label: tCommon('currencies.USD') },
    ],
    [tCommon],
  );

  const isFilterActive = useMemo(
    () => debouncedSearch.trim().length > 0 || category !== 'all',
    [debouncedSearch, category],
  );

  const kpi = useMemo(() => {
    const total = allMaterials.length;
    const active = allMaterials.filter((m) => m.is_active).length;
    const filtered = materials.length;
    const uniqueCats = new Set(materials.map((m) => m.category).filter(Boolean)).size;
    return { total, active, filtered, uniqueCats };
  }, [allMaterials, materials]);

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

  const chipClass = (active) =>
    cn(
      'whitespace-nowrap shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center active:scale-[0.98]',
      active
        ? 'bg-primary-600 text-white shadow-md dark:bg-primary-600 dark:text-white'
        : 'border border-neutral-200 bg-white text-neutral-800 dark:border-[#262626] dark:bg-[#1f1f1f] dark:text-neutral-100',
    );

  const columns = [
    {
      header: t('materials:list.columns.code'),
      accessor: 'code',
      width: 120,
      render: (val) => <span className="font-mono font-bold text-red-600 dark:text-red-500">{val}</span>,
    },
    {
      header: t('materials:usage.columnHeader'),
      id: 'usage',
      width: 80,
      render: (_, row) => (
        <IconButton
          icon={History}
          size="sm"
          variant="ghost"
          aria-label={t('materials:usage.title')}
          onClick={(e) => {
            e.stopPropagation();
            setUsageModalMaterial(row);
          }}
        />
      ),
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
      ),
    },
    {
      header: t('materials:list.columns.unit'),
      accessor: 'unit',
      width: 100,
      render: (val) => (
        <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
          {t(`materials:units.${val}`, { defaultValue: val })}
        </span>
      ),
    },
    {
      header: t('materials:list.columns.unitCost'),
      accessor: 'cost_price',
      width: 130,
      render: (val, row) =>
        quickEditMode ? (
          <QuickMaterialPriceField
            material={row}
            field="cost_price"
            onUpdate={handleQuickFieldUpdate}
            label={t('materials:list.columns.unitCost')}
          />
        ) : (
          <span className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-nowrap tabular-nums">
            {val != null && val !== ''
              ? formatCurrency(Number(val), row.currency ?? 'TRY')
              : '—'}
          </span>
        ),
    },
    {
      header: t('materials:list.columns.unitSale'),
      accessor: 'unit_price',
      width: 130,
      render: (val, row) =>
        quickEditMode ? (
          <QuickMaterialPriceField
            material={row}
            field="unit_price"
            onUpdate={handleQuickFieldUpdate}
            label={t('materials:list.columns.unitSale')}
          />
        ) : (
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50 whitespace-nowrap tabular-nums">
            {val != null && val !== ''
              ? formatCurrency(Number(val), row.currency ?? 'TRY')
              : '—'}
          </span>
        ),
    },
    {
      header: t('materials:list.columns.currency'),
      accessor: 'currency',
      width: 118,
      render: (_, row) =>
        quickEditMode ? (
          <QuickMaterialCurrencySelect
            material={row}
            onUpdate={handleQuickFieldUpdate}
            options={currencyOptions}
            placeholder={t('materials:list.columns.currency')}
            disabled={updateMaterialMutation.isPending}
          />
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            {row.currency ? tCommon(`currencies.${row.currency}`) : tCommon('currencies.TRY')}
          </span>
        ),
    },
    {
      header: t('materials:list.columns.status'),
      accessor: 'is_active',
      width: 120,
      render: (val) => (
        <Badge variant={val ? 'success' : 'error'} dot>
          {val ? t('materials:status.active') : t('materials:status.inactive')}
        </Badge>
      ),
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
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            aria-label={tCommon('actions.edit')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
            onClick={(e) => {
              e.stopPropagation();
              setMaterialToDelete(row);
            }}
            aria-label={tCommon('actions.delete')}
          />
        </div>
      ),
    },
  ];

  const filterToolbar = (
    <div className="space-y-3">
      <SearchInput
        placeholder={t('materials:list.searchPlaceholder')}
        value={localSearch}
        onChange={(v) => handleFilterChange('search', v)}
        size="sm"
      />
      {categories.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                category === cat ? handleFilterChange('category', 'all') : handleFilterChange('category', cat)
              }
              className={chipClass(category === cat)}
            >
              {t(`materials:categories.${cat}`, { defaultValue: cat })}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <div className="hidden md:block">
          <PageHeader
            title={t('materials:title')}
            breadcrumbs={[
              { label: t('common:nav.dashboard'), to: '/' },
              { label: t('materials:title') },
            ]}
          />
        </div>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      {/* Desktop header */}
      <div className="hidden md:block">
        <PageHeader
          title={t('materials:title')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('materials:title') },
          ]}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/materials/import')}
                leftIcon={<Upload className="w-4 h-4" />}
                className="hidden md:inline-flex"
              >
                {t('common:import.bulkImportButton')}
              </Button>
              <Button
                type="button"
                variant={quickEditMode ? 'primary' : 'outline'}
                onClick={() => setQuickEditMode((v) => !v)}
                leftIcon={<Pencil className="w-4 h-4" />}
                className="hidden lg:inline-flex"
              >
                {t('materials:list.quickEdit')}
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
      </div>

      {/* Mobile sticky header */}
      <div
        className={cn(
          'md:hidden sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-1',
          'border-b border-neutral-200 dark:border-[#262626]',
          'bg-white/95 dark:bg-[#0e0e0e]/95 backdrop-blur-md',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={openMobileSidebar}
              className="p-2 -ml-2 rounded-full shrink-0 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label={t('materials:mobile.openMenu')}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight truncate">
              {t('materials:list.mobileTitle')}
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuickEditMode((v) => !v)}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl border transition-colors active:scale-95',
                quickEditMode
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-700 dark:text-neutral-200',
              )}
              aria-label={t('materials:list.quickEdit')}
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              aria-label={t('materials:list.addButton')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile KPI */}
      <section className="grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('materials:kpi.total')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tabular-nums">
            {isLoadingAll ? '…' : kpi.total}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('materials:kpi.active')}
          </p>
          <p className="text-green-600 dark:text-green-400 font-bold text-xl tabular-nums">
            {isLoadingAll ? '…' : kpi.active}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('materials:kpi.categories')}
          </p>
          <p className="text-amber-600 dark:text-amber-400 font-bold text-xl tabular-nums">
            {isLoading ? '…' : kpi.uniqueCats}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('materials:kpi.filtered')}
          </p>
          <p
            className={cn(
              'font-bold text-xl tabular-nums',
              isFilterActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-400 dark:text-neutral-500',
            )}
          >
            {isLoading ? '…' : kpi.filtered}
          </p>
        </div>
      </section>

      <Card className="p-3 md:p-4 border-neutral-200/60 dark:border-neutral-800/60">
        {filterToolbar}
        <div className="hidden md:flex lg:hidden md:flex-row md:items-end md:justify-end md:gap-4 mt-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <Button
            type="button"
            variant={quickEditMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setQuickEditMode((v) => !v)}
            leftIcon={<Pencil className="w-4 h-4" />}
            className="shrink-0"
          >
            {t('materials:list.quickEdit')}
          </Button>
        </div>
        {quickEditMode ? (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 leading-snug">
            {t('materials:list.quickEditHint')}
          </p>
        ) : null}
      </Card>

      {isLoading ? (
        <>
          <div className="md:hidden space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5 animate-pulse"
              >
                <div className="h-4 w-[75%] bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
                <div className="h-3 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <TableSkeleton cols={9} />
          </div>
        </>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('materials:list.noMaterials')}
          description={debouncedSearch ? tCommon('noResults') : t('materials:list.noMaterials')}
          actionLabel={t('materials:list.addButton')}
          onAction={handleAdd}
        />
      ) : (
        <>
          <section className="space-y-3 lg:hidden">
            {materials.map((row) => (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(row)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit(row)}
                className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5 active:bg-neutral-50 dark:active:bg-[#262626] transition-colors cursor-pointer"
              >
                <div className="flex justify-between gap-3 items-start">
                  <div className="flex gap-2.5 min-w-0 flex-1">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full shrink-0',
                        row.is_active ? 'bg-emerald-500' : 'bg-red-500',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 truncate">
                        {row.code}
                      </p>
                      <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-50 truncate">
                        {row.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-center shrink-0">
                    <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium tabular-nums text-right">
                      {t(`materials:units.${row.unit}`, { defaultValue: row.unit })}
                    </span>
                  </div>
                </div>
                <div
                  className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#262626] space-y-3"
                  onClick={(e) => quickEditMode && e.stopPropagation()}
                >
                  {quickEditMode ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                          {t('materials:list.columns.unitCost')}
                        </span>
                        <QuickMaterialPriceField
                          material={row}
                          field="cost_price"
                          onUpdate={handleQuickFieldUpdate}
                          label={t('materials:list.columns.unitCost')}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                          {t('materials:list.columns.unitSale')}
                        </span>
                        <QuickMaterialPriceField
                          material={row}
                          field="unit_price"
                          onUpdate={handleQuickFieldUpdate}
                          label={t('materials:list.columns.unitSale')}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                          {t('materials:list.columns.currency')}
                        </span>
                        <QuickMaterialCurrencySelect
                          material={row}
                          onUpdate={handleQuickFieldUpdate}
                          options={currencyOptions}
                          placeholder={t('materials:list.columns.currency')}
                          disabled={updateMaterialMutation.isPending}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {t('materials:list.columns.unitCost')}
                      </span>
                      <span className="text-right font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                        {row.cost_price != null && row.cost_price !== ''
                          ? formatCurrency(Number(row.cost_price), row.currency ?? 'TRY')
                          : '—'}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {t('materials:list.columns.unitSale')}
                      </span>
                      <span className="text-right font-mono tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                        {row.unit_price != null && row.unit_price !== ''
                          ? formatCurrency(Number(row.unit_price), row.currency ?? 'TRY')
                          : '—'}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {t('materials:list.columns.currency')}
                      </span>
                      <span className="text-right font-semibold uppercase text-neutral-700 dark:text-neutral-300">
                        {row.currency ? tCommon(`currencies.${row.currency}`) : tCommon('currencies.TRY')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-100 dark:border-[#262626]">
                  <IconButton
                    icon={History}
                    size="sm"
                    variant="ghost"
                    aria-label={t('materials:usage.title')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUsageModalMaterial(row);
                    }}
                  />
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      icon={Edit2}
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(row);
                      }}
                      aria-label={tCommon('actions.edit')}
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      variant="ghost"
                      className="text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMaterialToDelete(row);
                      }}
                      aria-label={tCommon('actions.delete')}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="hidden lg:block bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
            <Table columns={columns} data={materials} onRowClick={handleEdit} className="border-none" />
          </div>
        </>
      )}

      <MaterialUsageModal
        open={!!usageModalMaterial}
        onClose={() => setUsageModalMaterial(null)}
        material={usageModalMaterial}
      />

      <MaterialFormModal open={isModalOpen} onClose={() => setIsModalOpen(false)} material={selectedMaterial} />

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
          <span className="font-bold text-primary-600">{materialToDelete?.code}</span> -{' '}
          {materialToDelete?.name} {tCommon('deleteConfirm')}
        </p>
      </Modal>
    </PageContainer>
  );
}
