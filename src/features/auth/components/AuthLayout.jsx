import { Link } from 'react-router-dom';

/**
 * Shared layout wrapper for auth pages (login, register, forgot password, etc.)
 * Provides consistent styling with logo, card container, and responsive design.
 */
export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-bold font-heading text-neutral-900 dark:text-neutral-50">
              Ornet ERP
            </h1>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#171717] rounded-xl shadow-sm border border-neutral-200 dark:border-[#262626] p-6 sm:p-8">
          {/* Header */}
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h2 className="text-xl font-semibold font-heading text-neutral-900 dark:text-neutral-50">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
