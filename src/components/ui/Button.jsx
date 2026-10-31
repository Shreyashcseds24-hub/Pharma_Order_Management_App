import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/format'

const VARIANTS = {
  primary: 'neu-btn-primary',
  secondary: 'neu-btn text-brand-700',
  accent: 'neu-btn-accent',
  ghost: 'text-slate-600 hover:bg-white/50 hover:text-slate-900 active:shadow-inset-sm',
  danger: 'neu-btn-danger',
  subtle: 'neu-btn-inset',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
}

export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    type,
    ...props
  },
  ref,
) {
  const isNativeButton = Component === 'button'
  return (
    <Component
      ref={ref}
      type={isNativeButton ? (type ?? 'button') : undefined}
      disabled={isNativeButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-[0.95rem] font-semibold whitespace-nowrap',
        'transition-[color,background-color,box-shadow,transform,filter] duration-200',
        'disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
      {IconRight && !loading ? <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </Component>
  )
})

export default Button
