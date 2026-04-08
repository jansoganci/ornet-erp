import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Input } from '../../../components/ui';
import { getCurrencySymbol } from '../../../lib/utils';

/** DB boş string / null güvenli sayıya */
function normalizeSalePrice(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
}

function toInputString(value) {
  const n = normalizeSalePrice(value);
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
  const serverStr = toInputString(sim.sale_price);
  const [local, setLocal] = useState(() => serverStr);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(toInputString(sim.sale_price));
  }, [sim.id, sim.sale_price]);

  const commitIfChanged = async () => {
    const parsed = parseAmount(local);
    if (parsed === null) {
      setLocal(serverStr);
      return;
    }
    const next = roundMoney(parsed);
    const prev = roundMoney(normalizeSalePrice(sim.sale_price));
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
    <div
      className="inline-flex items-center gap-1 shrink-0 max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {/* w-15 = 3.75rem (60px @ 16px root) */}
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
        wrapperClassName="!mb-0 w-15 min-w-15 max-w-15 shrink-0"
        className="font-mono text-xs tabular-nums text-left px-1"
        aria-label={label}
      />
      <span
        className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300 shrink-0"
        aria-hidden
      >
        {getCurrencySymbol(currency)}
      </span>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 shrink-0" />}
      {saved && !saving && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
    </div>
  );
}
