import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Input, Spinner, Badge, ErrorState, FormSkeleton } from '../../components/ui';
import { PasswordInput } from '../auth/components/PasswordInput';
import { PasswordStrength } from '../auth/components/PasswordStrength';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentProfile } from '../subscriptions/hooks';
import { useUpdateProfile } from './hooks';
import {
  profileSchema,
  profileDefaultValues,
  changePasswordSchema,
  changePasswordDefaultValues,
} from './schema';
import { getAuthErrorKey } from '../auth/utils/errorMapper';

function getRoleLabel(role) {
  return role ? `common:roles.${role}` : null;
}

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'auth', 'common']);
  const { user, updatePassword } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useCurrentProfile();
  const updateProfileMutation = useUpdateProfile();

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaultValues,
  });

  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: changePasswordDefaultValues,
  });

  const password = passwordForm.watch('password');

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, profileForm]);

  const onProfileSubmit = async (data) => {
    if (!user?.id) return;
    try {
      await updateProfileMutation.mutateAsync({
        id: user.id,
        data: {
          full_name: data.full_name,
          phone: data.phone || null,
        },
      });
    } catch (err) {
      // Error handled by mutation onError (toast)
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      await updatePassword(data.password);
      toast.success(t('profile:changePassword.success'));
      passwordForm.reset(changePasswordDefaultValues);
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('profile:title') },
  ];

  if (profileLoading && !profile && !profileError) {
    return <FormSkeleton />;
  }

  if (profileError) {
    return (
      <PageContainer maxWidth="xl" padding="default" className="space-y-6">
        <PageHeader title={t('profile:title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={profileError.message} onRetry={refetchProfile} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader title={t('profile:title')} breadcrumbs={breadcrumbs} />

      <div className="mt-6 space-y-6">
        {/* Personal Info Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            {t('profile:sections.personalInfo')}
          </h2>
          <form
            onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            className="space-y-4"
          >
            <Input
              label={t('profile:fields.fullName')}
              placeholder={t('profile:placeholders.fullName')}
              error={profileForm.formState.errors.full_name?.message}
              {...profileForm.register('full_name')}
            />
            <Input
              label={t('profile:fields.email')}
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-neutral-50 dark:bg-neutral-800/50 cursor-not-allowed"
            />
            <Input
              label={t('profile:fields.phone')}
              placeholder={t('profile:placeholders.phone')}
              error={profileForm.formState.errors.phone?.message}
              {...profileForm.register('phone')}
            />
            {profile?.role && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {t('profile:fields.role')}
                </label>
                <Badge variant="secondary">{t(getRoleLabel(profile.role)) || profile.role}</Badge>
              </div>
            )}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={updateProfileMutation.isPending}
              >
                {t('profile:actions.save')}
              </Button>
            </div>
          </form>
        </Card>

        {/* Security Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            {t('profile:sections.security')}
          </h2>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="space-y-4"
          >
            <PasswordInput
              label={t('profile:changePassword.password')}
              autoComplete="new-password"
              error={passwordForm.formState.errors.password?.message}
              {...passwordForm.register('password')}
            />
            <PasswordStrength password={password} />
            <PasswordInput
              label={t('profile:changePassword.confirmPassword')}
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword')}
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={passwordForm.formState.isSubmitting}
              >
                {t('profile:actions.changePassword')}
              </Button>
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('profile:changePassword.forgotLink')}
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
