import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom';
import { Providers } from './app/providers';
import { ProtectedRoute } from './app/ProtectedRoute';
import { AuthRoute } from './app/AuthRoute';
import { AppLayout } from './app/AppLayout';
import { useRole } from './lib/roles';

function RoleRoute({ children }) {
  const { canWrite, role } = useRole();
  if (role === undefined) return null;
  if (!canWrite) return <Navigate to="/work-orders" replace />;
  return children;
}

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
  CustomerImportPage,
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
  InvoiceAnalysisPage,
} from './features/simCards';
import {
  ProposalsListPage,
  ProposalDetailPage,
  ProposalFormPage,
} from './features/proposals';
import { NotificationsCenterPage } from './features/notifications';
import { ProfilePage } from './features/profile';
import { FinanceDashboardPage, ExpensesPage, IncomePage, VatReportPage, ExchangeRatePage, ReportsPage, RecurringExpensesPage } from './features/finance';
import { SiteAssetsListPage } from './features/siteAssets';
import { ActionBoardPage } from './features/actionBoard';

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
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
        <Route path="notifications" element={<NotificationsCenterPage />} />
        <Route path="action-board" element={<ActionBoardPage />} />

        {/* Customer routes */}
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/import" element={<CustomerImportPage />} />
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

        {/* Subscription routes — admin + accountant only */}
        <Route path="subscriptions" element={<RoleRoute><SubscriptionsListPage /></RoleRoute>} />
        <Route path="subscriptions/price-revision" element={<RoleRoute><PriceRevisionPage /></RoleRoute>} />
        <Route path="subscriptions/new" element={<RoleRoute><SubscriptionFormPage /></RoleRoute>} />
        <Route path="subscriptions/:id" element={<RoleRoute><SubscriptionDetailPage /></RoleRoute>} />
        <Route path="subscriptions/:id/edit" element={<RoleRoute><SubscriptionFormPage /></RoleRoute>} />

        {/* Proposal routes — admin + accountant only */}
        <Route path="proposals" element={<RoleRoute><ProposalsListPage /></RoleRoute>} />
        <Route path="proposals/new" element={<RoleRoute><ProposalFormPage /></RoleRoute>} />
        <Route path="proposals/:id" element={<RoleRoute><ProposalDetailPage /></RoleRoute>} />
        <Route path="proposals/:id/edit" element={<RoleRoute><ProposalFormPage /></RoleRoute>} />

        {/* Finance routes — admin + accountant only */}
        <Route path="finance" element={<RoleRoute><FinanceDashboardPage /></RoleRoute>} />
        <Route path="finance/expenses" element={<RoleRoute><ExpensesPage /></RoleRoute>} />
        <Route path="finance/income" element={<RoleRoute><IncomePage /></RoleRoute>} />
        <Route path="finance/vat" element={<RoleRoute><VatReportPage /></RoleRoute>} />
        <Route path="finance/exchange" element={<RoleRoute><ExchangeRatePage /></RoleRoute>} />
        <Route path="finance/recurring" element={<RoleRoute><RecurringExpensesPage /></RoleRoute>} />
        <Route path="finance/reports" element={<RoleRoute><ReportsPage /></RoleRoute>} />

        {/* Equipment / Site Assets routes */}
        <Route path="equipment" element={<SiteAssetsListPage />} />

        {/* SIM Card routes — admin + accountant only */}
        <Route path="sim-cards" element={<RoleRoute><SimCardsListPage /></RoleRoute>} />
        <Route path="sim-cards/new" element={<RoleRoute><SimCardFormPage /></RoleRoute>} />
        <Route path="sim-cards/import" element={<RoleRoute><SimCardImportPage /></RoleRoute>} />
        <Route path="sim-cards/invoice-analysis" element={<RoleRoute><InvoiceAnalysisPage /></RoleRoute>} />
        <Route path="sim-cards/:id/edit" element={<RoleRoute><SimCardFormPage /></RoleRoute>} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
);

function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

export default App;
