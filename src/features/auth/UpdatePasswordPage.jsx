import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle, AlertCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { AuthLayout } from './components/AuthLayout';
import { PasswordInput } from './components/PasswordInput';
import { PasswordStrength } from './components/PasswordStrength';
import { updatePasswordSchema, updatePasswordDefaultValues } from './schema';
import { updatePassword } from './api';
import { getAuthErrorKey } from './utils/errorMapper';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export function UpdatePasswordPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  // States for the recovery flow
  const [pageState, setPageState] = useState('loading'); // loading | ready | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: updatePasswordDefaultValues,
  });

  // Watch password for strength indicator
  const password = watch('password');

  // Check if user came from a valid password reset link
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setPageState('error');
      setErrorMessage(t('auth:errors.supabaseNotConfigured'));
      return;
    }

    // Listen for the PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked on password reset link and is now in recovery mode
          setPageState('ready');
        } else if (event === 'SIGNED_IN' && session) {
          // User is signed in - might have already been in recovery mode
          setPageState('ready');
        }
      }
    );

    // Also check current session - user might already be in recovery mode
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setPageState('error');
        setErrorMessage(t('auth:errors.resetTokenInvalid'));
        return;
      }

      if (session) {
        // User has a valid session (from recovery link)
        setPageState('ready');
      } else {
        // No session - wait a moment for PASSWORD_RECOVERY event
        // If it doesn't fire, show error
        setTimeout(() => {
          setPageState((current) => {
            if (current === 'loading') {
              return 'error';
            }
            return current;
          });
          setErrorMessage(t('auth:errors.resetTokenExpired'));
        }, 2000);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [t]);

  const onSubmit = async (data) => {
    try {
      await updatePassword(data.password);
      setPageState('success');
      toast.success(t('updatePassword.success.message'));
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('verifyEmail.checking')}
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Error state - invalid or expired token
  if (pageState === 'error') {
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
            {errorMessage || t('auth:errors.resetTokenExpired')}
          </p>

          {/* Request new link */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/forgot-password')}
          >
            {t('forgotPassword.submit')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          {/* Success icon */}
          <div className="mx-auto w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
            {t('updatePassword.success.title')}
          </h2>

          {/* Message */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t('updatePassword.success.message')}
          </p>

          {/* Go to login */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            {t('login.title')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Ready state - show password form
  return (
    <AuthLayout
      title={t('updatePassword.title')}
      subtitle={t('updatePassword.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password */}
        <div>
          <PasswordInput
            label={t('updatePassword.password')}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength password={password} />
        </div>

        {/* Confirm New Password */}
        <PasswordInput
          label={t('updatePassword.confirmPassword')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
        >
          {isSubmitting ? t('updatePassword.submitting') : t('updatePassword.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
