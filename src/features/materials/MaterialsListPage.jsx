import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Package, Search, Edit2, Trash2, Filter, Upload } from 'lucide-react';
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
  Modal
} from '../../components/ui';
import { useMaterials, useDeleteMaterial, useMaterialCategories } from './hooks';
import { MaterialFormModal } from './MaterialFormModal';

export function MaterialsListPage() {
  const { t } = useTranslation(['materials', 'common']);
  const { t: tCommon } = useTranslation('common');

  // State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  // Hooks
  const { data: materials = [], isLoading, error, refetch } = useMaterials({ search, category: category === 'all' ? undefined : category });
  const { data: categories = [] } = useMaterialCategories();
  const deleteMutation = useDeleteMaterial();
  const navigate = useNavigate();

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

  const columns = [
    {
      header: t('materials:list.columns.code'),
      accessor: 'code',
      render: (val) => <span className="font-mono font-bold text-primary-600">{val}</span>
    },
    {
      header: t('materials:list.columns.name'),
      accessor: 'name',
      render: (val) => <span className="font-medium text-neutral-900 dark:text-neutral-100">{val}</span>
    },
    {
      header: t('materials:list.columns.category'),
      accessor: 'category',
      render: (val) => (
        <Badge variant="secondary">
          {t(`materials:categories.${val}`) || val}
        </Badge>
      )
    },
    {
      header: t('materials:list.columns.unit'),
      accessor: 'unit',
      render: (val) => <span className="text-xs uppercase text-neutral-500 font-bold tracking-wider">{t(`materials:units.${val}`) || val}</span>
    },
    {
      header: t('materials:list.columns.status'),
      accessor: 'is_active',
      render: (val) => (
        <Badge variant={val ? 'success' : 'error'} dot>
          {val ? t('materials:status.active') : t('materials:status.inactive')}
        </Badge>
      )
    },
    {
      header: '',
      id: 'actions',
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
            className="text-error-600 hover:bg-error-50"
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
      <Card className="p-4 shadow-sm border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder={t('materials:list.searchPlaceholder')}
              value={search}
              onChange={setSearch}
            />
          </div>
          <div className="w-full md:w-64">
            <Select
              options={[
                { value: 'all', label: t('workOrders:list.filters.allTypes') },
                ...categories.map(cat => ({ value: cat, label: t(`materials:categories.${cat}`) || cat }))
              ]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              leftIcon={<Filter className="w-4 h-4" />}
            />
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
          description={search ? tCommon('noResults') : t('materials:list.noMaterials')}
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
