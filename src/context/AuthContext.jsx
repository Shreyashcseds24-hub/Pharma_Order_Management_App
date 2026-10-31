import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { sessionStore } from '../services/authService'
import { SESSION_EXPIRED_EVENT, tokenStore } from '../services/api'
import {
  canAdjustStock,
  canApproveOrders,
  canManageCatalog,
  canPlaceOrders,
  canViewReports,
} from '../utils/permissions'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const location = useLocation()
  const [session, setSession] = useState(() => sessionStore.get())

  // Re-read the stored session whenever the route changes so that a client-side
  // login (which does not remount this provider) is reflected immediately.
  useEffect(() => {
    setSession(sessionStore.get())
  }, [location.pathname])

  const user = session?.user ?? null

  // The API layer raises this event when a protected request returns 401, which
  // means the stored token is no longer valid (expired, revoked or wiped).
  useEffect(() => {
    const onExpired = () => {
      sessionStore.clear()
      tokenStore.clear()
      setSession(null)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const signOut = useCallback(async () => {
    sessionStore.clear()
    tokenStore.clear()
    setSession(null)
    window.location.href = '/login'
  }, [])

  const updateSession = useCallback((nextSession) => {
    if (nextSession) sessionStore.set(nextSession)
    else sessionStore.clear()
    setSession(nextSession)
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      token: session?.token ?? null,
      signOut,
      updateSession,
      permissions: {
        manageCatalog: canManageCatalog(user),
        adjustStock: canAdjustStock(user),
        approveOrders: canApproveOrders(user),
        placeOrders: canPlaceOrders(user),
        viewReports: canViewReports(user),
      },
    }),
    [user, session, signOut, updateSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}