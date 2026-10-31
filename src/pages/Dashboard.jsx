import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarClock,
  PackageCheck,
  Pill,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { DataTable } from '../components/tables/DataTable'
import { AXIS_PROPS, GRID_PROPS, SERIES_COLORS, compactCurrency, tooltipStyle } from '../components/charts/chartTheme'
import { useAsync } from '../hooks/useAsync'
import { getDashboardData } from '../services/analyticsService'
import { useAuth } from '../context/AuthContext'
import { cn, formatCurrency, formatDate, formatNumber, relativeTime } from '../utils/format'

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
]

const SalesChart = ({ series, range, onRangeChange, loading }) => {
  const data = series?.[range] ?? []
  const view = data.map((row) => ({
    ...row,
    label: new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  }))
  const tickInterval = range === '90d' ? 14 : range === '30d' ? 4 : 0

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Sales and order activity"
        description="Revenue and order volume across the selected range"
        icon={TrendingUp}
        action={
          <div
            className="neu-segmented flex rounded-xl p-1"
            role="group"
            aria-label="Select time range"
          >
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onRangeChange(r.key)}
                aria-pressed={range === r.key}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500"
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      <CardBody className="flex-1">
        {loading ? (
          <Skeleton className="h-[248px] w-full" />
        ) : view.length === 0 ? (
          <EmptyState compact title="No activity in this range" description="Sales data will appear once orders are placed." />
        ) : (
          <div style={{ height: 248 }}>
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart data={view} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS.brand} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={SERIES_COLORS.brand} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} interval={tickInterval} />
                <YAxis
                  {...AXIS_PROPS}
                  width={48}
                  tickFormatter={compactCurrency}
                  yAxisId="revenue"
                />
                <YAxis {...AXIS_PROPS} width={30} yAxisId="orders" orientation="right" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) =>
                    name === 'Revenue' ? [formatCurrency(value), 'Revenue'] : [formatNumber(value), 'Orders']
                  }
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 12, color: '#64748b' }}
                />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={SERIES_COLORS.brand}
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
                <Bar yAxisId="orders" type="column" dataKey="orders" name="Orders" fill={SERIES_COLORS.accent} radius={[3, 3, 0, 0]} barSize={range === '90d' ? 6 : 14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

const StockBar = ({ quantity, reorderLevel }) => {
  const ceiling = Math.max(reorderLevel * 2, quantity, 1)
  const pct = Math.min(100, Math.round((quantity / ceiling) * 100))
  const reorderPct = Math.min(100, Math.round((reorderLevel / ceiling) * 100))
  const tone = quantity <= reorderLevel ? 'bg-red-500' : quantity <= reorderLevel * 1.5 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="neu-track h-2 w-full overflow-hidden rounded-full">
      <div className="relative h-full rounded-full">
        <div
          className={cn('h-full rounded-full shadow-[0_1px_2px_rgba(64,91,122,0.25)]', tone)}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-slate-500/70"
          style={{ left: `${reorderPct}%` }}
          aria-hidden="true"
          title={`Reorder level ${reorderLevel}`}
        />
      </div>
    </div>
  )
}

const LowStockList = ({ items, loading }) => (
  <Card className="flex h-full flex-col">
    <CardHeader
      title="Low-stock medicines"
      description="At or below the configured reorder level"
      icon={AlertTriangle}
      action={
        <Link
          to="/inventory?status=low"
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          View all
        </Link>
      }
    />
    <CardBody className="flex-1 space-y-4">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
      ) : items.length === 0 ? (
        <EmptyState compact title="No low-stock items" description="Every tracked medicine is above its reorder level." />
      ) : (
        items.map((item) => (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                <p className="text-xs text-app-muted">{item.brand}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-800">{formatNumber(item.quantity)}</p>
                <p className="text-[11px] text-app-muted">reorder at {formatNumber(item.reorderLevel)}</p>
              </div>
            </div>
            <StockBar quantity={item.quantity} reorderLevel={item.reorderLevel} />
          </div>
        ))
      )}
    </CardBody>
  </Card>
)

