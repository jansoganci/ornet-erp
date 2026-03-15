/**
 * ChartTooltip — Shared custom tooltip for all Recharts charts.
 *
 * Glassmorphism style in dark mode, solid white in light mode.
 * Pass as `content={<ChartTooltip />}` to any Recharts Tooltip component.
 *
 * Usage:
 *   import { ChartTooltip } from '@/components/ui/ChartTooltip';
 *   <Tooltip content={<ChartTooltip formatter={formatTL} />} />
 *
 * Props:
 *   active      — injected by Recharts
 *   payload     — injected by Recharts
 *   label       — injected by Recharts (X-axis value)
 *   formatter   — optional fn(value) → string  (e.g. formatTL)
 *   labelFormatter — optional fn(label) → string
 */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="
      rounded-lg border px-3 py-2 text-sm shadow-xl
      dark:bg-gray-900/90 dark:border-white/10 dark:backdrop-blur-sm
      bg-white border-gray-200
    ">
      {displayLabel && (
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-1.5 font-medium">
          {displayLabel}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-neutral-500 dark:text-neutral-400 text-xs">
              {entry.name}:
            </span>
            <span
              className="font-semibold text-neutral-900 dark:text-neutral-50 text-xs"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SparklineTooltip — Minimal single-value tooltip for sparkline cards.
 * Smaller and simpler than ChartTooltip — no label, no series name.
 */
export function SparklineTooltip({ active, payload, formatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="
      rounded-md border px-2 py-1 text-xs shadow-lg
      dark:bg-gray-900/90 dark:border-white/10 dark:backdrop-blur-sm dark:text-white
      bg-white border-gray-200 text-gray-900
    ">
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </span>
    </div>
  );
}
