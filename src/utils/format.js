/** Small class-name joiner (no clsx dependency needed). */
export const cn = (...values) =>
  values
    .flat()
    .filter(Boolean)
    .join(' ')

export const formatCurrency = (value, { compact = false } = {}) => {
  const amount = Number(value) || 0
  if (compact && Math.abs(amount) >= 100000) {
    return `INR ${(amount / 100000).toFixed(2)} L`
  }
  if (compact && Math.abs(amount) >= 1000) {
    return `INR ${(amount / 1000).toFixed(1)} K`
  }
  return `INR ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export const formatNumber = (value) => (Number(value) || 0).toLocaleString('en-IN')

export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

export const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${formatDate(value)}, ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export const daysBetween = (date) =>
  Math.round((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

export const relativeTime = (value) => {
  const diffDays = daysBetween(value)
  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  return `in ${diffDays} days`
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const isoPlusDays = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}