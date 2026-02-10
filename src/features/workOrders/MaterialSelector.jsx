import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Package, Minus, Info } from 'lucide-react';
import { 
  Button, 
  Input, 
  IconButton, 
  Badge, 
  Card
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { MaterialAutocomplete } from './MaterialAutocomplete';

export function MaterialSelector({ 
  value = [], 
  onChange 
}) {
  const { t } = useTranslation(['workOrders', 'materials', 'common']);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!selectedMaterialId || !selectedMaterial) return;

    const material = selectedMaterial;

    const existingIndex = value.findIndex(v => v.material_id === selectedMaterialId);
    
    let newValue;
    if (existingIndex > -1) {
      // Update quantity if already exists
      newValue = [...value];
      newValue[existingIndex] = {
        ...newValue[existingIndex],
        quantity: newValue[existingIndex].quantity + quantity,
        notes: notes || newValue[existingIndex].notes
      };
    } else {
      // Add new
      newValue = [
        ...value,
        {
          material_id: selectedMaterialId,
          quantity,
          notes,
          material // Keep for display
        }
      ];
    }

    onChange(newValue);
    setSelectedMaterialId('');
    setSelectedMaterial(null);
    setQuantity(1);
    setNotes('');
  };

  const handleRemove = (materialId) => {
    onChange(value.filter(v => v.material_id !== materialId));
  };

  const handleUpdateQuantity = (materialId, delta) => {
    const newValue = value.map(v => {
      if (v.material_id === materialId) {
        const newQty = Math.max(1, v.quantity + delta);
        return { ...v, quantity: newQty };
      }
      return v;
    });
    onChange(newValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Package className="w-5 h-5 text-primary-600" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          {t('workOrders:form.sections.materials')}
        </h3>
      </div>

      <Card className="bg-neutral-50/50 dark:bg-[#1a1a1a]/50 border-dashed">
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7">
              <MaterialAutocomplete
                value={selectedMaterialId}
                onChange={(id) => setSelectedMaterialId(id)}
                onMaterialSelect={(material) => {
                  setSelectedMaterial(material);
                  setSelectedMaterialId(material ? material.id : '');
                }}
              />
            </div>
            <div className="md:col-span-3">
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                placeholder={t('workOrders:form.fields.quantity')}
              />
            </div>
            <div className="md:col-span-2">
              <Button 
                className="w-full" 
                onClick={handleAdd}
                disabled={!selectedMaterial || quantity < 1}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                {t('common:actions.add')}
              </Button>
            </div>
          </div>
          {selectedMaterial && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('workOrders:form.materialSelect.selected', 'Seçili')}: {selectedMaterial.code} - {selectedMaterial.name}
            </p>
          )}
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('common:fields.notes')}
            className="text-sm"
          />
        </div>
      </Card>

      {value.length > 0 ? (
        <div className="space-y-3">
          {value.map((item) => (
            <div 
              key={item.material_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-xl shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start space-x-3 mb-3 sm:mb-0">
                <div className="mt-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <Package className="w-4 h-4 text-neutral-500" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {item.material?.code}
                    </span>
                    <Badge variant="secondary" size="sm">
                      {t(`materials:categories.${item.material?.category}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {item.material?.name}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-neutral-400 italic mt-1 flex items-center">
                      <Info className="w-3 h-3 mr-1" />
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <IconButton
                    icon={Minus}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdateQuantity(item.material_id, -1)}
                    aria-label="Decrease"
                  />
                  <span className="w-10 text-center font-bold text-neutral-900 dark:text-neutral-100">
                    {item.quantity}
                  </span>
                  <IconButton
                    icon={Plus}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdateQuantity(item.material_id, 1)}
                    aria-label="Increase"
                  />
                </div>
                <IconButton
                  icon={Trash2}
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemove(item.material_id)}
                  aria-label={t('common:actions.delete')}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Package className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {t('workOrders:detail.noMaterials')}
          </p>
        </div>
      )}
    </div>
  );
}
