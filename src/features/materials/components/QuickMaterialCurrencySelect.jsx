import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { ListboxSelect } from '../../../components/ui';

export function QuickMaterialCurrencySelect({ material, onUpdate, options, placeholder, disabled }) {
  const [local, setLocal] = useState(() => material.currency ?? 'TRY');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ignoreSyncRef = useRef(false);

  useEffect(() => {
    if (ignoreSyncRef.current) return;
    setLocal(material.currency ?? 'TRY');
  }, [material.id, material.currency]);

  const commit = async (next) => {
    const prev = material.currency ?? 'TRY';
    if (next === prev) return;
    ignoreSyncRef.current = true;
    setSaving(true);
    try {
      await onUpdate(material.id, { currency: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setLocal(prev);
    } finally {
      setSaving(false);
      queueMicrotask(() => {
        ignoreSyncRef.current = false;
      });
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1 min-w-[5.5rem] max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <ListboxSelect
        options={options}
        value={local}
        onChange={(v) => {
          setLocal(v);
          commit(v);
        }}
        placeholder={placeholder}
        size="sm"
        disabled={disabled || saving}
        className="w-full"
        triggerClassName="min-h-8"
        emptyValues={[]}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 shrink-0" />}
      {saved && !saving && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
    </div>
  );
}
