/**
 * Map Supabase auth errors to i18n keys
 * @param {Error} error - The error object from Supabase
 * @returns {string} - The i18n key for the error message
 */
export function getAuthErrorKey(error) {
  if (!error) return 'auth:errors.generic';

  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';

  // Error mapping: Supabase error patterns → i18n keys
  const errorPatterns = [
    // Sign in errors
    { pattern: 'invalid_credentials', key: 'auth:errors.invalidCredentials' },
    { pattern: 'invalid login credentials', key: 'auth:errors.invalidCredentials' },
    { pattern: 'invalid email or password', key: 'auth:errors.invalidCredentials' },

    // Sign up errors
    { pattern: 'user already registered', key: 'auth:errors.emailAlreadyExists' },
    { pattern: 'email already registered', key: 'auth:errors.emailAlreadyExists' },
    { pattern: 'email address already registered', key: 'auth:errors.emailAlreadyExists' },
    { pattern: 'password should be at least', key: 'auth:errors.weakPassword' },
    { pattern: 'password is too short', key: 'auth:errors.weakPassword' },
    { pattern: 'password is too weak', key: 'auth:errors.weakPassword' },

    // Rate limiting
    { pattern: 'too many requests', key: 'auth:errors.tooManyRequests' },
    { pattern: 'email rate limit exceeded', key: 'auth:errors.tooManyRequests' },
    { pattern: 'rate limit', key: 'auth:errors.tooManyRequests' },

    // Network errors
    { pattern: 'fetch failed', key: 'auth:errors.networkError' },
    { pattern: 'network', key: 'auth:errors.networkError' },
    { pattern: 'failed to fetch', key: 'auth:errors.networkError' },

    // Session errors
    { pattern: 'session expired', key: 'auth:errors.sessionExpired' },
    { pattern: 'refresh token', key: 'auth:errors.sessionExpired' },
    { pattern: 'jwt expired', key: 'auth:errors.sessionExpired' },

    // Email verification
    { pattern: 'email not confirmed', key: 'auth:errors.emailNotVerified' },
    { pattern: 'email not verified', key: 'auth:errors.emailNotVerified' },

    // Password reset
    { pattern: 'token expired', key: 'auth:errors.resetTokenExpired' },
    { pattern: 'token has expired', key: 'auth:errors.resetTokenExpired' },
    { pattern: 'invalid token', key: 'auth:errors.resetTokenInvalid' },
    { pattern: 'otp expired', key: 'auth:errors.resetTokenExpired' },

    // Configuration
    { pattern: 'supabase_not_configured', key: 'auth:errors.supabaseNotConfigured' },
  ];

  // Check code first (more reliable)
  for (const { pattern, key } of errorPatterns) {
    if (code.toLowerCase().includes(pattern)) {
      return key;
    }
  }

  // Check message content
  for (const { pattern, key } of errorPatterns) {
    if (message.includes(pattern)) {
      return key;
    }
  }

  // Default error
  return 'auth:errors.generic';
}
