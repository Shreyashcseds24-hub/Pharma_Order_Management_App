import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FlaskConical, LogIn, ShieldCheck } from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Form'
import { DemoBanner } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DEMO_ACCOUNTS, login, sessionStore } from '../services/authService'
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../data/constants'
import { cn } from '../utils/format'
import { tokenStore } from '../services/api'

export const Login = () => {
  const [role, setRole] = useState(ROLES.ADMIN)
  const [form, setForm] = useState({ email: DEMO_ACCOUNTS[0].email, password: DEMO_ACCOUNTS[0].password })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  if (sessionStore.get()) return <Navigate to="/dashboard" replace />

  const chooseRole = (nextRole) => {
    const account = DEMO_ACCOUNTS.find((a) => a.user.role === nextRole)
    setRole(nextRole)
    setForm({ email: account.email, password: account.password })
    setErrors({})
    setApiError(null)
  }

  const validate = () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const session = await login({ ...form, role })
      sessionStore.set(session)
      tokenStore.set(session.token)
      toast(`Signed in as ${ROLE_LABELS[role]}. Demo session active.`, { type: 'success' })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setApiError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Helmet title="Sign in" description="Sign in to MediFlow AI pharma order management." />
      <h1 className="text-2xl font-semibold text-slate-900">Sign in to MediFlow AI</h1>
      <p className="mt-1.5 text-sm text-app-muted">
        Access your pharmacy distribution workspace.
      </p>

      <DemoBanner icon={FlaskConical} className="mt-5">
        <strong className="font-semibold">Development-only role switcher.</strong> Choose a role to
        load a prefilled sample account. Role checks here only affect what the UI renders - they are
        not a security boundary.
      </DemoBanner>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <fieldset>
          <legend className="text-xs font-medium text-slate-700">Sign in as</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {Object.values(ROLES).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => chooseRole(r)}
                aria-pressed={role === r}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-xs font-medium transition',
                  role === r
                    ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                    : 'border-app-border bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-app-muted">{ROLE_DESCRIPTIONS[role]}</p>
        </fieldset>

        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {apiError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {apiError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} icon={LogIn} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-app-border bg-slate-50 px-3.5 py-3">
        <p className="flex items-center gap-2 text-xs text-app-muted">
          <ShieldCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
          Sessions are stubbed in the frontend until the Flask API is connected.
        </p>
        <Link to="/register" className="text-xs font-medium text-brand-700 underline underline-offset-2">
          Register
        </Link>
      </div>
    </div>
  )
}

export default Login