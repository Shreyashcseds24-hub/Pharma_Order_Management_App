import { cn } from '../../utils/format'

export const Card = ({ className, children, ...props }) => (
  <div className={cn('card', className)} {...props}>
    {children}
  </div>
)

export const CardHeader = ({ title, description, action, className, icon: Icon }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 border-b border-app-border/60 px-5 py-4',
      className,
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 rounded-xl bg-brand-50/90 p-2 text-brand-600 shadow-soft">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-app-muted">{description}</p> : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
)

export const CardBody = ({ className, children }) => (
  <div className={cn('px-5 py-4', className)}>{children}</div>
)

export const CardFooter = ({ className, children }) => (
  <div className={cn('border-t border-app-border/60 px-5 py-3', className)}>{children}</div>
)

export default Card
