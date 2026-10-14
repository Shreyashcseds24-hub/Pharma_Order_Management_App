import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { cn, formatNumber } from '../../utils/format'

const TONES = {
  brand: { value: 'text-brand-700', chip: 'bg-brand-50 text-brand-700', icon: 'bg-brand-50 text-brand-600' },
  accent: { value: 'text-accent-700', chip: 'bg-accent-50 text-accent-700', icon: 'bg-accent-50 text-accent-600' },
  warning: { value: 'text-amber-700', chip: 'bg-amber-50 text-amber-700', icon: 'bg-amber-50 text-amber-600' },
  danger: { value: 'text-red-700', chip: 'bg-red-50 text-red-700', icon: 'bg-red-50 text-red-600' },
}

export const StatCard = ({ label, value, icon: Icon, tone = 'brand', trend, hint, loading }) => {
  const styles = TONES[tone] ?? TONES.brand
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : ArrowUpRight

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-app-muted uppercase">{label}</p>
        {Icon ? (
          <span className={cn('rounded-lg p-2', styles.icon)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className={cn('mt-2 text-2xl font-semibold tracking-tight', styles.value)}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trend.direction === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-app-muted">{hint}</span> : null}
      </div>
    </Card>
  )
}

export default StatCard