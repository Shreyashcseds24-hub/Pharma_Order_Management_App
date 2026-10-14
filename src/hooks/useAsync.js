import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async loader and tracks { loading, error, data }.
 * Guards against setting state after unmount and supports manual reload.
 */
export const useAsync = (loader, deps = [], { immediate = true } = {}) => {
  const [state, setState] = useState({ loading: immediate, error: null, data: null })
  const mounted = useRef(true)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await loaderRef.current()
      if (mounted.current) setState({ loading: false, error: null, data })
    } catch (error) {
      if (mounted.current) {
        setState({ loading: false, error: error?.message || 'Something went wrong.', data: null })
      }
    }
  }, [])

  useEffect(() => {
    if (immediate) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...state, reload: run, setData: (data) => setState((p) => ({ ...p, data })) }
}