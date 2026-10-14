import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '../../utils/format'

export const Logo = ({ collapsed = false, className }) => (
  <Link
    to="/dashboard"
    className={cn('flex items-center gap-2.5 rounded-md', className)}
    aria-label="MediFlow AI home"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
      <Plus className="h-4.5 w-4.5" size={18} strokeWidth={2.5} aria-hidden="true" />
    </span>
    {!collapsed ? (
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold text-slate-900">MediFlow AI</span>
        <span className="block text-[10px] leading-tight tracking-wide text-app-muted uppercase">
          Pharma Operations
        </span>
      </span>
    ) : null}
  </Link>
)

export default Logo