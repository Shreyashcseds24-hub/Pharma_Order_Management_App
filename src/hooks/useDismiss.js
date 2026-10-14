import { useEffect, useRef } from 'react'

/** Calls `handler` when a click lands outside the referenced element. */
export const useClickOutside = (ref, handler, active = true) => {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!active) return undefined
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handlerRef.current(event)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, active])
}

/** Traps Tab focus inside a container while it is open (dialogs and drawers). */
export const useFocusTrap = (ref, active = true) => {
  useEffect(() => {
    if (!active || !ref.current) return undefined

    const container = ref.current
    const previouslyFocused = document.activeElement

    const focusables = () =>
      Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)

    const focusFirst = () => {
      const [first] = focusables()
      first?.focus()
    }
    const timer = setTimeout(focusFirst, 20)

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)

    return () => {
      clearTimeout(timer)
      container.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [ref, active])
}