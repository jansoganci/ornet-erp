import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ChartTooltip } from '../../../components/ui/ChartTooltip';
import { CHART_COLORS } from '../../../lib/chartTheme';
import { useDashboardStats } from '../hooks';

// ── Donut segment config ───────────────────────────────────────────────────

function buildDonutData(stats, tCommon) {
  return [
    {
      key: 'pending',
      label: tCommon('status.pending'),
      value: (stats?.pending_work_orders ?? 0),
      color: CHART_COLORS.pending,
    },
    {
      key: 'in_progress',
      label: tCommon('status.in_progress'),
      value: (stats?.in_progress_work_orders ?? 0),
      color: CHART_COLORS.in_progress,
    },
    {
      key: 'completed',
      label: tCommon('status.completed'),
      value: (stats?.completed_this_week ?? 0),
      color: CHART_COLORS.completed,
    },
  ].filter(d => d.value > 0); // hide zero-value segments
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function DonutSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative w-40 h-40">
        <Skeleton className="w-full h-full rounded-full" />
        <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white dark:bg-gray-900" />
      </div>
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * WorkOrderStatusDonut — Donut chart showing current WO status distribution.
 * Uses existing useDashboardStats() — no new RPCs needed.
 * Segments: pending (amber), in_progress (blue), completed_this_week (green).
 */
export function WorkOrderStatusDonut() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { data: stats, isLoading } = useDashboardStats();

  const donutData = buildDonutData(stats, tCommon);
  const total = donutData.reduce((sum, d) => sum + d.value, 0);

  // Segment gap color — matches card background in dark/light
  const strokeColor = 'transparent';

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
          İş Emirleri Durumu
        </h3>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-5 py-4">
          <DonutSkeleton />
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            Aktif iş emri yok.
          </p>
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Chart + center label */}
          <div className="relative mx-auto w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={78}
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={3}
                  paddingAngle={3}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center overlay — total count */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums leading-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {total}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-500 mt-0.5">
                toplam
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
            {donutData.map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {entry.label}
                </span>
                <span
                  className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
