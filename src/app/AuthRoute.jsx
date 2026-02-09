import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/Spinner';

/**
 * Wrapper for public auth pages (login, register, forgot password).
 * Redirects to dashboard if user is already logged in.
 *
 * Usage in App.jsx:
 * <Route element={<AuthRoute />}>
 *   <Route path="/login" element={<LoginPage />} />
 *   <Route path="/register" element={<RegisterPage />} />
 *   <Route path="/forgot-password" element={<ForgotPasswordPage />} />
 * </Route>
 */
export function AuthRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a]">
        <Spinner size="lg" />
      </div>
    );
  }

  // If already logged in, redirect to intended destination or dashboard
  if (user) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  // Not logged in - render the auth page
  return <Outlet />;
}
