import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { Logo } from '../components/layout/Logo'
import { Helmet } from '../components/layout/Helmet'

const HIGHLIGHTS = [
  {
    icon: Truck,
    title: 'Order flow, end to end',
    copy: 'Raise, approve and track purchase orders without leaving the workspace.',
  },
  {
    icon: Sparkles,
    title: 'Forecasts that act early',
    copy: 'Demand and stockout signals surface before shelves run empty.',
  },
  {
    icon: ShieldCheck,
    title: 'Batch-level accuracy',
    copy: 'FEFO expiry tracking keeps every batch accountable.',
  },
]

export const AuthLayout = () => (
  <div className="grid min-h-screen bg-app-bg lg:grid-cols-[1.05fr_1fr]">
    <Helmet title="Sign in - MediFlow AI" />
    <div className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="neu-orb -top-24 -left-16 h-72 w-72 bg-brand-300/50" />
        <div className="neu-orb bottom-0 left-1/3 h-64 w-64 bg-accent-300/40" />
      </div>
      <div className="relative">
        <Logo />
      </div>
      <div className="relative flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
      <p className="relative text-center text-xs text-app-muted">
        Need access?{' '}
        <Link to="/register" className="font-bold text-brand-700 underline underline-offset-4">
          Create a demo account
        </Link>
      </p>
    </div>

    <div className="relative hidden p-6 lg:flex">
      <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br from-[#e9eef5] to-[#d7dfea] p-12 shadow-raised">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-300/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-accent-300/40 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full border border-white/60" />
          <div className="absolute top-1/3 right-1/4 h-40 w-40 translate-x-8 translate-y-8 rounded-full border border-white/40" />
        </div>

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/50 px-3.5 py-1.5 text-[10px] font-extrabold tracking-[0.16em] text-brand-700 uppercase shadow-soft">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Pharmaceutical operations
          </p>
          <h2 className="mt-6 max-w-md text-[2rem] leading-[1.2] font-extrabold tracking-tight text-slate-900">
            Inventory, orders and expiry tracking in one calm workspace.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-app-muted">
            MediFlow AI helps distributors and retailers keep medicine stock accurate, catch expiries
            early and act on demand forecasts before a stockout happens.
          </p>
        </div>

        <ul className="relative mt-10 space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, copy }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/40 p-3.5 shadow-soft"
            >
              <span className="rounded-xl bg-app-surface p-2 text-brand-600 shadow-soft">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-app-muted">{copy}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="relative mt-10 grid grid-cols-3 gap-4 border-t border-white/60 pt-8">
          {[
            ['40+', 'Sample SKUs'],
            ['FEFO', 'Batch tracking'],
            ['7 / 30', 'Forecast horizons'],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="text-2xl font-extrabold text-brand-700">{value}</dt>
              <dd className="mt-1 text-xs font-medium text-app-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </div>
)

export default AuthLayout
