export const AXIS_PROPS = {
  stroke: '#94a3b8',
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
}

export const GRID_PROPS = {
  stroke: '#e3e8f0',
  strokeDasharray: '3 3',
  vertical: false,
}

export const SERIES_COLORS = {
  brand: '#174ea6',
  brandSoft: '#85acee',
  accent: '#0d9488',
  accentSoft: '#5fd7c4',
  amber: '#d97706',
  red: '#dc2626',
  green: '#059669',
  slate: '#94a3b8',
}

export const currencyTooltip = {
  formatter: (value) => [`INR ${Number(value).toLocaleString('en-IN')}`, ''],
}

export const compactCurrency = (value) => {
  const n = Number(value) || 0
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(2)}L`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e3e8f0',
    boxShadow: '0 8px 20px -8px rgba(15,23,42,0.18)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: '#0f172a', fontWeight: 600, marginBottom: 4 },
}
