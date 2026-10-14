import { cn } from '../../utils/format'

export const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} aria-hidden="true" />
)

export const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
)

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="divide-y divide-app-border">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-4 py-3.5">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-40' : 'w-full max-w-24')} />
        ))}
      </div>
    ))}
  </div>
)

export const SkeletonCards = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-16" />
        <Skeleton className="mt-3 h-3 w-32" />
      </div>
    ))}
  </div>
)