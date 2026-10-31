export const AXIS_PROPS = {
  stroke: '#bcc7d6',
  tick: { fill: '#718096', fontSize: 11, fontWeight: 500 },
  tickLine: false,
}

export const GRID_PROPS = {
  stroke: '#d3dae5',
  strokeDasharray: '4 6',
  vertical: false,
}

export const SERIES_COLORS = {
  brand: '#6c63ff',
  brandSoft: '#b7b1ff',
  accent: '#3a8870',
  accentSoft: '#8acdb7',
  amber: '#b98a45',
  red: '#c45f69',
  green: '#4fa98c',
  slate: '#9aa9bd',
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
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.7)',
    background: '#e8ecf2',
    boxShadow:
      '-6px -6px 14px rgba(255,255,255,0.8), 10px 10px 24px rgba(163,177,198,0.45)',
    fontSize: 12,
    padding: '10px 12px',
    color: '#405b7a',
  },
  labelStyle: { color: '#405b7a', fontWeight: 700, marginBottom: 4 },
}
