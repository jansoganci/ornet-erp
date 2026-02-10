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
  Receipt,
  FileText,
} from 'lucide-react';

export const navItems = [
  { to: '/', icon: Home, labelKey: 'nav.dashboard', exact: true },
  { to: '/daily-work', icon: CalendarCheck, labelKey: 'nav.dailyWork' },
  { to: '/customers', icon: Users, labelKey: 'nav.customers' },
  { to: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders' },
  { to: '/work-history', icon: Search, labelKey: 'nav.workHistory' },
  { to: '/calendar', icon: Calendar, labelKey: 'nav.calendar' },
  { to: '/tasks', icon: Target, labelKey: 'nav.tasks' },
  { to: '/materials', icon: Package, labelKey: 'nav.materials' },
  { to: '/subscriptions', icon: CreditCard, labelKey: 'nav.subscriptions' },
  { to: '/subscriptions/price-revision', icon: Receipt, labelKey: 'nav.priceRevision', adminOnly: true },
  { to: '/sim-cards', icon: Cpu, labelKey: 'simCards:title' },
  { to: '/proposals', icon: FileText, labelKey: 'nav.proposals' },
];
