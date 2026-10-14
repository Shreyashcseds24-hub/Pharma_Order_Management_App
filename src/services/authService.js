import api, { simulateLatency, withFallback } from './api'
import { demoUsers } from '../data/mockData'

export const SESSION_KEY = 'mediflow.session'

export const sessionStore = {
  get() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  set(session) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* storage unavailable (private mode) - ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  },
}

/**
 * Demo credentials for the frontend-only role switcher.
 * These are sample values for local development. Real authentication and
 * authorization must be enforced by the Flask backend.
 */
export const DEMO_ACCOUNTS = [
  { email: 'admin@mediflow.demo', password: 'admin123', user: demoUsers[0] },
  { email: 'distributor@mediflow.demo', password: 'distributor123', user: demoUsers[1] },
  { email: 'retailer@mediflow.demo', password: 'retailer123', user: demoUsers[2] },
]

const reject = (message, status) =>
  Promise.reject(Object.assign(new Error(message), { name: 'ApiError', status }))

export const login = async ({ email, password, role }) =>
  withFallback(
    async () => {
      const account = DEMO_ACCOUNTS.find((a) => a.email === email)
      if (!account) await reject('No demo account exists for this email.', 404)
      if (account.password !== password) await reject('Incorrect password for the demo account.', 401)
      if (account.user.role !== role) {
        await reject(`This demo account is registered as a ${account.user.role}.`, 403)
      }
      return simulateLatency(
        { user: account.user, token: `demo-token-${account.user.id}`, issuedAt: Date.now() },
        550,
      )
    },
    async () => {
      const { data } = await api.post('/auth/login', { email, password, role })
      return data
    },
  )

export const register = async (payload) =>
  withFallback(
    async () => {
      const initials = payload.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
      return simulateLatency(
        {
          user: {
            id: `USR-DEMO-${Date.now()}`,
            name: payload.name,
            email: payload.email,
            role: payload.role,
            title: payload.organisation || 'Team member',
            initials,
            permissions:
              payload.role === 'retailer' ? ['orders:create', 'reports:view'] : ['reports:view'],
          },
          token: `demo-token-${Date.now()}`,
          issuedAt: Date.now(),
        },
        600,
      )
    },
    async () => {
      const { data } = await api.post('/auth/register', payload)
      return data
    },
  )

export const logout = () =>
  withFallback(
    async () => {
      await simulateLatency({ ok: true }, 150)
    },
    async () => {
      await api.post('/auth/logout')
    },
  )

export const fetchProfile = () =>
  withFallback(
    async () => simulateLatency({ user: sessionStore.get()?.user ?? null }, 200),
    async () => {
      const { data } = await api.get('/auth/profile')
      return data
    },
  )

const authService = { login, register, logout, fetchProfile, sessionStore, DEMO_ACCOUNTS }
export default authService