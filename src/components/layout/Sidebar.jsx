import { NavLink } from 'react-router-dom'
import { X, ChevronsLeft, ChevronsRight, FlaskConical } from 'lucide-react'
import { navItemsForRole } from '../../layout/navConfig'
import { useAuth } from '../../context/AuthContext'
import { USE_MOCK_API } from '../../services/api'
import { cn } from '../../utils/format'
import { Logo } from './Logo'

const NavItems = ({ items, onNavigate, iconOnly = false }) => (
  <nav
    className={cn('scroll-thin flex-1 space-y-1.5 overflow-y-auto py-4', iconOnly ? 'px-2.5' : 'px-3')}
    aria-label={iconOnly ? 'Collapsed navigation' : 'Main navigation'}
  >
    {!iconOnly ? (
      <p className="px-3 pb-1 text-[10px] font-extrabold tracking-[0.16em] text-slate-400 uppercase">
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
            'neu-nav-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold',
            iconOnly && 'justify-center px-0',
            isActive && 'neu-nav-item-active',
            !isActive && 'text-slate-600',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-slate-400')}
              size={18}
              aria-hidden="true"
            />
            {!iconOnly ? <span className="truncate">{label}</span> : null}
            {iconOnly ? <span className="sr-only">{label}</span> : null}
            {!iconOnly && isActive ? (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600 shadow-[0_0_6px_rgba(108,99,255,0.7)]"
                aria-hidden="true"
              />
            ) : null}
          </>
        )}
      </NavLink>
    ))}
  </nav>
)

const DemoNotice = () => (
  <div className="mx-3 mb-3 rounded-2xl border border-amber-200/60 bg-amber-50/70 px-3 py-2.5 shadow-soft">
    <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
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
          className="fixed inset-0 z-40 bg-[#405b7a]/25 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-app-bg transition-[width,transform] duration-200',
          'border-r border-white/50 lg:inset-y-3 lg:left-3 lg:rounded-[1.6rem] lg:border lg:shadow-raised',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          'lg:translate-x-0',
        )}
        aria-label="Sidebar"
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-between border-b border-app-border/50 px-4',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Logo collapsed={collapsed} />
          <button
            type="button"
            onClick={onClose}
            className="neu-icon-btn h-9 w-9 rounded-xl lg:hidden"
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
            {USE_MOCK_API ? <DemoNotice /> : null}
          </>
        )}

        <div className="hidden border-t border-app-border/50 p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'neu-btn-inset flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-app-muted',
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
