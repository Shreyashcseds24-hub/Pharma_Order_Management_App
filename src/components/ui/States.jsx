import { cn } from '../../utils/format'
import { USE_MOCK_API } from '../../services/api'

export const EmptyState = ({ icon: Icon, title, description, action, className, compact = false }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'px-4 py-8' : 'px-6 py-14',
      className,
    )}
  >
    {Icon ? (
      <span className="mb-4 rounded-2xl bg-app-surface p-3.5 text-slate-400 shadow-soft">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    ) : null}
    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
    {description ? <p className="mt-1 max-w-sm text-sm text-app-muted">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

export const ErrorState = ({ title = 'Something went wrong', message, onRetry, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center rounded-[1.25rem] border border-red-200/60 bg-red-50/60 px-6 py-10 text-center',
      'shadow-inset-sm',
      className,
    )}
    role="alert"
  >
    <h3 className="text-sm font-bold text-red-800">{title}</h3>
    {message ? <p className="mt-1 max-w-md text-sm text-red-700">{message}</p> : null}
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="neu-btn-danger mt-4 inline-flex h-10 items-center rounded-[0.95rem] px-4 text-sm font-semibold"
      >
        Try again
      </button>
    ) : null}
  </div>
)

export const DemoBanner = ({ children, className, icon: Icon }) => {
  if (!USE_MOCK_API) return null

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border border-brand-200/60 bg-brand-50/70 px-4 py-3 text-xs text-brand-800',
        'shadow-soft',
        className,
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <p className="leading-relaxed">{children}</p>
    </div>
  )
}
