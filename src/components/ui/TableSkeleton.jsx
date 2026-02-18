import { Skeleton } from './Skeleton';

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex gap-2 ml-auto">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-[#1a1a1a] last:border-0">
            {[...Array(cols)].map((_, j) => (
              <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-1/3' : 'w-1/4'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
