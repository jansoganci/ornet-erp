import {
  Home,
  Users,
  ClipboardList,
  Target,
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
  RefreshCw,
  HardDrive,
  Bell,
  FileSearch,
  AlertCircle,
  Radio,
} from 'lucide-react';

/**
 * Top-level nav items shown in bottom bar on mobile (< lg breakpoint).
 * Routes must match flat items or first child of a group.
 */
export const topNavRoutes = ['/', '/operations', '/customers', '/work-orders', '/proposals'];

export const navItems = [
  // Top-level frequently used items (5)
  { to: '/', icon: Home, labelKey: 'nav.dashboard', exact: true },
  { to: '/operations', icon: Target, labelKey: 'nav.operations', canWriteOnly: true },
  { to: '/customers', icon: Users, labelKey: 'nav.customers' },
  { to: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders' },
  { to: '/proposals', icon: FileText, labelKey: 'nav.proposals', canWriteOnly: true },
  // Operasyon group (notifications + action board)
  {
    type: 'group',
    id: 'operations',
    labelKey: 'nav.groups.operations',
    icon: Radio,
    children: [
      { to: '/notifications', icon: Bell, labelKey: 'nav.notifications', notificationCenter: true },
      { to: '/action-board', icon: AlertCircle, labelKey: 'nav.actionBoard', adminOnly: true },
    ],
  },
  // Planlama group
  {
    type: 'group',
    id: 'planning',
    labelKey: 'nav.groups.planning',
    icon: CalendarClock,
    children: [
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
      { to: '/subscriptions', icon: CreditCard, labelKey: 'nav.subscriptions', canWriteOnly: true },
      { to: '/sim-cards', icon: Cpu, labelKey: 'simCards:title', canWriteOnly: true },
      { to: '/sim-cards/invoice-analysis', icon: FileSearch, labelKey: 'invoiceAnalysis:title', canWriteOnly: true },
      { to: '/equipment', icon: HardDrive, labelKey: 'nav.equipment' },
    ],
  },
  // Finance group — admin + accountant only
  {
    type: 'group',
    id: 'finance',
    labelKey: 'nav.groups.finance',
    icon: Receipt,
    canWriteOnly: true,
    children: [
      { to: '/finance', icon: Receipt, labelKey: 'nav.finance.dashboard' },
      { to: '/finance/income', icon: TrendingUp, labelKey: 'nav.finance.income' },
      { to: '/finance/expenses', icon: TrendingDown, labelKey: 'nav.finance.expenses' },
      { to: '/finance/vat', icon: Percent, labelKey: 'nav.finance.vat' },
      { to: '/finance/exchange', icon: DollarSign, labelKey: 'nav.finance.exchange' },
      { to: '/finance/recurring', icon: RefreshCw, labelKey: 'nav.finance.recurring' },
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
