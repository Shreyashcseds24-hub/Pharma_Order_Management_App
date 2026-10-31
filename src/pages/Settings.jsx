import { useState } from 'react'
import {
  Bell,
  Database,
  FlaskConical,
  Info,
  Lock,
  Mail,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { DemoBanner } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL, USE_MOCK_API } from '../services/api'
import { changePassword, sessionStore, updateProfile } from '../services/authService'
import { ROLE_LABELS } from '../data/constants'
import { formatDate } from '../utils/format'

const PERMISSION_MATRIX = [
  { label: 'View catalog', roles: ['admin', 'distributor', 'retailer'] },
  { label: 'Create / edit medicines', roles: ['admin', 'distributor'] },
  { label: 'Adjust stock and batches', roles: ['admin', 'distributor'] },
  { label: 'Approve or reject orders', roles: ['admin', 'distributor'] },
  { label: 'Create orders', roles: ['admin', 'distributor', 'retailer'] },
  { label: 'View invoices and reports', roles: ['admin', 'distributor'] },
  { label: 'Manage users and settings', roles: ['admin'] },
]

const EmailRow = ({ label, id, type, value, onChange, disabled }) => (
  <Input
    label={label}
    name={id}
    id={id}
    type={type}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
)

export const Settings = () => {
  const { user, updateSession } = useAuth()
  const { toast } = useToast()
  const [refreshedOn] = useState(() => formatDate(new Date().toISOString()))
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    title: user?.title ?? '',
  })
  const [prefs, setPrefs] = useState({
    lowStockAlerts: true,
    expiryAlerts: true,
    orderUpdates: true,
    weeklyDigest: false,
    expiryWindow: '90',
    forecastHorizon: '7',
    currency: 'INR',
  })
  const [confirmPassword, setConfirmPassword] = useState(null)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordErrors, setPasswordErrors] = useState({})

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!profile.name.trim()) {
      toast('Enter your full name.', { type: 'warning' })
      return
    }
    setSavingProfile(true)
    try {
      const { user: updated } = await updateProfile({
        name: profile.name.trim(),
        title: profile.title.trim(),
      })
      const session = sessionStore.get()
      updateSession({ ...(session ?? {}), user: updated })
      setProfile({ name: updated.name, email: updated.email, title: updated.title })
      toast(USE_MOCK_API ? 'Profile updated for this demo session.' : 'Profile updated.', {
        type: 'success',
      })
    } catch (error) {
      toast(error.message, { type: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!passwordForm.current) errors.current = 'Enter your current password.'
    if (passwordForm.next.length < 8) errors.next = 'Use at least 8 characters.'
    if (passwordForm.next !== passwordForm.confirm) errors.confirm = 'Passwords do not match.'
    setPasswordErrors(errors)
    if (Object.keys(errors).length) return

    setSavingPassword(true)
    try {
      await changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      })
      setConfirmPassword(null)
      setPasswordForm({ current: '', next: '', confirm: '' })
      toast('Password updated.', { type: 'success' })
    } catch (error) {
      if (error.details && typeof error.details === 'object') {
        setPasswordErrors({
          current: error.details.current,
          next: error.details.next,
        })
      }
      toast(error.message, { type: 'error' })
    } finally {
      setSavingPassword(false)
    }
  }

  const toggle = (key) => (event) => setPrefs({ ...prefs, [key]: event.target.checked })

  return (
    <div className="space-y-4">
      <Helmet title="Settings" description="Profile, notifications, permissions and API configuration." />

      <div>
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
          Workspace
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-0.5 text-sm text-app-muted">
          Workspace preferences, your role permissions and backend configuration.
        </p>
      </div>

      <DemoBanner icon={ShieldCheck}>
        Every control on this page is a frontend-only demonstration. Role enforcement and persistence
        must be implemented and validated in the Flask API - never trusted from the browser.
      </DemoBanner>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Profile" description="How your account appears in the workspace" icon={UserCog} />
            <CardBody>
              <form onSubmit={saveProfile} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full name"
                    name="name"
                    required
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                  <EmailRow
                    label="Email"
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    onChange={() => {}}
                  />
                  <Input
                    label="Job title"
                    name="title"
                    value={profile.title}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    className="sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" icon={Save} size="sm" loading={savingProfile}>
                    Save profile
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notifications and alerts" description="Choose which events raise a toast or alert" icon={Bell} />
            <CardBody className="space-y-4">
              <div className="divide-y divide-app-border/50">
                {[
                  { key: 'lowStockAlerts', label: 'Low-stock alerts', hint: 'Notify when a SKU falls to its reorder level' },
                  { key: 'expiryAlerts', label: 'Near-expiry alerts', hint: 'Notify when a batch enters the expiry window' },
                  { key: 'orderUpdates', label: 'Order status updates', hint: 'Notify on approval, dispatch and delivery' },
                  { key: 'weeklyDigest', label: 'Weekly AI digest', hint: 'Summary of forecast-driven recommendations' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between gap-4 py-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                      <span className="block text-xs text-app-muted">{item.hint}</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={prefs[item.key]}
                      onChange={toggle(item.key)}
                      className="neu-toggle"
                      aria-label={item.label}
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Expiry alert window"
                  name="expiryWindow"
                  value={prefs.expiryWindow}
                  onChange={(e) => setPrefs({ ...prefs, expiryWindow: e.target.value })}
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                </Select>
                <Select
                  label="Default forecast horizon"
                  name="forecastHorizon"
                  value={prefs.forecastHorizon}
                  onChange={(e) => setPrefs({ ...prefs, forecastHorizon: e.target.value })}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </Select>
                <Select
                  label="Display currency"
                  name="currency"
                  value={prefs.currency}
                  onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
                >
                  <option value="INR">INR (Indian Rupee)</option>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button icon={Save} size="sm" onClick={() => toast('Notification preferences saved for this session.', { type: 'success' })}>
                  Save preferences
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Security" description="Password and access management" icon={Lock} />
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Password</p>
                  <p className="text-xs text-app-muted">
                    {USE_MOCK_API
                      ? 'Demo accounts are validated in the browser.'
                      : 'Passwords are hashed and verified by the Flask API.'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={SlidersHorizontal}
                  onClick={() => {
                    setPasswordErrors({})
                    setConfirmPassword(true)
                  }}
                >
                  Change password
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Your access" description="Effective permissions for the selected role" icon={ShieldCheck} />
            <CardBody>
              <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-app-surface/60 p-3.5 shadow-inset-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-raised">
                  {user?.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                  <p className="truncate text-xs text-app-muted">{user?.title}</p>
                </div>
              </div>
              <div className="mt-3">
                <StatusBadge status="Healthy" size="sm" className="hidden" />
                <Badge tone="brand" size="sm">
                  {ROLE_LABELS[user?.role]} account
                </Badge>
              </div>

              <ul className="mt-4 space-y-2">
                {PERMISSION_MATRIX.map((row) => {
                  const granted = row.roles.includes(user?.role)
                  return (
                    <li key={row.label} className="flex items-center justify-between gap-3 text-xs">
                      <span className={granted ? 'text-slate-700' : 'text-slate-400'}>{row.label}</span>
                      <span
                        className={
                          granted
                            ? 'shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-200/60 ring-inset'
                            : 'shrink-0 rounded-full bg-slate-100/80 px-2.5 py-0.5 font-semibold text-slate-500 ring-1 ring-slate-200/60 ring-inset'
                        }
                      >
                        {granted ? 'Allowed' : 'Not allowed'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
                {USE_MOCK_API
                  ? 'This table reflects the demo role switcher only. It is not an access control mechanism.'
                  : 'The Flask API re-checks these permissions on every request; the UI only hides actions.'}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Backend configuration" description="Environment-driven API settings" icon={Server} />
            <CardBody className="space-y-3">
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-app-muted">
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    API base URL
                  </dt>
                  <dd className="truncate font-mono text-slate-700">{API_BASE_URL}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-app-muted">
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                    Data source
                  </dt>
                  <dd>
                    <Badge tone={USE_MOCK_API ? 'warning' : 'success'} size="sm">
                      {USE_MOCK_API ? 'Mock data' : 'Live API'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-app-muted">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Session user
                  </dt>
                  <dd className="truncate text-slate-700">{user?.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-app-muted">Data last refreshed</dt>
                  <dd className="text-slate-700">{refreshedOn}</dd>
                </div>
              </dl>
              <p className="flex items-start gap-2 rounded-xl bg-app-surface/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 shadow-inset-sm">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                Set <span className="font-mono">VITE_USE_MOCK_API=false</span> in your .env file to route
                every service call to the Flask API. No credentials are stored in this repository.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(confirmPassword)}
        onClose={() => setConfirmPassword(null)}
        title="Change password"
        description={
          USE_MOCK_API
            ? 'Demo password changes are not sent to a server.'
            : 'Your new password is hashed and stored by the Flask API.'
        }
        icon={Lock}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPassword(null)}>
              Cancel
            </Button>
            <Button form="password-form" type="submit" loading={savingPassword}>
              Update password
            </Button>
          </>
        }
      >
        <form id="password-form" onSubmit={savePassword} noValidate className="space-y-4">
          <Input
            label="Current password"
            name="current"
            type="password"
            required
            autoComplete="current-password"
            value={passwordForm.current}
            error={passwordErrors.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
          />
          <Input
            label="New password"
            name="next"
            type="password"
            required
            autoComplete="new-password"
            value={passwordForm.next}
            error={passwordErrors.next}
            onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
            hint="Minimum 8 characters"
          />
          <Input
            label="Confirm new password"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={passwordForm.confirm}
            error={passwordErrors.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  )
}

export default Settings