const InsightsPanel = ({ insights, loading }) => (
  <Card className="flex h-full flex-col">
    <CardHeader
      title="AI inventory insights"
      description="Replenishment suggestions and stockout risk"
      icon={Sparkles}
      action={
        <Link to="/ai-insights" className="text-xs font-medium text-brand-700 hover:underline">
          Open insights
        </Link>
      }
    />
    <CardBody className="flex-1 space-y-4">
      {loading ? (
        <>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </>
      ) : (
        <>
          <ul className="space-y-3">
            {insights.recommendations.map((rec) => (
              <li key={rec.id} className="neu-inset-sm rounded-2xl border border-white/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-soft',
                      rec.urgency === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : rec.urgency === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-brand-100 text-brand-700',
                    )}
                  >
                    +{formatNumber(rec.suggestedQuantity)} units
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-app-muted">{rec.reason}</p>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Stockout risk
            </p>
            <ul className="space-y-1.5">
              {insights.stockoutRisk.map((risk) => (
                <li
                  key={risk.medicineId}
                  className="neu-inset-sm flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                >
                  <span className="truncate text-sm text-slate-700">{risk.name}</span>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold',
                      risk.risk === 'critical'
                        ? 'text-red-700'
                        : risk.risk === 'high'
                          ? 'text-amber-700'
                          : 'text-slate-600',
                    )}
                  >
                    {risk.daysToStockout}d cover
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">{insights.disclaimer}</p>
        </>
      )}
    </CardBody>
  </Card>
)

const ActivityFeed = ({ items, loading }) => {
  const ICONS = {
    order: ShoppingCart,
    inventory: Boxes,
    approval: PackageCheck,
    alert: AlertTriangle,
  }
  const TONE = {
    order: 'bg-brand-50 text-brand-600',
    inventory: 'bg-accent-50 text-accent-600',
    approval: 'bg-emerald-50 text-emerald-600',
    alert: 'bg-amber-50 text-amber-600',
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Recent activity" description="Latest order and inventory events" icon={Activity} />
      <CardBody className="flex-1">
        {loading ? (
          <ul className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState compact title="No recent activity" description="Events will appear here as orders move." />
        ) : (
          <ol className="relative space-y-4">
            {items.map((item, index) => {
              const Icon = ICONS[item.type] ?? Activity
              return (
                <li key={item.id} className="relative flex gap-3">
                  {index < items.length - 1 ? (
                    <span className="absolute top-8 left-4 h-full w-px bg-app-border" aria-hidden="true" />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      TONE[item.type] ?? TONE.order,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-app-muted">{item.detail}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {relativeTime(item.time)} &middot; {item.actor}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}

const RECENT_COLUMNS = [
  {
    key: 'id',
    header: 'Order ID',
    render: (row) => (
      <Link to={`/orders?open=${row.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
        {row.id}
      </Link>
    ),
  },
  { key: 'retailer', header: 'Retailer', render: (row) => <span className="text-slate-700">{row.retailer}</span> },
  { key: 'orderDate', header: 'Order date', render: (row) => formatDate(row.orderDate) },
  {
    key: 'totalAmount',
    header: 'Amount',
    align: 'right',
    render: (row) => <span className="font-medium text-slate-800">{formatCurrency(row.totalAmount)}</span>,
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} size="sm" /> },
]

export const Dashboard = () => {
  const { user } = useAuth()
  const [range, setRange] = useState('30d')
  const { data, loading, error, reload } = useAsync(() => getDashboardData(), [])

  const stats = data?.stats

  const roleHint = useMemo(() => {
    if (user?.role === 'retailer') return 'Your pharmacy purchasing snapshot'
    if (user?.role === 'distributor') return 'Distribution performance snapshot'
    return 'Network-wide operations snapshot'
  }, [user?.role])

  return (
    <div className="space-y-5">
      <Helmet title="Dashboard" description="Overview of medicines, orders, stock risk and AI insights." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Operations overview
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">{roleHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button as={Link} to="/orders" variant="secondary" size="sm" icon={ShoppingCart}>
            View orders
          </Button>
          {user?.role !== 'retailer' ? (
            <Button as={Link} to="/inventory" variant="secondary" size="sm" icon={Boxes}>
              Manage inventory
            </Button>
          ) : null}
        </div>
      </div>

      <DemoBanner icon={Sparkles}>
        All figures below come from the local sample dataset (VITE_USE_MOCK_API=true). AI items are
        heuristic demo outputs, not a trained model.
      </DemoBanner>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total medicines"
          value={stats?.totalMedicines ?? 0}
          icon={Pill}
          tone="brand"
          loading={loading}
          hint="Active catalog SKUs"
        />
        <StatCard
          label="Pending orders"
          value={stats?.pendingOrders ?? 0}
          icon={ShoppingCart}
          tone="accent"
          loading={loading}
          hint="Awaiting approval"
        />
        <StatCard
          label="Low-stock medicines"
          value={stats?.lowStockMedicines ?? 0}
          icon={AlertTriangle}
          tone="warning"
          loading={loading}
          hint="At or below reorder level"
        />
        <StatCard
          label="Near-expiry batches"
          value={stats?.nearExpiryBatches ?? 0}
          icon={CalendarClock}
          tone="danger"
          loading={loading}
          hint="Expiring within 90 days"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesChart
            series={data?.sales}
            range={range}
            onRangeChange={setRange}
            loading={loading}
          />
        </div>
        <LowStockList items={data?.lowStock ?? []} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent orders"
            description="Latest retailer orders and their status"
            icon={ShoppingCart}
            action={
              <Link to="/orders" className="text-xs font-medium text-brand-700 hover:underline">
                View all orders
              </Link>
            }
          />
          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : (
            <DataTable
              columns={RECENT_COLUMNS}
              rows={data?.recentOrders ?? []}
              emptyIcon={ShoppingCart}
              emptyTitle="No orders yet"
              emptyDescription="Orders placed by retailers will appear here."
              mobileCard={(row) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{row.id}</p>
                    <StatusBadge status={row.status} size="sm" />
                  </div>
                  <p className="text-sm text-slate-700">{row.retailer}</p>
                  <div className="flex items-center justify-between text-xs text-app-muted">
                    <span>{formatDate(row.orderDate)}</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(row.totalAmount)}</span>
                  </div>
                </div>
              )}
            />
          )}
        </Card>

        <InsightsPanel insights={data?.insights ?? { recommendations: [], stockoutRisk: [] }} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ActivityFeed items={data?.activity ?? []} loading={loading} />
        <Card className="xl:col-span-2">
          <CardHeader
            title="Demand outlook"
            description="Forecast versus actual units issued"
            icon={TrendingUp}
            action={
              <Link to="/ai-insights" className="text-xs font-medium text-brand-700 hover:underline">
                Full analysis
              </Link>
            }
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[230px] w-full" />
            ) : (
              <div style={{ height: 230 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart
                    data={(data?.sales?.['30d'] ?? []).slice(-14).map((row) => ({
                      label: new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                      actual: row.units,
                      baseline: Math.round(row.units * 1.06),
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SERIES_COLORS.accent} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={SERIES_COLORS.accent} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="label" {...AXIS_PROPS} interval={3} />
                    <YAxis {...AXIS_PROPS} width={44} tickFormatter={compactCurrency} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        `${formatNumber(value)} units`,
                        name === 'actual' ? 'Issued' : 'Expected baseline',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="baseline"
                      name="baseline"
                      stroke={SERIES_COLORS.amber}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <Area type="monotone" dataKey="actual" name="actual" stroke={SERIES_COLORS.accent} strokeWidth={2} fill="url(#actualFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard