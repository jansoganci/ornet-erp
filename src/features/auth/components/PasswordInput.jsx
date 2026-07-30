import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../components/ui/Input';

/**
 * Password input with show/hide toggle button.
 * Extends the standard Input component with visibility toggle functionality.
 */
export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, hint, className, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = (e) => {
    e.preventDefault();
    setShowPassword((prev) => !prev);
  };

  return (
    <Input
      ref={ref}
      type={showPassword ? 'text' : 'password'}
      label={label}
      error={error}
      hint={hint}
      className={className}
      rightIcon={
        <button
          type="button"
          onClick={toggleVisibility}
          tabIndex={-1}
          className="pointer-events-auto flex items-center justify-center border-0 bg-transparent p-0 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      }
      {...props}
    />
  );
});
