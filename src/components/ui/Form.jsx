import { cn } from '../../utils/format'

export const Field = ({ label, htmlFor, hint, error, required, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
      {label}
      {required ? (
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
    {children}
    {error ? (
      <p className="text-xs font-medium text-red-600" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs text-app-muted">{hint}</p>
    ) : null}
  </div>
)

export const Input = ({ label, error, hint, required, id, className, icon: Icon, ...props }) => {
  const inputId = id ?? props.name
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn('input-base', Icon && 'pl-9')}
          {...props}
        />
      </div>
    </Field>
  )
}

export const Textarea = ({ label, error, hint, required, id, className, rows = 3, ...props }) => {
  const inputId = id ?? props.name
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={cn('input-base resize-y')}
        {...props}
      />
    </Field>
  )
}

export const Select = ({ label, error, hint, required, id, className, children, ...props }) => {
  const inputId = id ?? props.name
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        className={cn('input-base cursor-pointer pr-8')}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
}