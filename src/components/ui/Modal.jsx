import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useDismiss'
import { cn } from '../../utils/format'

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export const Modal = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  icon: Icon,
}) => {
  const panelRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-[#405b7a]/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'card relative z-10 my-0 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.6rem]',
          'animate-[modal-in_220ms_cubic-bezier(0.4,0,0.2,1)] sm:my-8 sm:rounded-[1.6rem]',
          WIDTHS[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border/60 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="rounded-xl bg-brand-50 text-brand-600 shadow-soft p-2">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-0.5 text-sm text-app-muted">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-icon-btn h-8 w-8 shrink-0 rounded-lg"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-border/60 bg-white/20 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
