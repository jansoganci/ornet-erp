import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export function ProtectedRoute({ children }) {
  const { t } = useTranslation('common')
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return children
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <p className="text-[var(--color-text-secondary)]">{t('loading')}</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
