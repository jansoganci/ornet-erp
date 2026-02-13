import {
  Home,
  Users,
  ClipboardList,
  Target,
  Calendar,
  CalendarCheck,
  Search,
  Package,
  CreditCard,
  Cpu,
  FileText,
  CalendarClock,
  Building2,
  Settings,
  Receipt,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
} from 'lucide-react';

/**
 * Top-level nav items shown in bottom bar on mobile (< lg breakpoint).
 * Routes must match flat items or first child of a group.
 */
export const topNavRoutes = ['/', '/daily-work', '/customers', '/work-orders', '/proposals'];

export const navItems = [
  // Top-level frequently used items (5)
  { to: '/', icon: Home, labelKey: 'nav.dashboard', exact: true },
  { to: '/daily-work', icon: CalendarCheck, labelKey: 'nav.dailyWork' },
  { to: '/customers', icon: Users, labelKey: 'nav.customers' },
  { to: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders' },
  { to: '/proposals', icon: FileText, labelKey: 'nav.proposals' },
  // Planlama group
  {
    type: 'group',
    id: 'planning',
    labelKey: 'nav.groups.planning',
    icon: CalendarClock,
    children: [
      { to: '/calendar', icon: Calendar, labelKey: 'nav.calendar' },
      { to: '/tasks', icon: Target, labelKey: 'nav.tasks' },
      { to: '/work-history', icon: Search, labelKey: 'nav.workHistory' },
    ],
  },
  // Gelir ve Altyapı group
  {
    type: 'group',
    id: 'revenueInfra',
    labelKey: 'nav.groups.revenueInfra',
    icon: Building2,
    children: [
      { to: '/subscriptions', icon: CreditCard, labelKey: 'nav.subscriptions' },
      { to: '/sim-cards', icon: Cpu, labelKey: 'simCards:title' },
    ],
  },
  // Finance group
  {
    type: 'group',
    id: 'finance',
    labelKey: 'nav.groups.finance',
    icon: Receipt,
    children: [
      { to: '/finance', icon: Receipt, labelKey: 'nav.finance.dashboard' },
      { to: '/finance/income', icon: TrendingUp, labelKey: 'nav.finance.income' },
      { to: '/finance/expenses', icon: TrendingDown, labelKey: 'nav.finance.expenses' },
      { to: '/finance/vat', icon: Percent, labelKey: 'nav.finance.vat' },
      { to: '/finance/exchange', icon: DollarSign, labelKey: 'nav.finance.exchange' },
      { to: '/finance/reports', icon: FileText, labelKey: 'nav.finance.reports' },
    ],
  },
  // Ayarlar group (default collapsed)
  {
    type: 'group',
    id: 'settings',
    labelKey: 'nav.groups.settings',
    icon: Settings,
    children: [
      { to: '/materials', icon: Package, labelKey: 'nav.materials' },
      // Future: { to: '/users', icon: UserCog, labelKey: 'users', adminOnly: true }
      // Future: { to: '/company', icon: Building2, labelKey: 'companySettings', adminOnly: true }
    ],
  },
];
