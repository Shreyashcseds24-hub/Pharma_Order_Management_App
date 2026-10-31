import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useDismiss'
import { cn } from '../../utils/format'

export const Drawer = ({ open, onClose, title, description, children, footer, width = 'max-w-xl' }) => {
  const panelRef = useRef(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-[#405b7a]/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col bg-app-bg shadow-floating',
          'rounded-l-[1.6rem] border-l border-white/50',
          'animate-[drawer-in_220ms_cubic-bezier(0.4,0,0.2,1)]',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-app-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-icon-btn h-8 w-8 shrink-0 rounded-lg"
            aria-label="Close panel"
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
      </aside>
    </div>,
    document.body,
  )
}

export default Drawer
