import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarClock, Download, PackageSearch, TrendingUp, Warehouse } from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DataTable } from '../components/tables/DataTable'
import { AXIS_PROPS, GRID_PROPS, SERIES_COLORS, compactCurrency, tooltipStyle } from '../components/charts/chartTheme'
import { useAsync } from '../hooks/useAsync'
import { getReports } from '../services/analyticsService'
import { USE_MOCK_API } from '../services/api'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const PIE_COLORS = [
  SERIES_COLORS.brand,
  SERIES_COLORS.accent,
  SERIES_COLORS.amber,
  SERIES_COLORS.brandSoft,
  SERIES_COLORS.accentSoft,
  SERIES_COLORS.red,
  SERIES_COLORS.slate,
]

const KpiCard = ({ label, value, hint, icon: Icon, tone = 'text-brand-700', loading }) => (
  <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
    <div className="flex items-center gap-2.5 text-app-muted">
      <span className="rounded-xl bg-app-surface p-1.5 text-slate-500 shadow-soft">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{label}</p>
    </div>
    {loading ? (
      <Skeleton className="mt-2.5 h-7 w-24" />
    ) : (
      <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
    )}
    {hint ? <p className="mt-1 text-xs text-app-muted">{hint}</p> : null}
  </Card>
)

export const Reports = () => {
  const { toast } = useToast()
  const { data, loading, error, reload } = useAsync(() => getReports(), [])

  const topSellingRows = useMemo(() => (data?.topSelling ?? []).slice(0, 8), [data])

  const exportReport = () => {
    if (!data) return
    const header = ['Medicine', 'Brand', 'Category', 'Units', 'Revenue']
    const lines = data.topSelling.map((r) => [r.name, r.brand, r.category, r.units, r.revenue].join(','))
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mediflow-top-selling.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast(USE_MOCK_API ? 'Report exported as a demo CSV.' : 'Report exported as a CSV.', {
      type: 'success',
    })
  }

  return (
    <div className="space-y-4">
      <Helmet title="Reports" description="Sales trends, top sellers, valuation and expiry risk." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Analytics
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Reports and analytics
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            Sales, order volume, valuation, movement and expiry exposure.
          </p>
        </div>
        <Button variant="secondary" icon={Download} onClick={exportReport} disabled={!data}>
          Export CSV
        </Button>
      </div>

      <DemoBanner icon={TrendingUp}>
        Aggregates are computed in the browser from the sample dataset. In live mode the Flask API
        aggregates them from PostgreSQL.
      </DemoBanner>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Revenue (30d)"
          value={formatCurrency(data?.kpis.revenue30d ?? 0, { compact: true })}
          hint="Sum of daily revenue"
          icon={TrendingUp}
          loading={loading}
        />
        <KpiCard
          label="Orders (30d)"
          value={formatNumber(data?.kpis.orders30d ?? 0)}
          hint={`Avg ${formatCurrency(data?.kpis.avgOrderValue ?? 0, { compact: true })} per order`}
          icon={PackageSearch}
          tone="text-accent-700"
          loading={loading}
        />
        <KpiCard
          label="Inventory value"
          value={formatCurrency(data?.inventoryValuation.totalValue ?? 0, { compact: true })}
          hint={`${formatCurrency(data?.inventoryValuation.potentialMargin ?? 0, { compact: true })} potential margin`}
          icon={Warehouse}
          tone="text-amber-700"
          loading={loading}
        />
        <KpiCard
          label="Value at risk"
          value={formatCurrency(data?.expiryRisk.totalValueAtRisk ?? 0, { compact: true })}
          hint="Batches expiring within 120 days"
          icon={CalendarClock}
          tone="text-red-700"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales trends" description="Revenue and order volume over 90 days" icon={TrendingUp} />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <ComposedChart
                    data={(data?.salesTrend ?? []).map((r) => ({
                      ...r,
                      label: new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="label" {...AXIS_PROPS} interval={6} />
                    <YAxis
                      yAxisId="revenue"
                      {...AXIS_PROPS}
                      width={50}
                      tickFormatter={compactCurrency}
                    />
                    <YAxis yAxisId="orders" {...AXIS_PROPS} width={30} orientation="right" allowDecimals={false} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        name === 'revenue' ? formatCurrency(value, { compact: true }) : formatNumber(value),
                        name === 'revenue' ? 'Revenue' : 'Orders',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#718096' }}
                    />
                    <Line
                      yAxisId="revenue"
                      type="monotone"
                      dataKey="revenue"
                      name="revenue"
                      stroke={SERIES_COLORS.brand}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orders"
                      name="orders"
                      stroke={SERIES_COLORS.accent}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Order volume by status" description="Current order pipeline" icon={PackageSearch} />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart
                    data={data?.orderVolume ?? []}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
                    <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
                    <YAxis type="category" dataKey="status" {...AXIS_PROPS} width={78} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${v} orders`, 'Count']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                      {(data?.orderVolume ?? []).map((entry, index) => (
                        <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Top-selling medicines" description="By units issued in shipped and delivered orders" />
          {loading ? (
            <SkeletonTable rows={6} cols={4} />
          ) : topSellingRows.length === 0 ? (
            <EmptyState title="No sales recorded" description="Top sellers appear once orders are fulfilled." />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Medicine',
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-slate-800">{row.name}</p>
                      <p className="text-xs text-app-muted">{row.brand}</p>
                    </div>
                  ),
                },
                { key: 'category', header: 'Category', render: (row) => <span className="text-slate-600">{row.category}</span> },
                {
                  key: 'units',
                  header: 'Units',
                  align: 'right',
                  render: (row) => <span className="font-semibold text-slate-800">{formatNumber(row.units)}</span>,
                },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  align: 'right',
                  render: (row) => <span className="text-slate-700">{formatCurrency(row.revenue, { compact: true })}</span>,
                },
              ]}
              rows={topSellingRows}
              emptyIcon={PackageSearch}
              emptyTitle="No sales data"
              emptyDescription={
                USE_MOCK_API
                  ? 'Nothing has been issued in the demo dataset yet.'
                  : 'No medicines have been issued in this period yet.'
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Inventory valuation" description="Cost value by therapeutic category" icon={Warehouse} />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <>
                <div style={{ height: 210 }}>
                  <ResponsiveContainer height="100%" width="100%">
                    <PieChart>
                      <Pie
                        data={data?.inventoryValuation.categoryBreakdown ?? []}
                        dataKey="value"
                        nameKey="category"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {(data?.inventoryValuation.categoryBreakdown ?? []).map((entry, index) => (
                          <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) => [formatCurrency(v, { compact: true }), n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5 border-t border-app-border/50 pt-3">
                  {(data?.inventoryValuation.categoryBreakdown ?? []).slice(0, 5).map((entry, index) => (
                    <li key={entry.category} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-medium text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-[3px] shadow-[0_1px_2px_rgba(64,91,122,0.3)]"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          aria-hidden="true"
                        />
                        {entry.category}
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(entry.value, { compact: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Stock movement"
          description="Inbound receipts versus outbound issues (last 14 days)"
        />
        <CardBody>
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={(data?.stockMovement.series ?? []).map((r) => ({
                    ...r,
                    label: new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} interval={1} />
                  <YAxis {...AXIS_PROPS} width={46} tickFormatter={compactCurrency} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v, name) => [formatNumber(Math.abs(v)), name === 'inbound' ? 'Received' : 'Issued']}
                  />
                  <Bar dataKey="inbound" fill={SERIES_COLORS.accent} radius={[3, 3, 0, 0]} barSize={10} />
                  <Bar dataKey="outbound" fill={SERIES_COLORS.brand} radius={[3, 3, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Expiry-related inventory risk"
          description="Batches expiring within 120 days and the capital tied up in them"
          icon={CalendarClock}
        />
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : (data?.expiryRisk.rows ?? []).length === 0 ? (
          <EmptyState title="No expiry risk" description="No batch expires within the next 120 days." />
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Medicine',
                render: (row) => <span className="font-medium text-slate-800">{row.name}</span>,
              },
              { key: 'batchNumber', header: 'Batch', render: (row) => <span className="font-mono text-xs">{row.batchNumber}</span> },
              { key: 'quantity', header: 'Qty', align: 'right', render: (row) => formatNumber(row.quantity) },
              { key: 'expiryDate', header: 'Expiry', render: (row) => formatDate(row.expiryDate) },
              {
                key: 'daysToExpiry',
                header: 'Days left',
                align: 'right',
                render: (row) => (
                  <span
                    className={
                      row.daysToExpiry <= 30
                        ? 'rounded-full bg-red-50 px-2.5 py-0.5 font-bold text-red-700 shadow-soft'
                        : row.daysToExpiry <= 60
                          ? 'rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 shadow-soft'
                          : 'font-medium text-slate-700'
                    }
                  >
                    {row.daysToExpiry}
                  </span>
                ),
              },
              {
                key: 'costValue',
                header: 'Value at risk',
                align: 'right',
                render: (row) => <span className="text-slate-700">{formatCurrency(row.costValue, { compact: true })}</span>,
              },
            ]}
            rows={data.expiryRisk.rows.slice(0, 10)}
            emptyIcon={CalendarClock}
            emptyTitle="No expiry risk"
            emptyDescription="No batch expires within the next 120 days."
            mobileCard={(row) => (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                  <p className="font-mono text-xs text-app-muted">
                    {row.batchNumber} &middot; expires {formatDate(row.expiryDate)}
                  </p>
                  <p className="mt-1 text-xs text-app-muted">{formatNumber(row.quantity)} units</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-800">
                  {formatCurrency(row.costValue, { compact: true })}
                </p>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  )
}

export default Reports