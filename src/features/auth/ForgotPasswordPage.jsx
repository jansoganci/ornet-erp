import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './components/AuthLayout';
import { forgotPasswordSchema, forgotPasswordDefaultValues } from './schema';
import { resetPassword } from './api';
import { getAuthErrorKey } from './utils/errorMapper';

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: forgotPasswordDefaultValues,
  });

  const onSubmit = async (data) => {
    try {
      await resetPassword(data.email);
      setIsSuccess(true);
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  // Success state - show confirmation message
  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          {/* Success icon */}
          <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
            {t('forgotPassword.success.title')}
          </h2>

          {/* Message */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t('forgotPassword.success.message')}
          </p>

          {/* Back to login link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('forgotPassword.title')}
      subtitle={t('forgotPassword.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <Input
          label={t('forgotPassword.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
        >
          {isSubmitting ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>
      </form>

      {/* Back to login link */}
      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>
    </AuthLayout>
  );
}
