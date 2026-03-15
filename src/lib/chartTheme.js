/**
 * chartTheme.js — Ornet ERP Chart Color System
 *
 * Single source of truth for all Recharts color values.
 * Import from here — never hardcode hex values in chart components.
 *
 * Usage:
 *   import { CHART_COLORS, SPARKLINE_COLORS } from '@/lib/chartTheme';
 */

export const CHART_COLORS = {
  // ── Financial series ──────────────────────────────────────────
  revenue:    '#3b82f6',  // blue-500    — income line / area
  expense:    '#f43f5e',  // rose-500    — expense line
  profit:     '#22c55e',  // green-500   — net profit area
  mrr:        '#3b82f6',  // blue-500    — MRR area chart

  // ── Work order types ──────────────────────────────────────────
  montaj:     '#8b5cf6',  // violet-500  — installation WOs
  servis:     '#f59e0b',  // amber-500   — service WOs
  bakim:      '#06b6d4',  // cyan-500    — maintenance WOs
  kesif:      '#6b7280',  // gray-500    — survey WOs

  // ── Work order & payment status ───────────────────────────────
  pending:    '#f59e0b',  // amber-500   — waiting / bekliyor
  in_progress:'#3b82f6',  // blue-500    — in progress / devam ediyor
  completed:  '#22c55e',  // green-500   — completed / tamamlandı
  cancelled:  '#6b7280',  // gray-500    — cancelled / iptal

  // ── Chart infrastructure ──────────────────────────────────────
  grid:       '#1f1f1f',  // near-black  — CartesianGrid stroke (dark)
  gridLight:  '#e5e7eb',  // gray-200    — CartesianGrid stroke (light)
  axis:       '#525252',  // gray-600    — XAxis / YAxis tick fill
  axisLight:  '#9ca3af',  // gray-400    — axis ticks in light mode
  tooltipBg:  '#1a1a1a',  // elevated    — custom tooltip background
};

export const SPARKLINE_COLORS = {
  positive:   '#22c55e',  // green-500   — upward / good trend
  negative:   '#ef4444',  // red-500     — downward / bad trend
  neutral:    '#6b7280',  // gray-500    — flat / no change
};

/**
 * Area gradient fill config helper.
 * Returns stop values for a <linearGradient> under a line chart.
 *
 * Usage:
 *   const grad = areaGradient(CHART_COLORS.revenue);
 *   <stop offset="0%"   stopColor={grad.color} stopOpacity={grad.topOpacity} />
 *   <stop offset="100%" stopColor={grad.color} stopOpacity={grad.bottomOpacity} />
 */
export function areaGradient(color) {
  return {
    color,
    topOpacity:    0.15,
    bottomOpacity: 0,
  };
}

/**
 * Formats a Turkish Lira value for chart Y-axis ticks.
 * e.g. 84200 → "₺84K"  |  1200000 → "₺1.2M"
 */
export function formatTL(value) {
  if (value >= 1_000_000) return `₺${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `₺${(value / 1_000).toFixed(0)}K`;
  return `₺${value}`;
}

/**
 * Formats a plain number for chart Y-axis ticks (e.g. subscription counts).
 * e.g. 1200 → "1.2K"
 */
export function formatCount(value) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}
