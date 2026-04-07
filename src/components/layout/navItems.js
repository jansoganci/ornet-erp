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
  BookOpen,
} from 'lucide-react';

/**
 * Top-level nav routes for mobile bottom bar. Role-based:
 * - canWrite (Admin/Muhasebeci): Ana Sayfa, Operasyon, Müşteriler, İş Emri (+ ortada)
 * - !canWrite (Teknisyen): Ana Sayfa, Müşteriler, İş Emri
 */
const topNavRoutesForCanWrite = ['/', '/operations', '/customers', '/work-orders'];
const topNavRoutesForNonCanWrite = ['/', '/customers', '/work-orders'];

export function getTopNavRoutes(canWrite) {
  return canWrite ? topNavRoutesForCanWrite : topNavRoutesForNonCanWrite;
}

/** @deprecated Use getTopNavRoutes(canWrite) instead */
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
    ],
  },
  // Ayarlar group (default collapsed)
  {
    type: 'group',
    id: 'settings',
    labelKey: 'nav.groups.settings',
    icon: Settings,
    children: [
      { to: '/technical-guide', icon: BookOpen, labelKey: 'nav.technicalGuide' },
      { to: '/materials', icon: Package, labelKey: 'nav.materials' },
      { to: '/finance/vat', icon: Percent, labelKey: 'nav.finance.vat', canWriteOnly: true },
      { to: '/finance/exchange', icon: DollarSign, labelKey: 'nav.finance.exchange', canWriteOnly: true },
      { to: '/finance/recurring', icon: RefreshCw, labelKey: 'nav.finance.recurring', canWriteOnly: true },
      // Future: { to: '/users', icon: UserCog, labelKey: 'users', adminOnly: true }
      // Future: { to: '/company', icon: Building2, labelKey: 'companySettings', adminOnly: true }
    ],
  },
];
