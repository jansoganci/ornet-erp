import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Input } from '../../../components/ui';

function toInputString(raw) {
  if (raw == null) return '';
  return String(raw);
}

function normalizeLabel(raw) {
  const trimmed = String(raw ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function QuickCustomerLabelField({ sim, onUpdate, label }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const serverStr = toInputString(sim.customer_label);
  const [local, setLocal] = useState(() => serverStr);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(toInputString(sim.customer_label));
  }, [sim.id, sim.customer_label]);

  const commitIfChanged = async () => {
    const next = normalizeLabel(local);
    const prev = normalizeLabel(sim.customer_label);
    if (next === prev) {
      setLocal(toInputString(next ?? ''));
      return;
    }

    setSaving(true);
    try {
      await onUpdate(sim.id, { customer_label: next });
      setLocal(toInputString(next ?? ''));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-1 min-w-0 w-full max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commitIfChanged();
        }}
        disabled={saving}
        size="sm"
        wrapperClassName="!mb-0 min-w-0 w-full flex-1"
        className="text-sm min-w-0 w-full"
        aria-label={label}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 shrink-0" />}
      {saved && !saving && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
    </div>
  );
}
