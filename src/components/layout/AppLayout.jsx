import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { cn } from '../../utils/format'

export const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <div className="relative min-h-screen bg-app-bg">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="neu-orb -top-32 left-1/4 h-80 w-80 bg-brand-300/60" />
        <div className="neu-orb right-0 bottom-0 h-72 w-72 bg-accent-300/50" />
      </div>

      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <div
        className={cn(
          'relative transition-[padding] duration-200',
          collapsed ? 'lg:pl-24' : 'lg:pl-[17.5rem]',
        )}
      >
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
