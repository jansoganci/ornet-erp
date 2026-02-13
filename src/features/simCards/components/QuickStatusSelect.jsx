import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Select } from '../../../components/ui';

const STATUS_TRANSITIONS = {
  available: ['active', 'cancelled'],
  active: ['available', 'cancelled'],
  subscription: null,
  cancelled: ['available', 'active'],
};

export function QuickStatusSelect({ sim, onStatusChange, t }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const allowedTargets = STATUS_TRANSITIONS[sim.status];
  const allOptions = allowedTargets
    ? [sim.status, ...allowedTargets.filter((s) => s !== sim.status)].map((status) => ({
        value: status,
        label: t(`status.${status}`),
      }))
    : [];

  const handleChange = async (e) => {
    const newStatus = e.target.value;
    if (!newStatus || newStatus === sim.status) return;
    setSaving(true);
    try {
      await onStatusChange(sim.id, newStatus);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!allowedTargets) return null;

  return (
    <div
      className="flex items-center gap-2 min-w-[120px]"
      onClick={(e) => e.stopPropagation()}
    >
      <Select
        value={sim.status}
        onChange={handleChange}
        options={allOptions}
        disabled={saving}
        size="sm"
        wrapperClassName="!mb-0"
        className="min-w-[100px]"
      />
      {saving && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 shrink-0" />}
      {saved && !saving && <Check className="h-4 w-4 text-green-500 shrink-0" />}
    </div>
  );
}
