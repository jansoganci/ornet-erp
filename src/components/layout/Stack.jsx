import { cn } from '../../lib/utils';

const spacingClasses = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export function Stack({
  direction = 'vertical',
  spacing = 'md',
  align,
  justify,
  as = 'div',
  className,
  children,
  ...props
}) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        'flex',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        spacingClasses[spacing],
        align && alignClasses[align],
        justify && justifyClasses[justify],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
