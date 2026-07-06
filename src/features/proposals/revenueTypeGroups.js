import { PROPOSAL_REVENUE_TYPES } from './schema';

/** UI-only grouping for revenue_type dropdown (does not affect DB or posting). */
export const PROPOSAL_REVENUE_TYPE_GROUPS = [
  { id: 'product', types: ['material'] },
  { id: 'service', types: ['labor_service', 'other'] },
];

export function buildGroupedRevenueTypeOptions(t) {
  const allowed = new Set(PROPOSAL_REVENUE_TYPES);

  return PROPOSAL_REVENUE_TYPE_GROUPS.map((group) => ({
    id: group.id,
    label: t(`items.revenueTypeGroups.${group.id}`),
    options: group.types
      .filter((value) => allowed.has(value))
      .map((value) => ({
        value,
        label: t(`items.revenueTypes.${value}`),
      })),
  }));
}
