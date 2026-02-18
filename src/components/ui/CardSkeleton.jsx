import { Skeleton } from './Skeleton';
import { Card } from './Card';

export function CardSkeleton({ count = 1, className }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
