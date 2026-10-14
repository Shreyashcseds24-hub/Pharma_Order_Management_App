import { cn } from '../../utils/format'

export const Card = ({ className, children, ...props }) => (
  <div className={cn('card', className)} {...props}>
    {children}
  </div>
)

export const CardHeader = ({ title, description, action, className, icon: Icon }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-4 py-3 sm:px-5',
      className,
    )}
  >
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon ? (
        <span className="mt-0.5 rounded-md bg-brand-50 p-1.5 text-brand-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-app-muted">{description}</p> : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
)

export const CardBody = ({ className, children }) => (
  <div className={cn('px-4 py-4 sm:px-5', className)}>{children}</div>
)

export const CardFooter = ({ className, children }) => (
  <div className={cn('border-t border-app-border px-4 py-3 sm:px-5', className)}>{children}</div>
)