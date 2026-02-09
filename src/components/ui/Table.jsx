import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';

export function Table({
  columns = [],
  data = [],
  keyExtractor,
  onRowClick,
  loading = false,
  emptyMessage,
  striped = false,
  className,
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
      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}
        {!loading && data.length === 0 && (
          <Card className="p-8 text-center text-neutral-500 border-dashed">
            {displayEmptyMessage}
          </Card>
        )}
        {!loading &&
          data.map((item, rowIndex) => (
            <Card
              key={getKey(item, rowIndex)}
              variant={onRowClick ? 'interactive' : 'default'}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className="p-4 space-y-3"
            >
              {columns.map((column, colIndex) => {
                const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
                return (
                  <div key={fieldKey} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      {column.header}
                    </span>
                    <div className={cn('text-sm text-neutral-900 dark:text-neutral-50', alignClasses[column.align || 'left'])}>
                      {column.render
                        ? column.render(item[fieldKey], item, rowIndex)
                        : item[fieldKey]}
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
      </div>

      {/* Desktop View: Standard Table */}
      <div
        className={cn(
          'hidden lg:block overflow-x-auto rounded-md border border-neutral-200 dark:border-[#262626]'
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
                      'px-6 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider',
                      alignClasses[column.align || 'left']
                    )}
                    style={column.width ? { width: column.width } : undefined}
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
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-neutral-500"
                >
                  {displayEmptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              data.map((item, rowIndex) => (
                <tr
                  key={getKey(item, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#262626]',
                    striped && rowIndex % 2 === 1 && 'bg-neutral-50/50 dark:bg-[#1a1a1a]/30'
                  )}
                >
                  {columns.map((column, colIndex) => {
                    const fieldKey = column.key ?? column.accessor ?? `col-${colIndex}`;
                    return (
                      <td
                        key={fieldKey}
                        className={cn(
                          'px-6 py-4 text-sm text-neutral-900 dark:text-neutral-50 whitespace-nowrap',
                          alignClasses[column.align || 'left']
                        )}
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
