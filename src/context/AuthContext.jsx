import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { sessionStore } from '../services/authService'
import { tokenStore } from '../services/api'
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

  const signOut = useCallback(async () => {
    sessionStore.clear()
    tokenStore.clear()
    setSession(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      token: session?.token ?? null,
      signOut,
      permissions: {
        manageCatalog: canManageCatalog(user),
        adjustStock: canAdjustStock(user),
        approveOrders: canApproveOrders(user),
        placeOrders: canPlaceOrders(user),
        viewReports: canViewReports(user),
      },
    }),
    [user, session, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}