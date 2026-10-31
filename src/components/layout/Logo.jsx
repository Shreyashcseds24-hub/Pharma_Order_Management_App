import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '../../utils/format'

export const Logo = ({ collapsed = false, className }) => (
  <Link
    to="/dashboard"
    className={cn('flex items-center gap-2.5 rounded-xl', className)}
    aria-label="MediFlow AI home"
  >
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-raised">
      <span className="absolute inset-0 rounded-xl border border-white/25" aria-hidden="true" />
      <Plus className="relative" size={18} strokeWidth={2.6} aria-hidden="true" />
    </span>
    {!collapsed ? (
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-extrabold tracking-tight text-slate-900">
          MediFlow AI
        </span>
        <span className="block text-[10px] leading-tight font-semibold tracking-[0.14em] text-app-muted uppercase">
          Pharma Ops
        </span>
      </span>
    ) : null}
  </Link>
)

export default Logo
