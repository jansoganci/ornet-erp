import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import {
  Plus,
  Download,
  Filter,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Pencil,
  Cpu as SimIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  ArrowLeft,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { useSimCardsPaginated, useUpdateSimCard, useSimFinancialStats, useProviderCompanies, useCancelSimCard } from './hooks';
import { fetchSimCards } from './api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  ListboxSelect,
  Badge,
  EmptyState,
  Skeleton,
  ErrorState,
  Table,
  IconButton,
  Modal,
  KpiCard,
} from '../../components/ui';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { QuickStatusSelect } from './components/QuickStatusSelect';

/** Uniform trigger height in SIM list filter controls (matches `SearchInput` / `Input` sm). */
const SIM_FILTER_LISTBOX_TRIGGER = 'h-10 min-h-[2.5rem] md:h-10';

export function SimCardsListPage() {
  const { t } = useTranslation(['simCards', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [simToCancel, setSimToCancel] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [advancedFiltersExpanded, setAdvancedFiltersExpanded] = useState(() => {
    const op = searchParams.get('operator') || 'all';
    const prov = searchParams.get('provider') || 'all';
    const y1 = searchParams.get('afy') || 'all';
    const m1 = searchParams.get('afm') || 'all';
    const y2 = searchParams.get('aty') || 'all';
    const m2 = searchParams.get('atm') || 'all';
    return (
      (prov && prov !== 'all') ||
      (op && op !== 'all') ||
      y1 !== 'all' ||
      m1 !== 'all' ||
      y2 !== 'all' ||
      m2 !== 'all'
    );
  });
  const activeTab = searchParams.get('tab') || 'active';

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const statusFilter = searchParams.get('status') || 'all';
  const operatorFilter = searchParams.get('operator') || 'all';
  const providerFilter = searchParams.get('provider') || 'all';
  const afy = searchParams.get('afy') || 'all';
  const afm = searchParams.get('afm') || 'all';
  const aty = searchParams.get('aty') || 'all';
  const atm = searchParams.get('atm') || 'all';
  const page = Number(searchParams.get('page') || '0');

  const handleTabChange = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      next.delete('status'); // Clear status filter when changing tabs
      next.delete('page');
      return next;
    });
  };

  const hasAdvancedSimFilters =
    (providerFilter && providerFilter !== 'all') ||
    (operatorFilter && operatorFilter !== 'all') ||
    afy !== 'all' ||
    afm !== 'all' ||
    aty !== 'all' ||
    atm !== 'all';

  const hasActiveSimFilters = useMemo(() => {
    const q = (localSearch && localSearch.trim()) || (searchFromUrl && searchFromUrl.trim());
    return Boolean(
      q ||
        statusFilter !== 'all' ||
        operatorFilter !== 'all' ||
        providerFilter !== 'all' ||
        afy !== 'all' ||
        afm !== 'all' ||
        aty !== 'all' ||
        atm !== 'all'
    );
  }, [
    localSearch,
    searchFromUrl,
    statusFilter,
    operatorFilter,
    providerFilter,
    afy,
    afm,
    aty,
    atm,
  ]);

  const monthSelectOptions = useMemo(
    () => [
      { value: 'all', label: t('list.filters.all') },
      ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
        value: val,
        label,
      })),
    ],
    [t],
  );

  const yearSelectOptions = useMemo(
    () => [
      { value: 'all', label: t('list.filters.all') },
      ...Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map((y) => ({
        value: y,
        label: y,
      })),
    ],
    [t],
  );

  const periodStartDisplay = useMemo(() => {
    if (!afm || afm === 'all' || !afy || afy === 'all') return null;
    const mo = monthSelectOptions.find((o) => String(o.value) === String(afm));
    const monthLabel = mo?.label ?? String(afm);
    return `${monthLabel} ${afy}`;
  }, [afm, afy, monthSelectOptions]);

  const periodEndDisplay = useMemo(() => {
    if (!atm || atm === 'all' || !aty || aty === 'all') return null;
    const mo = monthSelectOptions.find((o) => String(o.value) === String(atm));
    const monthLabel = mo?.label ?? String(atm);
    return `${monthLabel} ${aty}`;
  }, [atm, aty, monthSelectOptions]);

  const activationPeriodSummary = useMemo(() => {
    if (periodStartDisplay && periodEndDisplay) {
      return t('list.filters.activationPeriodSummary', { from: periodStartDisplay, to: periodEndDisplay });
    }
    if (periodStartDisplay || periodEndDisplay) {
      return [periodStartDisplay, periodEndDisplay].filter(Boolean).join(' – ');
    }
    return null;
  }, [periodStartDisplay, periodEndDisplay, t]);

  const hasActivationPeriodSet = afy !== 'all' || afm !== 'all' || aty !== 'all' || atm !== 'all';

  const periodOrderError = useMemo(() => {
    if (afy === 'all' || afm === 'all' || aty === 'all' || atm === 'all') return false;
    const start = new Date(Number(afy), Number(afm) - 1, 1);
    const end = new Date(Number(aty), Number(atm) - 1, 1);
    return end < start;
  }, [afy, afm, aty, atm]);

  // Legacy ?year=&month= links → inclusive month range on both ends
  useEffect(() => {
    const y = searchParams.get('year');
    const m = searchParams.get('month');
    if (!y || y === 'all' || !m || m === 'all') return;
    if (searchParams.get('afy')) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('afy', y);
      next.set('afm', String(Number(m)));
      next.set('aty', y);
      next.set('atm', String(Number(m)));
      next.delete('year');
      next.delete('month');
      next.delete('page');
      return next;
    });
  }, [searchParams, setSearchParams]);

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — reset page on new search
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'all') next.set(key === 'provider_company_id' ? 'provider' : key, value);
      else next.delete(key === 'provider_company_id' ? 'provider' : key);
      next.delete('page');
      return next;
    });
  };

  const handleActivationRangeChange = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('page');
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const clearActivationPeriod = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['afy', 'afm', 'aty', 'atm'].forEach((k) => next.delete(k));
      next.delete('page');
      return next;
    });
  };

  const clearAllSimListFilters = () => {
    setLocalSearch('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('status');
      next.delete('operator');
      next.delete('provider');
      next.delete('afy');
      next.delete('afm');
      next.delete('aty');
      next.delete('atm');
      next.delete('page');
      return next;
    });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage > 0) next.set('page', String(newPage));
      else next.delete('page');
      return next;
    });
  };

  const filters = {
    search: debouncedSearch || undefined,
    status: activeTab === 'cancelled' ? 'cancelled' : (statusFilter !== 'all' ? statusFilter : undefined),
    operator: operatorFilter,
    provider_company_id: providerFilter,
    activationFromYear: afy !== 'all' ? afy : undefined,
    activationFromMonth: afm !== 'all' ? afm : undefined,
    activationToYear: aty !== 'all' ? aty : undefined,
    activationToMonth: atm !== 'all' ? atm : undefined,
  };

  // If activeTab is 'active' and statusFilter is 'all', we need to exclude 'cancelled'
  // But the current API fetchSimCardsPaginated only supports eq('status', filters.status)
  // Let's check api.js again to see if we can exclude.
  // Actually, we can just filter out cancelled if status is all and tab is active.
  // But wait, the API fetchSimCardsPaginated uses .eq('status', filters.status) if filters.status is set.
  // If we don't set status, it fetches all.
  // We might need to adjust api.js to support excluding a status or handle it here.
  // For now, let's assume we want to show everything except cancelled in 'active' tab when status is 'all'.

  const {
    data: simCards,
    isLoading,
    error,
    refetch,
    isFetching,
    totalCount,
    pageCount,
    pageSize,
  } = useSimCardsPaginated(filters, page);
  const { data: simStats } = useSimFinancialStats();
  const { data: providerCompanies } = useProviderCompanies();
  const cancelSimMutation = useCancelSimCard();
  const updateSimCardMutation = useUpdateSimCard();

  const handleAdd = () => navigate('/sim-cards/new');
  const handleImport = () => navigate('/sim-cards/import');
  const handleEdit = (id) => navigate(`/sim-cards/${id}/edit`);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all matching rows (not just current page) for complete export
      const all = await fetchSimCards(filters);
      if (!all?.length) return;

      const exportData = all.filter(sim => {
        if (activeTab === 'active' && statusFilter === 'all') {
          return sim.status !== 'cancelled';
        }
        return true;
      }).map(sim => ({
        [t('list.columns.provider')]: sim.provider_company?.name || '-',
        [t('list.columns.phoneNumber')]: sim.phone_number,
        [t('list.columns.imsi')]: sim.imsi || '-',
        [t('list.columns.capacity')]: sim.capacity || '-',
        [t('list.columns.operator')]: t(`operators.${sim.operator}`),
        [t('list.columns.gprsSerialNo')]: sim.gprs_serial_no || '-',
        [t('list.columns.accountNo')]: sim.account_no || '-',
        [t('list.columns.customerLabel')]: sim.customers?.company_name || sim.customer_label || '-',
        [t('list.columns.activationDate')]: sim.activation_date ? formatDate(sim.activation_date) : '-',
        [t('list.columns.costPrice')]: sim.cost_price,
        [t('list.columns.salePrice')]: sim.sale_price,
        [t('list.columns.status')]: t(`status.${sim.status}`),
        [t('form.notes')]: sim.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SIM_Cards");
      XLSX.writeFile(wb, `Ornet_SIM_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = (row) => {
    setSimToCancel(row);
  };

  const confirmCancel = async () => {
    if (!simToCancel) return;
    try {
      await cancelSimMutation.mutateAsync(simToCancel.id);
    } catch {
      // error handled by mutation onError
    } finally {
      setSimToCancel(null);
    }
  };

  const handleQuickStatusChange = async (simId, newStatus) => {
    await updateSimCardMutation.mutateAsync({ id: simId, status: newStatus });
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'available': return 'info';
      case 'subscription': return 'primary';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" className="space-y-6">
        {/* Mobile Loading Skeleton */}
        <div className="md:hidden space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[90px] w-full rounded-xl" />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
        {/* Desktop Loading Skeleton */}
        <div className="hidden md:block space-y-4">
          <PageHeader title={t('title')} />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="full">
        <ErrorState message={getErrorMessage(error, 'simCards.loadFailed')} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const columns = [
    {
      header: t('list.columns.provider'),
      accessor: 'provider_company',
      render: (_, row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {row.provider_company?.name || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.phoneNumber'),
      accessor: 'phone_number',
      render: (value) => (
        <div className="font-medium text-neutral-900 dark:text-neutral-50">{value}</div>
      ),
    },
    {
      header: t('list.columns.imsi'),
      accessor: 'imsi',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.capacity'),
      accessor: 'capacity',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400">{value || '-'}</span>
      ),
    },
    {
      header: t('list.columns.operator'),
      accessor: 'operator',
      render: (value) => t(`operators.${value}`),
    },
    {
      header: t('list.columns.gprsSerialNo'),
      accessor: 'gprs_serial_no',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.accountNo'),
      accessor: 'account_no',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400">{value || '-'}</span>
      ),
    },
    {
      header: t('list.columns.customerLabel'),
      accessor: 'customers',
      maxWidth: 250,
      cellClassName: 'whitespace-normal break-words align-top',
      render: (_, row) => (
        <span className="break-words">
          {row.customers?.company_name || row.customer_label || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.activationDate'),
      accessor: 'activation_date',
      render: (value) => (
        <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {value ? formatDate(value) : '-'}
        </div>
      ),
    },
    {
      header: t('list.columns.costPrice'),
      accessor: 'cost_price',
      render: (value, row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {formatCurrency(value ?? 0, row.currency ?? 'TRY')}
        </span>
      ),
    },
    {
      header: t('list.columns.salePrice'),
      accessor: 'sale_price',
      render: (value, row) => (
        <span className="font-medium text-neutral-900 dark:text-neutral-50">
          {formatCurrency(value ?? 0, row.currency ?? 'TRY')}
        </span>
      ),
    },
    {
      header: t('list.columns.status'),
      accessor: 'status',
      render: (value, row) => (
        <div onClick={quickEditMode ? (e) => e.stopPropagation() : undefined}>
          {quickEditMode && row.status !== 'subscription' ? (
            <QuickStatusSelect sim={row} onStatusChange={handleQuickStatusChange} t={t} />
          ) : (
            <Badge variant={getStatusVariant(value)}>{t(`status.${value}`)}</Badge>
          )}
        </div>
      ),
    },
    {
      header: t('common:actions.actionsColumn'),
      accessor: 'id',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row.id)}
            aria-label={t('actions.edit')}
          />
          {row.status !== 'cancelled' && (
            <IconButton
              icon={Trash2}
              size="sm"
              variant="ghost"
              onClick={() => handleCancel(row)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-900/20"
              aria-label={t('actions.cancel')}
            />
          )}
        </div>
      ),
    },
  ];

  const activationPeriodBoundaryFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Başlangıç Dönemi */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {t('list.filters.periodStartHeading')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ListboxSelect
            value={afm}
            onChange={(v) => handleActivationRangeChange('afm', v)}
            options={monthSelectOptions}
            placeholder={t('list.filters.selectMonth')}
            size="sm"
            triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
          />
          <ListboxSelect
            value={afy}
            onChange={(v) => handleActivationRangeChange('afy', v)}
            options={yearSelectOptions}
            placeholder={t('list.filters.selectYear')}
            size="sm"
            triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
          />
        </div>
      </div>
      {/* Bitiş Dönemi */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {t('list.filters.periodEndHeading')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ListboxSelect
            value={atm}
            onChange={(v) => handleActivationRangeChange('atm', v)}
            options={monthSelectOptions}
            placeholder={t('list.filters.selectMonth')}
            size="sm"
            triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
          />
          <ListboxSelect
            value={aty}
            onChange={(v) => handleActivationRangeChange('aty', v)}
            options={yearSelectOptions}
            placeholder={t('list.filters.selectYear')}
            size="sm"
            triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
          />
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer maxWidth="full" className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => handleTabChange('active')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'active'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          )}
        >
          {t('tabs.active')}
          {activeTab === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('cancelled')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'cancelled'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          )}
        >
          {t('tabs.cancelled')}
          {activeTab === 'cancelled' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
          )}
        </button>
      </div>

      {/* Mobile Sticky Header — md:hidden */}
      <div className="md:hidden sticky top-0 z-30 -mx-4 -mt-6 px-4 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-[#262626]">
        <div className="flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-primary-600 dark:text-primary-400 active:scale-95 transition-transform"
            aria-label={t('common:actions.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight">
            {t('title')}
          </h1>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center justify-center w-10 h-10 -mr-2 rounded-xl text-primary-600 dark:text-primary-400 active:scale-95 transition-transform"
            aria-label={t('actions.add')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Search Bar — md:hidden */}
      <div className="md:hidden">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          className="w-full h-12 px-4 rounded-xl border-none bg-neutral-100 dark:bg-[#1f1f1f] text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm text-center sm:text-left focus:ring-1 focus:ring-primary-500 transition-all"
        />
      </div>

      {/* Mobile Filter Chips — md:hidden */}
      <div className="md:hidden flex overflow-x-auto scrollbar-hide -mx-4 px-4 gap-2">
        {[
          {
            label: t('list.filters.all'),
            isActive:
              statusFilter === 'all' &&
              operatorFilter === 'all' &&
              providerFilter === 'all' &&
              !hasAdvancedSimFilters &&
              !(localSearch && localSearch.trim()) &&
              !(searchFromUrl && searchFromUrl.trim()),
            onClick: clearAllSimListFilters,
          },
          { label: t('list.filters.active'), isActive: statusFilter === 'active', onClick: () => { handleFilterChange('operator', 'all'); handleFilterChange('status', 'active'); } },
          { label: t('list.filters.available'), isActive: statusFilter === 'available', onClick: () => { handleFilterChange('operator', 'all'); handleFilterChange('status', 'available'); } },
          { label: t('list.filters.cancelled'), isActive: statusFilter === 'cancelled', onClick: () => { handleFilterChange('operator', 'all'); handleFilterChange('status', 'cancelled'); } },
          { label: t('operators.TURKCELL'), isActive: operatorFilter === 'TURKCELL', onClick: () => { handleFilterChange('status', 'all'); handleFilterChange('operator', 'TURKCELL'); } },
          { label: t('operators.VODAFONE'), isActive: operatorFilter === 'VODAFONE', onClick: () => { handleFilterChange('status', 'all'); handleFilterChange('operator', 'VODAFONE'); } },
          { label: t('operators.TURK_TELEKOM'), isActive: operatorFilter === 'TURK_TELEKOM', onClick: () => { handleFilterChange('status', 'all'); handleFilterChange('operator', 'TURK_TELEKOM'); } },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
              chip.isActive
                ? 'bg-primary-600 text-white dark:bg-primary-500'
                : 'bg-neutral-100 dark:bg-[#262626] text-neutral-600 dark:text-neutral-400'
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="md:hidden -mx-4 px-4">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          size="sm"
          leftIcon={<Filter className="w-4 h-4" />}
          onClick={() => setFiltersModalOpen(true)}
          aria-label={t('list.filters.moreFilters')}
        >
          <span className="flex items-center gap-2">
            {t('list.filters.moreFilters')}
            {hasAdvancedSimFilters ? (
              <span
                className="shrink-0 w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400"
                aria-hidden
              />
            ) : null}
          </span>
        </Button>
      </div>

      {/* Desktop PageHeader — hidden on mobile */}
      <div className="hidden md:block">
        <PageHeader
          title={t('title')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('title') },
          ]}
          actions={
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                onClick={handleExport}
                loading={isExporting}
                disabled={totalCount === 0}
              >
                {t('common:actions.export')}
              </Button>
              <Button
                variant="outline"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleImport}
              >
                {t('common:import.bulkImportButton')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAdd}
              >
                {t('actions.add')}
              </Button>
            </div>
          }
        />
      </div>

      {/* Mobile KPI Strip — md:hidden */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400">
            {t('stats.total')}
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
            {simStats?.total_count ?? simCards?.length ?? 0}
          </span>
        </div>
        <div className="rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400">
              {t('stats.active')}
            </span>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-success-600 dark:text-success-400">
            {simStats?.active_sim_count ?? 0}
          </span>
        </div>
        <div className="rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400">
            {t('stats.unassigned')}
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-amber-500 dark:text-amber-400">
            {simStats?.available_count ?? 0}
          </span>
        </div>
        <div className="rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400">
            {t('stats.monthlyRevenue')}
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-primary-600 dark:text-primary-400">
            {formatCurrency(simStats?.total_monthly_profit ?? 0)}
          </span>
        </div>
      </div>

      {/* Desktop KPI Strip — hidden on mobile */}
      <div className="hidden md:grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <KpiCard
          title={t('stats.total')}
          value={simStats?.total_count ?? simCards?.length ?? 0}
          icon={Package}
          variant="default"
        />
        <KpiCard
          title={t('stats.available')}
          value={simStats?.available_count ?? simCards?.filter((s) => s.status === 'available').length ?? 0}
          icon={SimIcon}
          variant="success"
        />
        <KpiCard
          title={t('stats.active')}
          value={simStats?.active_sim_count ?? simCards?.filter((s) => s.status === 'active').length ?? 0}
          icon={TrendingUp}
          variant="info"
        />
        <KpiCard
          title={t('stats.subscription')}
          value={simStats?.subscription_count ?? simCards?.filter((s) => s.status === 'subscription').length ?? 0}
          icon={CreditCard}
          variant="info"
        />
        <KpiCard
          title={t('stats.monthlyProfit')}
          value={new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
            simStats?.total_monthly_profit ?? (simCards || []).reduce((acc, curr) => acc + ((curr.sale_price || 0) - (curr.cost_price || 0)), 0)
          )}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Desktop filter bar — primary row + collapsible advanced */}
      <div className="hidden md:block w-full max-w-[1920px] mx-auto">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/90 bg-white dark:bg-[#171717] shadow-sm p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6 min-w-0">
            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-4 xl:max-w-[min(100%,52rem)]">
              <div className="min-w-0 flex-1 w-full">
                <SearchInput
                  minimal
                  value={localSearch}
                  onChange={(v) => setLocalSearch(v ?? '')}
                  placeholder={t('list.searchPlaceholder')}
                  className="w-full"
                  size="sm"
                />
              </div>
              <div className="w-full shrink-0 sm:max-md:w-full lg:w-44 xl:w-48">
                <ListboxSelect
                  value={statusFilter}
                  onChange={(v) => handleFilterChange('status', v)}
                  options={[
                    { value: 'all', label: t('list.filters.all') },
                    { value: 'available', label: t('list.filters.available') },
                    { value: 'active', label: t('list.filters.active') },
                    { value: 'subscription', label: t('list.filters.subscription') },
                    { value: 'cancelled', label: t('list.filters.cancelled') },
                  ]}
                  placeholder={t('list.filters.status')}
                  size="sm"
                  triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 xl:shrink-0 xl:ml-auto">
              {hasActiveSimFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-neutral-600 dark:text-neutral-300"
                  onClick={clearAllSimListFilters}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  {t('list.filters.clearAll')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={advancedFiltersExpanded}
                onClick={() => setAdvancedFiltersExpanded((v) => !v)}
                leftIcon={<Filter className="w-4 h-4" />}
                rightIcon={
                  <ChevronDown
                    className={cn('w-4 h-4 transition-transform duration-200', advancedFiltersExpanded && 'rotate-180')}
                  />
                }
              >
                <span className="inline-flex items-center gap-2">
                  {t('list.filters.advancedFilters')}
                  {hasAdvancedSimFilters ? (
                    <span
                      className="h-2 w-2 rounded-full bg-primary-600 dark:bg-primary-400"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </Button>
              <Button
                type="button"
                variant={quickEditMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setQuickEditMode(!quickEditMode)}
                leftIcon={<Pencil className="w-4 h-4" />}
                className="shrink-0"
              >
                {t('list.quickEdit')}
              </Button>
            </div>
          </div>

          {advancedFiltersExpanded ? (
            <div className="mt-5 pt-5 border-t border-neutral-200/90 dark:border-neutral-800/90">
              <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-12 xl:items-start">
                <div className="xl:col-span-3 min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('list.filters.operator')}
                  </p>
                  <ListboxSelect
                    value={operatorFilter}
                    onChange={(v) => handleFilterChange('operator', v)}
                    options={[
                      { value: 'all', label: t('list.filters.allOperators') },
                      { value: 'TURKCELL', label: t('operators.TURKCELL') },
                      { value: 'VODAFONE', label: t('operators.VODAFONE') },
                      { value: 'TURK_TELEKOM', label: t('operators.TURK_TELEKOM') },
                    ]}
                    placeholder={t('list.filters.operator')}
                    size="sm"
                    triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
                  />
                </div>
                <div className="xl:col-span-4 min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('list.filters.provider')}
                  </p>
                  <ListboxSelect
                    value={providerFilter}
                    onChange={(v) => handleFilterChange('provider_company_id', v)}
                    options={[
                      { value: 'all', label: t('list.filters.all') },
                      ...(providerCompanies || []).map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    placeholder={t('list.filters.provider')}
                    size="sm"
                    triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
                  />
                </div>
                <div className="xl:col-span-12 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {t('list.filters.activationPeriod')}
                    </p>
                    {hasActivationPeriodSet && (
                      <button
                        type="button"
                        onClick={clearActivationPeriod}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {t('list.filters.clearPeriod')}
                      </button>
                    )}
                  </div>
                  {periodOrderError && (
                    <p className="mb-2 text-xs text-red-600 dark:text-red-400">
                      {t('list.filters.periodOrderError')}
                    </p>
                  )}
                  {activationPeriodBoundaryFields}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {totalCount === 0 && !isFetching ? (
        <EmptyState
          icon={SimIcon}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          actionLabel={t('actions.add')}
          onAction={handleAdd}
        />
      ) : (
        <>
          {/* Mobile Card List — md:hidden */}
          <div className={cn('md:hidden space-y-3', isFetching && !isLoading && 'opacity-70')}>
            {(simCards || []).map((sim) => {
              const isActive = sim.status === 'active' || sim.status === 'subscription';
              const isAvailable = sim.status === 'available';
              const isCancelled = sim.status === 'cancelled';
              const customerName = sim.customers?.company_name || sim.customer_label;

              return (
                <button
                  key={sim.id}
                  type="button"
                  onClick={() => handleEdit(sim.id)}
                  className={cn(
                    'w-full text-left rounded-xl p-4 border-l-4 transition-colors active:scale-[0.98] duration-150',
                    'bg-white dark:bg-[#171717] border border-neutral-200/80 dark:border-[#262626]',
                    isActive && 'border-l-success-500/50',
                    isAvailable && 'border-l-amber-500',
                    isCancelled && 'border-l-neutral-400 dark:border-l-neutral-600 opacity-60',
                  )}
                >
                  {/* Row 1: Phone + Status */}
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      'font-mono text-lg font-bold tracking-tight',
                      isCancelled ? 'text-neutral-500 dark:text-neutral-400' : 'text-primary-600 dark:text-primary-400'
                    )}>
                      {sim.phone_number}
                    </span>
                    <Badge variant={getStatusVariant(sim.status)} size="sm">
                      {t(`status.${sim.status}`)}
                    </Badge>
                  </div>
                  {/* Row 2: Customer + Operator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      'text-sm font-bold truncate mr-2',
                      isCancelled
                        ? 'text-neutral-500 dark:text-neutral-400 line-through'
                        : 'text-neutral-900 dark:text-neutral-50'
                    )}>
                      {customerName || t('list.unassigned')}
                    </span>
                    {sim.operator && (
                      <span className="flex-shrink-0 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 px-1.5 py-0.5 rounded">
                        {t(`operators.${sim.operator}`)}
                      </span>
                    )}
                  </div>
                  {/* Row 3: Location */}
                  <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    {customerName ? (
                      <>
                        <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
                        <span className="truncate">{sim.site_name || sim.provider_company?.name || '-'}</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-3.5 h-3.5 mr-1 shrink-0" />
                        <span>{t('stats.unassigned')}</span>
                      </>
                    )}
                  </div>
                  {/* Row 4: Capacity + Account No + Price */}
                  <div className="flex justify-between items-end pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex gap-4">
                      {sim.capacity && (
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-neutral-400 dark:text-neutral-500">{t('list.columns.capacity')}</span>
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{sim.capacity}</span>
                        </div>
                      )}
                      {sim.account_no && (
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-neutral-400 dark:text-neutral-500">{t('list.columns.accountNo')}</span>
                          <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">{sim.account_no}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-extrabold text-neutral-900 dark:text-neutral-50">
                      {formatCurrency(sim.sale_price ?? 0)}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Mobile Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between pt-2 pb-4">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">
                    {page + 1} / {pageCount}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pageCount - 1}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table — hidden on mobile */}
          <div className={cn('hidden md:block bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm', isFetching && !isLoading && 'opacity-70')}>
            <Table
              columns={columns}
              data={simCards}
              onRowClick={(row) => handleEdit(row.id)}
              className="border-none"
            />
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount} SIM
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">
                    {page + 1} / {pageCount}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pageCount - 1}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <Modal
        open={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        title={t('list.filters.advancedFilters')}
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
            {hasActiveSimFilters ? (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  clearAllSimListFilters();
                  setFiltersModalOpen(false);
                }}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                {t('list.filters.clearAll')}
              </Button>
            ) : null}
            <Button variant="primary" className="flex-1" onClick={() => setFiltersModalOpen(false)}>
              {t('common:actions.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
              {t('list.filters.provider')}
            </p>
            <ListboxSelect
              value={providerFilter}
              onChange={(v) => handleFilterChange('provider_company_id', v)}
              options={[
                { value: 'all', label: t('list.filters.all') },
                ...(providerCompanies || []).map((p) => ({ value: p.id, label: p.name })),
              ]}
              placeholder={t('list.filters.provider')}
              size="sm"
              triggerClassName={SIM_FILTER_LISTBOX_TRIGGER}
            />
          </div>
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#141414] p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300 mb-1">
                {t('list.filters.activationPeriod')}
              </p>
              {activationPeriodSummary ? (
                <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                  {activationPeriodSummary}
                </p>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('list.filters.activationPeriodPick')}
                </p>
              )}
              <p className="mt-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                {t('list.filters.activationRangeHint')}
              </p>
            </div>
            {activationPeriodBoundaryFields}
          </div>
        </div>
      </Modal>
      <Modal
        open={!!simToCancel}
        onClose={() => setSimToCancel(null)}
        title={t('actions.cancel')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              onClick={() => setSimToCancel(null)}
              className="flex-1"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              loading={cancelSimMutation.isPending}
              className="flex-1"
            >
              {t('actions.cancel')}
            </Button>
          </div>
        }
      >
        <p>{t('messages.cancelConfirmation', { number: simToCancel?.phone_number })}</p>
      </Modal>
    </PageContainer>
  );
}
