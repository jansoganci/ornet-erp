import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Modal, Button, Table, IconButton } from '../../../components/ui';
import { useCategories, useDeleteCategory } from '../hooks';
import { CategoryFormModal } from './CategoryFormModal';

export function CategoryManagementModal({ open, onClose }) {
  const { t } = useTranslation(['finance', 'common']);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const { data: categories = [], isLoading } = useCategories();
  const deleteMutation = useDeleteCategory();

  const handleAdd = () => {
    setEditingCategory(null);
    setShowFormModal(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setShowFormModal(true);
  };

  const handleFormClose = () => {
    setShowFormModal(false);
    setEditingCategory(null);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteMutation.mutateAsync(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch {
      // Error handled by mutation onError
    }
  };

  const columns = [
    { header: t('finance:categoryForm.code'), accessor: 'code' },
    { header: t('finance:categoryForm.nameTr'), accessor: 'name_tr' },
    { header: t('finance:categoryForm.nameEn'), accessor: 'name_en' },
    {
      header: t('common:status.active'),
      accessor: 'is_active',
      render: (val) => (val ? t('common:status.active') : t('common:status.inactive')),
    },
    {
      header: t('common:actions.actionsColumn'),
      accessor: 'actions',
      align: 'right',
      stickyRight: true,
      render: (_, row) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
            aria-label={t('common:actions.edit')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-error-600 hover:bg-error-50"
            onClick={() => setCategoryToDelete(row)}
            aria-label={t('common:actions.delete')}
            disabled={row.is_system}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('finance:categories.manageTitle')}
        size="lg"
        footer={
          <div className="flex gap-3 w-full justify-between">
            <Button variant="ghost" onClick={onClose}>
              {t('common:actions.close')}
            </Button>
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
              {t('finance:categories.addButton')}
            </Button>
          </div>
        }
      >
        <div className="min-h-[200px]">
          <Table
            columns={columns}
            data={categories}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyMessage={t('finance:categories.empty')}
          />
        </div>
      </Modal>

      <CategoryFormModal
        open={showFormModal}
        onClose={handleFormClose}
        category={editingCategory}
      />

      <Modal
        open={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        title={t('finance:deleteConfirm.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setCategoryToDelete(null)} className="flex-1">
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteMutation.isPending}
              className="flex-1"
            >
              {t('common:actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">{t('finance:deleteConfirm.message')}</p>
      </Modal>
    </>
  );
}
