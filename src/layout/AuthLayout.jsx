import { Link, Outlet } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Helmet } from '../components/layout/Helmet'

export const AuthLayout = () => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <Helmet title="Sign in - MediFlow AI" />
    <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
      <p className="text-center text-xs text-app-muted">
        Need access?{' '}
        <Link to="/register" className="font-medium text-brand-700 underline underline-offset-2">
          Create a demo account
        </Link>
      </p>
    </div>

    <div className="relative hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-accent-500 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-brand-400 blur-3xl" />
      </div>
      <div className="relative">
        <p className="text-xs font-semibold tracking-widest text-brand-100 uppercase">
          Pharmaceutical operations
        </p>
        <h2 className="mt-4 max-w-md text-3xl leading-snug font-semibold">
          Inventory, orders and expiry tracking in one workspace.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100">
          MediFlow AI helps distributors and retailers keep medicine stock accurate, catch expiries early
          and act on demand forecasts before a stockout happens.
        </p>
      </div>
      <dl className="relative grid grid-cols-3 gap-4 border-t border-white/15 pt-8">
        {[
          ['40+', 'Sample SKUs'],
          ['FEFO', 'Batch tracking'],
          ['7 / 30', 'Forecast horizons'],
        ].map(([value, label]) => (
          <div key={label}>
            <dt className="text-2xl font-semibold">{value}</dt>
            <dd className="mt-1 text-xs text-brand-100">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
)

export default AuthLayout