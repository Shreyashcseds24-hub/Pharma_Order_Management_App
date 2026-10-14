import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FlaskConical, UserPlus } from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { DemoBanner } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { register, sessionStore } from '../services/authService'
import { ROLES, ROLE_LABELS } from '../data/constants'
import { tokenStore } from '../services/api'

const validate = (form) => {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Full name is required.'
  else if (form.name.trim().length < 3) errors.name = 'Enter at least 3 characters.'
  if (!form.email.trim()) errors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
  if (!form.organisation.trim()) errors.organisation = 'Organisation name is required.'
  if (!form.password) errors.password = 'Password is required.'
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

export const Register = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    organisation: '',
    role: ROLES.RETAILER,
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  if (sessionStore.get()) return <Navigate to="/dashboard" replace />

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setApiError(null)
    setSubmitting(true)
    try {
      const session = await register({
        name: form.name,
        email: form.email,
        organisation: form.organisation,
        role: form.role,
        password: form.password,
      })
      sessionStore.set(session)
      tokenStore.set(session.token)
      toast('Demo account created. No data was sent to a server.', { type: 'success' })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setApiError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Helmet title="Register" description="Create a MediFlow AI demo account." />
      <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-app-muted">
        Set up a workspace profile for your distribution business.
      </p>

      <DemoBanner icon={FlaskConical} className="mt-5">
        Registration runs entirely in the browser for now. Accounts created here are not persisted on
        any server.
      </DemoBanner>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Input
          label="Full name"
          name="name"
          required
          value={form.name}
          error={errors.name}
          onChange={update('name')}
          autoComplete="name"
        />
        <Input
          label="Work email"
          name="email"
          type="email"
          required
          value={form.email}
          error={errors.email}
          onChange={update('email')}
          autoComplete="email"
        />
        <Input
          label="Organisation"
          name="organisation"
          required
          value={form.organisation}
          error={errors.organisation}
          onChange={update('organisation')}
          placeholder="e.g. Sunrise Pharma Ltd."
        />
        <Select label="Role" name="role" value={form.role} onChange={update('role')} required>
          {Object.values(ROLES).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            name="password"
            type="password"
            required
            value={form.password}
            error={errors.password}
            onChange={update('password')}
            autoComplete="new-password"
            hint="Minimum 8 characters"
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            required
            value={form.confirmPassword}
            error={errors.confirmPassword}
            onChange={update('confirmPassword')}
            autoComplete="new-password"
          />
        </div>

        {apiError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {apiError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} icon={UserPlus} className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </div>
  )
}

export default Register