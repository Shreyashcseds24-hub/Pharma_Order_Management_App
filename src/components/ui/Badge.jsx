import { cn } from '../../utils/format'

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  accent: 'bg-accent-50 text-accent-700 ring-accent-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
}

export const STATUS_TONES = {
  Healthy: 'success',
  'In stock': 'success',
  Delivered: 'success',
  Paid: 'success',
  Approved: 'accent',
  Processing: 'brand',
  Shipped: 'brand',
  Pending: 'warning',
  'Low stock': 'warning',
  'Low Stock': 'warning',
  'Near expiry': 'warning',
  Overdue: 'danger',
  Cancelled: 'danger',
  'Out of stock': 'danger',
  Draft: 'neutral',
}

export const Badge = ({ tone = 'neutral', size = 'md', dot = false, className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      TONES[tone] ?? TONES.neutral,
      className,
    )}
  >
    {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
    {children}
  </span>
)

export const StatusBadge = ({ status, size = 'md', className }) => (
  <Badge tone={STATUS_TONES[status] ?? 'neutral'} size={size} dot className={className}>
    {status}
  </Badge>
)