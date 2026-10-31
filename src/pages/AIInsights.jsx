import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  CalendarClock,
  Info,
  PackagePlus,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { AXIS_PROPS, GRID_PROPS, SERIES_COLORS, compactCurrency, tooltipStyle } from '../components/charts/chartTheme'
import { useAsync } from '../hooks/useAsync'
import { getAIInsights } from '../services/analyticsService'
import { useAuth } from '../context/AuthContext'
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from '../utils/format'

const URGENCY_TONES = {
  critical: 'bg-red-50 text-red-700 ring-red-200/70',
  high: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  medium: 'bg-brand-50 text-brand-700 ring-brand-200/70',
}

const HORIZONS = [
  { days: 7, label: 'Next 7 days' },
  { days: 30, label: 'Next 30 days' },
]

const RecommendationCard = ({ rec, onReorder }) => (
  <li className="neu-soft rounded-[1.25rem] border border-white/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{rec.title}</p>
        <p className="mt-1 text-xs text-app-muted">
          Stock {formatNumber(rec.currentStock)} units &middot; reorder level {formatNumber(rec.reorderLevel)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={rec.urgency === 'critical' ? 'danger' : rec.urgency === 'high' ? 'warning' : 'brand'}>
          {rec.urgency} priority
        </Badge>
      </div>
    </div>

    <p className="neu-inset-sm mt-3 rounded-xl border border-white/40 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
      {rec.reason}
    </p>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] text-app-muted uppercase">Suggested order</p>
          <p className="text-lg font-extrabold tracking-tight text-slate-900">+{formatNumber(rec.suggestedQuantity)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-[0.1em] text-app-muted uppercase">Confidence</p>
          <p className="text-sm font-bold text-slate-700">{formatPercent(rec.confidence)}</p>
        </div>
      </div>
      <Button size="sm" variant="secondary" icon={PackagePlus} onClick={() => onReorder(rec)}>
        Create purchase requisition
      </Button>
    </div>
  </li>
)

export const AIInsights = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [horizon, setHorizon] = useState(7)
  const { data, loading, error, reload } = useAsync(() => getAIInsights(horizon), [horizon])

  const demandChart = useMemo(
    () =>
      (data?.demandForecast ?? []).map((row) => ({
        label: row.label.replace(/\s+\d+\s*(mg|mcg|IU).*$/i, ''),
        predicted: row.predicted,
        actual: row.actual,
      })),
    [data],
  )

  const forecastChart = (data?.monthlyForecast ?? []).map((row) => ({
    period: row.period,
    actual: row.actual,
    predicted: row.predicted,
  }))

  const handleReorder = (rec) => {
    toast(
      `Requisition draft created for ${rec.suggestedQuantity} units of ${rec.title}. Purchase orders require the Flask backend.`,
      { type: 'info', title: 'Demo action' },
    )
  }

  return (
    <div className="space-y-4">
      <Helmet title="AI Insights" description="Demo demand forecasts and replenishment recommendations." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Intelligence
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            AI demand insights
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            Forecasts, replenishment suggestions and stockout exposure for the next {horizon} days.
          </p>
        </div>
        <div
          className="neu-segmented flex rounded-xl p-1"
          role="group"
          aria-label="Select forecast horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h.days}
              type="button"
              onClick={() => setHorizon(h.days)}
              aria-pressed={horizon === h.days}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500"
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <DemoBanner icon={Info}>
        <strong className="font-semibold">Demo predictions.</strong>{' '}
        {data?.disclaimer ?? 'These values are illustrative sample outputs, not generated by a trained forecasting model.'}
      </DemoBanner>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Forecast model', value: data?.model?.name ?? '-', icon: Sparkles, tone: 'text-brand-700' },
          { label: 'Model accuracy', value: data ? formatPercent(data.model.accuracy) : '-', icon: Target, tone: 'text-accent-700' },
          { label: 'Recommendations', value: data?.recommendations?.length ?? 0, icon: PackagePlus, tone: 'text-amber-700' },
          { label: 'Stockout warnings', value: data?.stockoutRisk?.length ?? 0, icon: ShieldAlert, tone: 'text-red-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
            <div className="flex items-center gap-2.5 text-app-muted">
              <span className="rounded-xl bg-app-surface p-1.5 text-slate-500 shadow-soft">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{label}</p>
            </div>
            {loading ? (
              <Skeleton className="mt-2.5 h-7 w-28" />
            ) : (
              <p className={`mt-1.5 truncate text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Predicted demand vs actual"
            description={`Units for the next ${horizon} days`}
            icon={Target}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={demandChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="label" {...AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis {...AXIS_PROPS} width={46} tickFormatter={compactCurrency} />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ fill: 'rgba(108,99,255,0.06)' }}
                      formatter={(value, name) => [
                        `${formatNumber(value)} units`,
                        name === 'predicted' ? 'Predicted demand' : 'Actual issued',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#718096' }}
                    />
                    <Bar dataKey="predicted" name="predicted" fill={SERIES_COLORS.brand} radius={[3, 3, 0, 0]} barSize={12} />
                    <Bar dataKey="actual" name="actual" fill={SERIES_COLORS.accent} radius={[3, 3, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Weekly demand outlook"
            description="Actual issues compared with predicted demand"
            icon={Sparkles}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={forecastChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="period" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} width={46} tickFormatter={compactCurrency} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        value === null || value === undefined ? 'Not yet observed' : `${formatNumber(value)} units`,
                        name === 'actual' ? 'Actual issued' : 'Predicted demand',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#718096' }}
                    />
                    <Line type="monotone" dataKey="actual" name="actual" stroke={SERIES_COLORS.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="predicted" stroke={SERIES_COLORS.brand} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Smart replenishment recommendations"
          description="Each suggestion explains the signal that produced it"
          icon={PackagePlus}
        />
        <CardBody>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : (data?.recommendations ?? []).length === 0 ? (
            <EmptyState
              title="No replenishment needed"
              description="Forecast demand is fully covered by current usable stock."
            />
          ) : (
            <ul className="space-y-3">
              {data.recommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} onReorder={handleReorder} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Stockout risk" description="Estimated days of cover remaining" icon={ShieldAlert} />
          <div className="divide-y divide-app-border/50">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (data?.stockoutRisk ?? []).length === 0 ? (
              <EmptyState compact title="No stockout risk detected" description="All tracked SKUs have adequate cover." />
            ) : (
              (data?.stockoutRisk ?? []).map((risk) => (
                <div
                  key={risk.medicineId}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{risk.name}</p>
                    <span
                      className={cn(
                        'mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                        URGENCY_TONES[risk.risk] ?? URGENCY_TONES.medium,
                      )}
                    >
                      {risk.risk} risk
                    </span>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-slate-800">
                    {risk.daysToStockout} days
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Near-expiry inventory warnings"
            description="Batches expiring within 90 days"
            icon={CalendarClock}
          />
          <div className="scroll-thin max-h-96 divide-y divide-app-border/50 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (data?.expiryRisk ?? []).length === 0 ? (
              <EmptyState compact title="No near-expiry batches" description="No batch expires within the next 90 days." />
            ) : (
              (data?.expiryRisk ?? []).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                    <p className="font-mono text-xs text-app-muted">
                      {row.batchNumber} &middot; {formatNumber(row.quantity)} units &middot;{' '}
                      {formatDate(row.expiryDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-soft',
                        row.daysLeft <= 30 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {row.daysLeft}d
                    </span>
                    <p className="mt-1 text-[11px] text-app-muted">{formatCurrency(row.valueAtRisk, { compact: true })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Model metadata</p>
            <p className="mt-0.5 text-xs text-app-muted">
              Reported for transparency only. Values describe the demo heuristic, not a production model.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            {[
              ['Model', data?.model?.name ?? '-'],
              ['Horizon', data ? `${data.model.horizonDays} days` : '-'],
              ['Sample size', data ? formatNumber(data.model.sampleSize) : '-'],
              ['Refreshed', data ? formatDate(data.model.trainedOn) : '-'],
            ].map(([label, value]) => (
              <div key={label} className="neu-inset-sm rounded-xl px-3 py-1.5">
                <dt className="text-[10px] font-bold tracking-[0.08em] text-app-muted uppercase">{label}</dt>
                <dd className="font-bold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
        <p className="px-4 pb-4 text-[11px] text-slate-400 sm:px-5">
          Signed in as {user?.name} ({user?.role}). Forecast visibility does not grant data access -
          the API must enforce permissions.
        </p>
      </Card>
    </div>
  )
}

export default AIInsights