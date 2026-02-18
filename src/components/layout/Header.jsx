import { cn } from '../../lib/utils';
import { Container } from './Container';

export function Header({
  title,
  leftContent,
  rightContent,
  sticky = false,
  className,
  ...props
}) {
  return (
    <header
      className={cn(
        'bg-white border-b border-neutral-200 h-14 md:h-16',
        sticky && 'sticky top-0 z-100',
        className
      )}
      {...props}
    >
      <Container
        maxWidth="xl"
        className="h-full flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          {leftContent}
          {title && (
            <h1 className="text-lg md:text-xl font-semibold font-heading text-neutral-900">
              {title}
            </h1>
          )}
        </div>
        {rightContent && (
          <div className="flex items-center gap-3">
            {rightContent}
          </div>
        )}
      </Container>
    </header>
  );
}
