import axios from 'axios'

/**
 * Centralised Axios instance for the future Flask REST API.
 *
 * Every request goes through here so that:
 *  - the base URL is configured only through VITE_API_BASE_URL
 *  - auth tokens are attached centrally (from the stored session)
 *  - errors are normalised into a single shape for the UI
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const TOKEN_KEY = 'mediflow.token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable (private mode) - ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('The request timed out. Please try again.', 408))
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError('Unable to reach the API server. Check your connection and try again.', 0),
      )
    }
    const { status, data } = error.response
    const message =
      data?.message || data?.error || `Request failed with status ${status}.`
    return Promise.reject(new ApiError(message, status, data?.errors))
  },
)

/**
 * Resolves `mockFn()` when running in demo mode, otherwise performs `request`.
 * Keeps every page free of `if (mock)` branches.
 */
export const withFallback = (mockFn, request) =>
  USE_MOCK_API ? Promise.resolve().then(mockFn) : request()

/** Small artificial latency so loading/skeleton states are exercised in demo mode. */
export const simulateLatency = (value, ms = 420) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

export default api