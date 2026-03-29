import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';

export function Table({
  columns = [],
  data = [],
  keyExtractor,
  onRowClick,
  onRowMouseEnter,
  loading = false,
  emptyMessage,
  emptyState,
  striped = false,
  rowClassName,
  className,
  mobileCardLayout = 'stacked',
  ...props
}) {
  const { t } = useTranslation('common');
  const displayEmptyMessage = emptyMessage || t('empty.noData');

  const getKey = (item, index) => {
    if (keyExtractor) return keyExtractor(item, index);
    return item.id ?? index;
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={className} {...props}>
      {/* Mobile View: Card Stack */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:hidden">
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}
        {!loading && data.length === 0 && (
          emptyState || (
            <Card className="p-8 text-center text-neutral-500 border-dashed">
              {displayEmptyMessage}
            </Card>
          )
        )}
        {!loading &&
          data.map((item, rowIndex) => {
            const mobileColumns = columns.filter((c) => !c.hideOnMobile);
            const hasCardSection = mobileColumns.some((c) => c.cardSection);
            const primaryColumns = hasCardSection
              ? mobileColumns.filter((c) => c.cardSection === 'primary' || !c.cardSection)
              : mobileColumns.slice(0, 2);
            const metaColumns = hasCardSection
              ? mobileColumns.filter((c) => c.cardSection === 'meta')
              : mobileColumns.slice(2);
            const useTabletGrid = metaColumns.length > 0;

            const isInline = mobileCardLayout === 'inline';
            const renderColumnBlock = (column, colIndex) => {
              const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
              return (
                <div
                  key={fieldKey}
                  className={cn(
                    'min-w-0',
                    isInline
                      ? 'flex items-center justify-between gap-3'
                      : 'flex flex-col gap-0.5'
                  )}
                >
                  <span className="text-[10px] uppercase font-medium text-neutral-400 dark:text-neutral-500 tracking-wider shrink-0">
                    {column.header}
                  </span>
                  <div
                    className={cn(
                      'text-sm text-neutral-900 dark:text-neutral-50',
                      isInline && 'min-w-0 flex-1',
                      alignClasses[column.align || 'left'],
                      column.cardClassName
                    )}
                  >
                    {column.render
                      ? column.render(item[fieldKey], item, rowIndex)
                      : item[fieldKey]}
                  </div>
                </div>
              );
            };

            return (
              <Card
                key={getKey(item, rowIndex)}
                variant={onRowClick ? 'interactive' : 'default'}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(item) : undefined}
                className={cn(
                  'p-3 md:p-4',
                  typeof rowClassName === 'function' ? rowClassName(item, rowIndex) : rowClassName
                )}
              >
                <div
                  className={cn(
                    'grid gap-y-2 md:gap-y-3',
                    useTabletGrid && 'md:grid-cols-2 md:gap-x-6 md:gap-y-2'
                  )}
                >
                  <div className="min-w-0 space-y-2 md:space-y-3">
                    {primaryColumns.map((col, i) => renderColumnBlock(col, i))}
                  </div>
                  {useTabletGrid && (
                    <div className="min-w-0 space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-2">
                      {metaColumns.map((col, i) => renderColumnBlock(col, primaryColumns.length + i))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
      </div>

      {/* Desktop View: Standard Table */}
      <div
        className={cn(
          'hidden lg:block overflow-x-auto rounded-lg border border-neutral-200 dark:border-[#262626] shadow-sm bg-white dark:bg-[#171717]'
        )}
      >
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-[#262626]">
          <thead className="bg-neutral-50 dark:bg-[#1a1a1a]">
            <tr>
              {columns.map((column, colIndex) => {
                const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
                return (
                  <th
                    key={fieldKey}
                    scope="col"
                    className={cn(
                      'px-6 py-3.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider',
                      alignClasses[column.align || 'left'],
                      column.headerClassName,
                      column.stickyRight && 'sticky right-0 bg-neutral-50 dark:bg-[#1a1a1a] shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)] z-10'
                    )}
                    style={
                      column.width || column.maxWidth || column.minWidth
                        ? { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth }
                        : undefined
                    }
                  >
                    {column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#171717] divide-y divide-neutral-200 dark:divide-[#262626] relative">
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12">
                  {emptyState || (
                    <span className="text-neutral-500">{displayEmptyMessage}</span>
                  )}
                </td>
              </tr>
            )}
            {!loading &&
              data.map((item, rowIndex) => (
                <tr
                  key={getKey(item, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(item) : undefined}
                  className={cn(
                    'transition-all duration-200',
                    onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#262626]',
                    striped && rowIndex % 2 === 1 && 'bg-neutral-50/50 dark:bg-[#1a1a1a]/30',
                    typeof rowClassName === 'function' ? rowClassName(item, rowIndex) : rowClassName
                  )}
                >
                  {columns.map((column, colIndex) => {
                    const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
                    return (
                      <td
                        key={fieldKey}
                        className={cn(
                          'px-6 py-4 text-sm text-neutral-900 dark:text-neutral-50 transition-colors duration-200',
                          column.cellClassName ?? 'whitespace-nowrap',
                          alignClasses[column.align || 'left'],
                          column.stickyRight && 'sticky right-0 bg-white dark:bg-[#171717] shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)] z-10'
                        )}
                        style={
                          column.minWidth || column.maxWidth
                            ? { minWidth: column.minWidth, maxWidth: column.maxWidth }
                            : undefined
                        }
                      >
                        {column.render
                          ? column.render(item[fieldKey], item, rowIndex)
                          : item[fieldKey]}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
