import { cn } from '../../lib/utils';

/**
 * PageContainer Component
 * 
 * Consistent page wrapper with max-width, padding, and background options.
 * Responsive padding: 16px mobile, 32px desktop.
 * 
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg' | 'xl' | 'full'} [props.maxWidth='xl'] - Max width constraint
 * @param {boolean | 'none' | 'compact' | 'default' | 'large'} [props.padding='default'] - Padding option
 * @param {'white' | 'transparent' | 'muted'} [props.background='white'] - Background color
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Page content
 */
export function PageContainer({
  maxWidth = 'xl',
  padding = 'default',
  background = 'white',
  className,
  children,
  ...props
}) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',   // 640px
    md: 'max-w-screen-md',   // 800px
    lg: 'max-w-screen-lg',   // 1024px
    xl: 'max-w-screen-xl',   // 1280px
    full: 'max-w-full',      // 100%
  };

  const paddingClasses = {
    none: '',
    compact: 'p-4 sm:p-6',           // 16px mobile, 24px desktop
    default: 'p-4 sm:p-6 lg:p-8',    // 16px mobile, 24px tablet, 32px desktop
    large: 'p-6 sm:p-8 lg:p-12',     // 24px mobile, 32px tablet, 48px desktop
  };

  const backgroundClasses = {
    white: 'bg-white dark:bg-[#171717]',
    transparent: 'bg-transparent',
    muted: 'bg-neutral-50 dark:bg-[#0a0a0a]',
  };

  // Handle boolean padding prop (backward compatibility)
  const paddingValue = typeof padding === 'boolean' 
    ? (padding ? 'default' : 'none')
    : padding;

  return (
    <div
      className={cn(
        maxWidthClasses[maxWidth],
        paddingClasses[paddingValue],
        backgroundClasses[background],
        'mx-auto w-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
