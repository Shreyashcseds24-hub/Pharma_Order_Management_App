import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useClickOutside } from '../../hooks/useDismiss'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { ROLE_LABELS } from '../../data/constants'
import { cn, relativeTime } from '../../utils/format'
import { PAGE_TITLES } from '../../layout/navConfig'
import { notifications } from '../../data/mockData'
import { Badge } from '../ui/Badge'

const NOTIFICATION_TONES = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  info: 'bg-brand-500',
}

const GlobalSearch = ({ className }) => {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(term, 200)
  const ref = useRef(null)
  const navigate = useNavigate()

  useClickOutside(ref, () => setOpen(false), open)

  const query = debounced.trim()
  const options = query.length < 2 ? [] : [
    { label: `Search catalog for "${query}"`, to: `/medicines?q=${encodeURIComponent(query)}` },
    { label: `View inventory for "${query}"`, to: `/inventory?q=${encodeURIComponent(query)}` },
    { label: `Filter orders for "${query}"`, to: `/orders?q=${encodeURIComponent(query)}` },
  ]

  const submit = (event) => {
    event.preventDefault()
    const value = term.trim()
    if (!value) return
    setOpen(false)
    navigate(`/medicines?q=${encodeURIComponent(value)}`)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <form onSubmit={submit} role="search">
        <label htmlFor="global-search" className="sr-only">
          Search medicines, orders, retailers
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="global-search"
          type="search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search medicines, batches, orders..."
          className="input-base h-9 pl-9"
          autoComplete="off"
        />
      </form>

      {open && options.length > 0 ? (
        <ul className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-lg border border-app-border bg-white py-1 shadow-pop">
          {options.map(({ label, to }) => (
            <li key={to}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(to)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const NotificationsMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = notifications.filter((n) => !n.read).length

  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-app-muted transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4.5 w-4.5" size={18} aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-app-border bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <Badge tone="brand" size="sm">
              {unread} new
            </Badge>
          </div>
          <ul className="scroll-thin max-h-80 divide-y divide-app-border overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span
                  className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', NOTIFICATION_TONES[n.tone])}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-app-muted">{n.detail}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(n.time)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

const ProfileMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useClickOutside(ref, () => setOpen(false), open)

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition hover:bg-slate-100"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {user.initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-800">
            {user.name}
          </span>
          <span className="block text-[11px] text-app-muted">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-app-border bg-white shadow-pop">
          <div className="border-b border-app-border px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-app-muted">{user.email}</p>
            <Badge tone="brand" size="sm" className="mt-2">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <SettingsIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Settings
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const Topbar = ({ onOpenSidebar }) => {
  const location = useLocation()
  const meta = PAGE_TITLES[location.pathname] ?? { title: 'MediFlow AI', breadcrumb: 'App' }
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-app-border bg-white/90 px-4 backdrop-blur transition-shadow sm:px-6',
        scrolled && 'shadow-soft',
      )}
    >
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-app-muted transition hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0">
        <p className="hidden text-[11px] font-medium tracking-wide text-app-muted uppercase sm:block">
          {meta.breadcrumb}
        </p>
        <h1 className="truncate text-base font-semibold text-slate-900">{meta.title}</h1>
      </div>

      <GlobalSearch className="ml-auto hidden max-w-xs flex-1 md:block" />

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <GlobalSearch className="w-full max-w-none flex-1 sm:w-40 md:hidden" />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  )
}

export default Topbar