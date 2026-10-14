import { NavLink } from 'react-router-dom'
import { X, ChevronsLeft, ChevronsRight, FlaskConical } from 'lucide-react'
import { navItemsForRole } from '../../layout/navConfig'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../utils/format'
import { Logo } from './Logo'

const NavItems = ({ items, onNavigate, iconOnly = false }) => (
  <nav
    className={cn('flex-1 space-y-1 py-4', iconOnly ? 'px-2' : 'px-3')}
    aria-label={iconOnly ? 'Collapsed navigation' : 'Main navigation'}
  >
    {!iconOnly ? (
      <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Workspace
      </p>
    ) : null}
    {items.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        onClick={onNavigate}
        title={iconOnly ? label : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            iconOnly && 'justify-center px-0',
            isActive
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400')}
              size={18}
              aria-hidden="true"
            />
            {!iconOnly ? <span className="truncate">{label}</span> : null}
            {iconOnly ? <span className="sr-only">{label}</span> : null}
          </>
        )}
      </NavLink>
    ))}
  </nav>
)

const DemoNotice = () => (
  <div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      Development mode
    </p>
    <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
      Sample data and role switching. Real access control belongs in the Flask API.
    </p>
  </div>
)

export const Sidebar = ({ open, onClose, collapsed, onToggleCollapse }) => {
  const { user } = useAuth()
  const items = navItemsForRole(user?.role)

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-app-border bg-white transition-[width,transform] duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
        )}
        aria-label="Sidebar"
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-between border-b border-app-border px-4',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Logo collapsed={collapsed} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-app-muted hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {collapsed ? (
          <>
            <NavItems items={items} iconOnly />
            <div className="hidden lg:block" />
          </>
        ) : (
          <>
            <NavItems items={items} onNavigate={onClose} />
            <DemoNotice />
          </>
        )}

        <div className="hidden border-t border-app-border p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-app-muted transition hover:bg-slate-100 hover:text-slate-800',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                Collapse sidebar
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar