import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { cn, formatNumber } from '../../utils/format'

const TONES = {
  brand: {
    value: 'text-brand-700',
    icon: 'bg-brand-50/90 text-brand-600',
    glow: 'bg-brand-400/25',
  },
  accent: {
    value: 'text-accent-700',
    icon: 'bg-accent-50/90 text-accent-600',
    glow: 'bg-accent-400/25',
  },
  warning: {
    value: 'text-amber-700',
    icon: 'bg-amber-50/90 text-amber-600',
    glow: 'bg-amber-400/25',
  },
  danger: {
    value: 'text-red-700',
    icon: 'bg-red-50/90 text-red-600',
    glow: 'bg-red-400/25',
  },
}

export const StatCard = ({ label, value, icon: Icon, tone = 'brand', trend, hint, loading }) => {
  const styles = TONES[tone] ?? TONES.brand
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : ArrowUpRight

  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <div
        className={cn(
          'pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-200 group-hover:opacity-90',
          styles.glow,
        )}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="pt-1 text-[11px] font-bold tracking-[0.12em] text-app-muted uppercase">{label}</p>
        {Icon ? (
          <span className={cn('rounded-2xl p-2.5 shadow-soft', styles.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="relative mt-4 h-9 w-24" />
      ) : (
        <p className={cn('relative mt-3 text-[1.85rem] leading-none font-extrabold tracking-tight', styles.value)}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
      )}

      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
              trend.direction === 'up'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                : 'bg-red-50 text-red-700 ring-red-200/70',
            )}
          >
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs leading-relaxed text-app-muted">{hint}</span> : null}
      </div>
    </Card>
  )
}

export default StatCard
