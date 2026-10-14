import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { AuthLayout } from './layout/AuthLayout'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/States'
import { SkeletonCards, SkeletonTable } from './components/ui/Skeleton'
import { useAuth } from './context/AuthContext'
import { sessionStore } from './services/authService'
import { navItemsForRole } from './layout/navConfig'
import Login from './pages/Login'
import Register from './pages/Register'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Medicines = lazy(() => import('./pages/Medicines'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Orders = lazy(() => import('./pages/Orders'))
const AIInsights = lazy(() => import('./pages/AIInsights'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))

const PageFallback = () => (
  <div className="space-y-4">
    <SkeletonCards />
    <div className="card">
      <SkeletonTable rows={6} cols={5} />
    </div>
  </div>
)

const RequireAuth = ({ children }) => {
  const location = useLocation()
  if (!sessionStore.get()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

const RoleGate = ({ children }) => {
  const { user } = useAuth()
  const location = useLocation()
  const allowed = navItemsForRole(user?.role).some((item) => item.to === location.pathname)

  if (!allowed) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Not available for your role"
        description="This module is restricted in the demo role switcher. The Flask API must enforce the same rules server-side."
        action={
          <Button as={Link} to="/dashboard">
            Back to dashboard
          </Button>
        }
      />
    )
  }
  return children
}

const NotFound = () => (
  <EmptyState
    icon={AlertTriangle}
    title="Page not found"
    description="The page you requested does not exist in MediFlow AI."
    action={
      <Button as={Link} to="/dashboard">
        Back to dashboard
      </Button>
    }
  />
)

const App = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Route>

    <Route
      element={
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      }
    >
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route
        path="/medicines"
        element={
          <RoleGate>
            <Medicines />
          </RoleGate>
        }
      />
      <Route
        path="/inventory"
        element={
          <RoleGate>
            <Inventory />
          </RoleGate>
        }
      />
      <Route
        path="/orders"
        element={
          <RoleGate>
            <Orders />
          </RoleGate>
        }
      />
      <Route
        path="/ai-insights"
        element={
          <RoleGate>
            <AIInsights />
          </RoleGate>
        }
      />
      <Route
        path="/invoices"
        element={
          <RoleGate>
            <Invoices />
          </RoleGate>
        }
      />
      <Route
        path="/reports"
        element={
          <RoleGate>
            <Reports />
          </RoleGate>
        }
      />
      <Route
        path="/settings"
        element={
          <RoleGate>
            <Settings />
          </RoleGate>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Route>
    </Routes>
  </Suspense>
)

export default App