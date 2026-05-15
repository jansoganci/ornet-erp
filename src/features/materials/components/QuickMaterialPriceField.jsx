import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Input } from '../../../components/ui';
import { getCurrencySymbol } from '../../../lib/utils';

/** null / DB boş string güvenli */
function normalizeAmount(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function toInputString(value) {
  const n = normalizeAmount(value);
  return n == null ? '' : String(n);
}

/** Boş giriş → null ; geçersiz → null işareti için */
function parseAmount(raw) {
  const s = String(raw).trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return undefined;
  return Math.max(0, n);
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function amountsEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return roundMoney(Number(a)) === roundMoney(Number(b));
}

export function QuickMaterialPriceField({ material, field, onUpdate, label }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const serverStr = toInputString(material[field]);
  const [local, setLocal] = useState(() => serverStr);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(toInputString(material[field]));
  }, [material.id, material[field], field]);

  const commitIfChanged = async () => {
    const parsed = parseAmount(local);
    if (parsed === undefined) {
      setLocal(serverStr);
      return;
    }
    const next = parsed == null ? null : roundMoney(parsed);
    const prev = normalizeAmount(material[field]);
    if (amountsEqual(prev, next)) {
      setLocal(toInputString(next));
      return;
    }

    setSaving(true);
    try {
      await onUpdate(material.id, { [field]: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setLocal(toInputString(material[field]));
    } finally {
      setSaving(false);
    }
  };

  const currency = material.currency ?? 'TRY';

  return (
    <div
      className="inline-flex items-center gap-1 shrink-0 max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
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
        wrapperClassName="!mb-0 w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] shrink-0"
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
