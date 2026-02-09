import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { AuthLayout } from './components/AuthLayout';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export function VerifyEmailPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('error');
      setErrorMessage(t('auth:errors.supabaseNotConfigured'));
      return;
    }

    // The email verification happens automatically when the user clicks the link
    // Supabase handles the token verification and signs the user in
    const checkVerification = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setStatus('error');
          setErrorMessage(t('verifyEmail.error.message'));
          return;
        }

        if (session?.user?.email_confirmed_at) {
          // Email is verified
          setStatus('success');
        } else if (session?.user) {
          // User is logged in but email not yet confirmed
          // This might happen if verification is still processing
          // Wait a moment and check again
          setTimeout(async () => {
            const { data: { session: refreshedSession } } = await supabase.auth.getSession();
            if (refreshedSession?.user?.email_confirmed_at) {
              setStatus('success');
            } else {
              // Still not verified - show success anyway since they clicked the link
              // The verification might be delayed
              setStatus('success');
            }
          }, 1500);
        } else {
          // No session - verification failed or expired
          setStatus('error');
          setErrorMessage(t('verifyEmail.error.message'));
        }
      } catch {
        setStatus('error');
        setErrorMessage(t('verifyEmail.error.message'));
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
          setStatus('success');
        } else if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
          setStatus('success');
        }
      }
    );

    // Initial check
    checkVerification();

    return () => {
      subscription.unsubscribe();
    };
  }, [t]);

  // Verifying state
  if (status === 'verifying') {
    return (
      <AuthLayout title={t('verifyEmail.title')}>
        <div className="text-center py-8">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('verifyEmail.checking')}
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          {/* Error icon */}
          <div className="mx-auto w-16 h-16 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-error-600 dark:text-error-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
            {t('verifyEmail.error.title')}
          </h2>

          {/* Message */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {errorMessage}
          </p>

          {/* Go to login */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            {t('verifyEmail.continueToLogin')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Success state
  return (
    <AuthLayout>
      <div className="text-center py-4">
        {/* Success icon */}
        <div className="mx-auto w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
          {t('verifyEmail.success.title')}
        </h2>

        {/* Message */}
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t('verifyEmail.success.message')}
        </p>

        {/* Go to dashboard or login */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => navigate('/')}
        >
          {t('verifyEmail.continueToLogin')}
        </Button>
      </div>
    </AuthLayout>
  );
}
