import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from './app/providers';
import { ProtectedRoute } from './app/ProtectedRoute';
import { AuthRoute } from './app/AuthRoute';
import { AppLayout } from './app/AppLayout';

// Auth pages
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  UpdatePasswordPage,
  VerifyEmailPage,
} from './features/auth';

// Feature pages
import { DashboardPage } from './pages/DashboardPage';
import {
  CustomersListPage,
  CustomerDetailPage,
  CustomerFormPage,
} from './features/customers';
import {
  WorkOrdersListPage,
  WorkOrderDetailPage,
  WorkOrderFormPage,
  DailyWorkListPage,
} from './features/workOrders';
import {
  TasksPage,
} from './features/tasks';
import { CalendarPage } from './features/calendar';
import { WorkHistoryPage } from './features/workHistory';
import { MaterialsListPage, MaterialImportPage } from './features/materials';
import {
  SubscriptionsListPage,
  SubscriptionDetailPage,
  SubscriptionFormPage,
  PriceRevisionPage,
} from './features/subscriptions';
import {
  SimCardsListPage,
  SimCardFormPage,
  SimCardImportPage,
} from './features/simCards';
import {
  ProposalsListPage,
  ProposalDetailPage,
  ProposalFormPage,
} from './features/proposals';
import { ProfilePage } from './features/profile';
import { FinanceDashboardPage, ExpensesPage, IncomePage, VatReportPage, ExchangeRatePage, ReportsPage, RecurringExpensesPage } from './features/finance';
import { SiteAssetsListPage } from './features/siteAssets';

function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes - redirect to dashboard if logged in */}
          <Route element={<AuthRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Special auth routes - no redirect check */}
          <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Customer routes */}
            <Route path="customers" element={<CustomersListPage />} />
            <Route path="customers/new" element={<CustomerFormPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="customers/:id/edit" element={<CustomerFormPage />} />

            {/* Work Order routes */}
            <Route path="work-orders" element={<WorkOrdersListPage />} />
            <Route path="work-orders/new" element={<WorkOrderFormPage />} />
            <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="work-orders/:id/edit" element={<WorkOrderFormPage />} />

            {/* New Feature routes */}
            <Route path="daily-work" element={<DailyWorkListPage />} />
            <Route path="work-history" element={<WorkHistoryPage />} />
            <Route path="materials" element={<MaterialsListPage />} />
            <Route path="materials/import" element={<MaterialImportPage />} />

            {/* Task routes */}
            <Route path="tasks" element={<TasksPage />} />

            {/* Calendar */}
            <Route path="calendar" element={<CalendarPage />} />

            {/* Subscription routes */}
            <Route path="subscriptions" element={<SubscriptionsListPage />} />
            <Route path="subscriptions/price-revision" element={<PriceRevisionPage />} />
            <Route path="subscriptions/new" element={<SubscriptionFormPage />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
            <Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />

            {/* Proposal routes */}
            <Route path="proposals" element={<ProposalsListPage />} />
            <Route path="proposals/new" element={<ProposalFormPage />} />
            <Route path="proposals/:id" element={<ProposalDetailPage />} />
            <Route path="proposals/:id/edit" element={<ProposalFormPage />} />

            {/* Finance routes */}
            <Route path="finance" element={<FinanceDashboardPage />} />
            <Route path="finance/expenses" element={<ExpensesPage />} />
            <Route path="finance/income" element={<IncomePage />} />
            <Route path="finance/vat" element={<VatReportPage />} />
            <Route path="finance/exchange" element={<ExchangeRatePage />} />
            <Route path="finance/recurring" element={<RecurringExpensesPage />} />
            <Route path="finance/reports" element={<ReportsPage />} />

            {/* Equipment / Site Assets routes */}
            <Route path="equipment" element={<SiteAssetsListPage />} />

            {/* SIM Card routes */}
            <Route path="sim-cards" element={<SimCardsListPage />} />
            <Route path="sim-cards/new" element={<SimCardFormPage />} />
            <Route path="sim-cards/import" element={<SimCardImportPage />} />
            <Route path="sim-cards/:id/edit" element={<SimCardFormPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}

export default App;
