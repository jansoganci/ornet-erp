import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Package,
  Edit2,
  Trash2,
  Filter,
  Upload,
  History,
  Menu,
  X,
  Calendar,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  ListboxSelect,
  Table,
  Badge,
  Card,
  EmptyState,
  Spinner,
  ErrorState,
  IconButton,
  Modal,
  TableSkeleton,
} from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMobileSidebar } from '../../contexts/MobileSidebarContext';
import { useMaterials, useDeleteMaterial, useMaterialCategories } from './hooks';
import { MaterialFormModal } from './MaterialFormModal';
import { MaterialUsageModal } from './components/MaterialUsageModal';
import { cn } from '../../lib/utils';

export function MaterialsListPage() {
  const { t } = useTranslation(['materials', 'common']);
  const { t: tCommon } = useTranslation('common');
  const { openMobileSidebar } = useMobileSidebar();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const category = searchParams.get('category') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [usageModalMaterial, setUsageModalMaterial] = useState(null);
  const [periodPanelOpen, setPeriodPanelOpen] = useState(false);

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
      year: yearParam || undefined,
      month: monthParam || undefined,
    }),
    [debouncedSearch, category, yearParam, monthParam],
  );

  const navigate = useNavigate();
  const { data: materials = [], isLoading, error, refetch } = useMaterials(filterPayload);
  const { data: allMaterials = [], isLoading: isLoadingAll } = useMaterials({});
  const { data: categories = [] } = useMaterialCategories();
  const deleteMutation = useDeleteMaterial();

  const isFilterActive = useMemo(
    () =>
      debouncedSearch.trim().length > 0 ||
      category !== 'all' ||
      Boolean(yearParam) ||
      Boolean(monthParam),
    [debouncedSearch, category, yearParam, monthParam],
  );

  const monthLabels = t('notifications:months', { returnObjects: true });

  const periodChipLabel = useMemo(() => {
    if (!yearParam && !monthParam) return t('materials:filters.allPeriods');
    const y = yearParam || String(new Date().getFullYear());
    if (yearParam && monthParam) {
      return `${monthLabels[monthParam] ?? monthParam} ${y}`;
    }
    if (yearParam) return y;
    if (monthParam) {
      return `${monthLabels[monthParam] ?? monthParam} ${new Date().getFullYear()}`;
    }
    return t('materials:filters.allPeriods');
  }, [yearParam, monthParam, monthLabels, t]);

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

  const clearPeriodFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('year');
      next.delete('month');
      return next;
    });
    setPeriodPanelOpen(false);
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

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const yearOptions = [
    { value: 'all', label: t('materials:filters.all') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  const monthOptions = [
    { value: 'all', label: t('materials:filters.all') },
    ...Object.entries(monthLabels).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

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
      header: t('materials:list.columns.category'),
      accessor: 'category',
      width: 150,
      render: (val) => (
        <Badge
          variant="secondary"
          className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-none"
        >
          {t(`materials:categories.${val}`) || val}
        </Badge>
      ),
    },
    {
      header: t('materials:list.columns.unit'),
      accessor: 'unit',
      width: 100,
      render: (val) => (
        <span className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest">
          {t(`materials:units.${val}`) || val}
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
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          type="button"
          onClick={() => handleFilterChange('category', 'all')}
          className={chipClass(category === 'all')}
        >
          {t('materials:filters.all')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleFilterChange('category', cat)}
            className={chipClass(category === cat)}
          >
            {t(`materials:categories.${cat}`) || cat}
          </button>
        ))}
      </div>
    </div>
  );

  const periodSelectors = (
    <div className="flex flex-col sm:flex-row gap-3 w-full sm:items-end">
      <div className="w-full sm:flex-1 sm:max-w-[12rem]">
        <ListboxSelect
          options={yearOptions}
          value={yearParam || 'all'}
          onChange={(v) => handleFilterChange('year', v)}
          placeholder={t('materials:filters.selectYear')}
          size="sm"
        />
      </div>
      <div className="w-full sm:flex-1 sm:max-w-[14rem]">
        <ListboxSelect
          options={monthOptions}
          value={monthParam || 'all'}
          onChange={(v) => handleFilterChange('month', v)}
          placeholder={t('materials:filters.selectMonth')}
          size="sm"
        />
      </div>
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
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20 shrink-0"
            aria-label={t('materials:list.addButton')}
          >
            <Plus className="w-5 h-5" />
          </button>
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

      {/* All breakpoints: search + category chips; desktop: period row */}
      <Card className="p-3 md:p-4 border-neutral-200/60 dark:border-neutral-800/60">
        {filterToolbar}
        <div className="hidden md:block mt-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
          {periodSelectors}
        </div>
      </Card>

      {/* Mobile: period filter pill + chip */}
      <section className="flex items-center gap-3 overflow-x-auto pb-1 md:hidden scrollbar-hide">
        <button
          type="button"
          onClick={() => setPeriodPanelOpen((v) => !v)}
          className="flex items-center gap-2 bg-neutral-100 dark:bg-[#201f1f] px-4 py-2 rounded-full border border-neutral-200 dark:border-[#494847]/20 active:scale-95 transition-transform shrink-0 min-h-[44px]"
        >
          <Filter className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {t('materials:filters.period')}
          </span>
          {(yearParam || monthParam) && (
            <span className="bg-primary-600 text-white text-[0.625rem] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center">
              {(yearParam ? 1 : 0) + (monthParam ? 1 : 0)}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setPeriodPanelOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 shrink-0 rounded-lg px-3 py-2 text-xs font-medium min-h-[44px]',
            'border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1f1f1f]',
            'text-neutral-800 dark:text-neutral-100',
          )}
        >
          <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <span className="max-w-[140px] truncate">{periodChipLabel}</span>
        </button>
        {(yearParam || monthParam) && (
          <button
            type="button"
            onClick={clearPeriodFilters}
            className="shrink-0 p-2 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            aria-label={tCommon('actions.clear')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </section>

      {periodPanelOpen && (
        <section className="md:hidden bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/20 space-y-3">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {t('materials:filters.periodPanelTitle')}
          </p>
          {periodSelectors}
        </section>
      )}

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
            <TableSkeleton cols={7} />
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
                  <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[45%]">
                    <Badge
                      variant="secondary"
                      className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-none text-xs truncate max-w-full"
                    >
                      {row.category ? t(`materials:categories.${row.category}`) || row.category : '—'}
                    </Badge>
                    <span className="text-[0.625rem] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                      {t(`materials:units.${row.unit}`) || row.unit}
                    </span>
                  </div>
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
