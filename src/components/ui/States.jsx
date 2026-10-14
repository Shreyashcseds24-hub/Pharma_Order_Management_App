import { cn } from '../../utils/format'

export const EmptyState = ({ icon: Icon, title, description, action, className, compact = false }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'px-4 py-8' : 'px-6 py-14',
      className,
    )}
  >
    {Icon ? (
      <span className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    ) : null}
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {description ? <p className="mt-1 max-w-sm text-sm text-app-muted">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

export const ErrorState = ({ title = 'Something went wrong', message, onRetry, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/50 px-6 py-10 text-center',
      className,
    )}
    role="alert"
  >
    <h3 className="text-sm font-semibold text-red-800">{title}</h3>
    {message ? <p className="mt-1 max-w-md text-sm text-red-700">{message}</p> : null}
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700"
      >
        Try again
      </button>
    ) : null}
  </div>
)

export const DemoBanner = ({ children, className, icon: Icon }) => (
  <div
    className={cn(
      'flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-800',
      className,
    )}
  >
    {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    <p className="leading-relaxed">{children}</p>
  </div>
)