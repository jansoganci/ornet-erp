/**
 * Maps pathname to breadcrumb segments for topbar.
 * Each segment: { label: string, to?: string }
 * Uses i18n keys from common.nav and common.breadcrumb.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getBreadcrumbFromPath(pathname) {
  const segments = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ labelKey: 'common:nav.dashboard', to: '/' }];
  }

  const result = [];
  let accumulatedPath = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    accumulatedPath += (accumulatedPath ? '/' : '') + seg;

    // Root segment
    if (i === 0) {
      const { labelKey, to } = getRootLabel(seg);
      result.push({ labelKey, to });
      continue;
    }

    // Second+ segment
    const prev = segments[i - 1];
    const isLast = i === segments.length - 1;

    if (seg === 'new') {
      result.push({ labelKey: 'common:breadcrumb.new', to: null });
    } else if (seg === 'edit') {
      result.push({ labelKey: 'common:breadcrumb.edit', to: null });
    } else if (seg === 'import') {
      result.push({ labelKey: 'common:breadcrumb.import', to: null });
    } else if (seg === 'price-revision') {
      result.push({ labelKey: 'common:breadcrumb.priceRevision', to: null });
    } else if (UUID_REGEX.test(seg)) {
      result.push({ labelKey: 'common:breadcrumb.detail', to: null });
    } else {
      const { labelKey } = prev === 'subscriptions' ? getSubscriptionsLabel(seg) : getFinanceLabel(prev, seg);
      if (labelKey) result.push({ labelKey, to: isLast ? null : `/${accumulatedPath}` });
    }
  }

  return result;
}

function getRootLabel(seg) {
  const map = {
    profile: { labelKey: 'common:nav.profile', to: '/profile' },
    customers: { labelKey: 'common:nav.customers', to: '/customers' },
    'work-orders': { labelKey: 'common:nav.workOrders', to: '/work-orders' },
    'daily-work': { labelKey: 'common:nav.dailyWork', to: '/daily-work' },
    'work-history': { labelKey: 'common:nav.workHistory', to: '/work-history' },
    materials: { labelKey: 'common:nav.materials', to: '/materials' },
    subscriptions: { labelKey: 'common:nav.subscriptions', to: '/subscriptions' },
    proposals: { labelKey: 'common:nav.proposals', to: '/proposals' },
    notifications: { labelKey: 'common:nav.notifications', to: '/notifications' },
    finance: { labelKey: 'common:nav.groups.finance', to: '/finance' },
    equipment: { labelKey: 'common:nav.equipment', to: '/equipment' },
    'sim-cards': { labelKey: 'simCards:title', to: '/sim-cards' },
    operations: { labelKey: 'common:nav.operations', to: '/operations' },
  };
  return map[seg] ?? { labelKey: 'common:nav.dashboard', to: '/' };
}

function getSubscriptionsLabel(seg) {
  const map = {
    collection: { labelKey: 'subscriptions:tabs.collection', to: '/subscriptions/collection' },
    'price-revision': { labelKey: 'common:breadcrumb.priceRevision', to: '/subscriptions/price-revision' },
    new: { labelKey: 'common:breadcrumb.new', to: '/subscriptions/new' },
  };
  return map[seg] ?? { labelKey: null };
}

function getFinanceLabel(prev, seg) {
  if (prev !== 'finance') return { labelKey: null };
  const map = {
    income: { labelKey: 'common:nav.finance.income', to: '/finance/income' },
    expenses: { labelKey: 'common:nav.finance.expenses', to: '/finance/expenses' },
    vat: { labelKey: 'common:nav.finance.vat', to: '/finance/vat' },
    exchange: { labelKey: 'common:nav.finance.exchange', to: '/finance/exchange' },
    recurring: { labelKey: 'common:nav.finance.recurring', to: '/finance/recurring' },
    reports: { labelKey: 'common:nav.finance.reports', to: '/finance/reports' },
  };
  return map[seg] ?? { labelKey: 'common:nav.finance.dashboard', to: '/finance' };
}
