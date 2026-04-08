import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Input } from '../../../components/ui';
import { getCurrencySymbol } from '../../../lib/utils';

function toInputString(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  return String(n);
}

function parseAmount(raw) {
  const s = String(raw).trim().replace(',', '.');
  if (s === '') return 0;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return Math.max(0, n);
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function QuickSalePriceField({ sim, onUpdate, label }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const serverStr = toInputString(sim.sale_price ?? 0);
  const [local, setLocal] = useState(() => serverStr);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(serverStr);
  }, [sim.id, serverStr]);

  const commitIfChanged = async () => {
    const parsed = parseAmount(local);
    if (parsed === null) {
      setLocal(serverStr);
      return;
    }
    const next = roundMoney(parsed);
    const prev = roundMoney(Number(sim.sale_price ?? 0));
    if (next === prev) {
      setLocal(toInputString(next));
      return;
    }

    setSaving(true);
    try {
      await onUpdate(sim.id, { sale_price: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const currency = sim.currency ?? 'TRY';

  return (
    <div className="flex items-center gap-2 min-w-0 max-w-[11rem]" onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        step="0.01"
        min={0}
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
        wrapperClassName="!mb-0 min-w-0 flex-1"
        className="font-mono text-sm tabular-nums"
        rightIcon={<span className="text-neutral-400 text-xs font-semibold">{getCurrencySymbol(currency)}</span>}
        aria-label={label}
      />
      {saving && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 shrink-0" />}
      {saved && !saving && <Check className="h-4 w-4 text-green-500 shrink-0" />}
    </div>
  );
}
