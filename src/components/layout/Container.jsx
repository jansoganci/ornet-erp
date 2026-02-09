import { cn } from '../../lib/utils';

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  full: 'max-w-full',
};

export function Container({
  maxWidth = 'xl',
  padding = true,
  centered = true,
  as = 'div',
  className,
  children,
  ...props
}) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        maxWidthClasses[maxWidth],
        padding && 'px-4 sm:px-6 md:px-8',
        centered && 'mx-auto',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
