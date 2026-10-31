import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Download,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DataTable } from '../components/tables/DataTable'
import { useAsync } from '../hooks/useAsync'
import { useDebounce } from '../hooks/useDebounce'
import { adjustStock, listInventory } from '../services/inventoryService'
import { useAuth } from '../context/AuthContext'
import { USE_MOCK_API } from '../services/api'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const PAGE_SIZE = 10
const STATUS_OPTIONS = ['Healthy', 'Low stock', 'Near expiry', 'Out of stock']

const STATUS_FILTERS = {
  low: 'Low stock',
  'near-expiry': 'Near expiry',
  healthy: 'Healthy',
}

const MOVEMENT_TYPES = ['Goods receipt', 'Stock count correction', 'Damaged units', 'Return to supplier', 'Expiry write-off']

export const Inventory = () => {
  const { user, permissions } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [status, setStatus] = useState(STATUS_FILTERS[searchParams.get('status')] ?? 'all')
  const [supplier, setSupplier] = useState('all')
  const [expiry, setExpiry] = useState('all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'medicine', direction: 'asc' })

  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ direction: 'add', quantity: '', reason: MOVEMENT_TYPES[0] })
  const [adjustErrors, setAdjustErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const debouncedSearch = useDebounce(search, 200)
  const { data: rows, loading, error, reload } = useAsync(() => listInventory(), [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== search) setSearch(q)
    const s = searchParams.get('status')
    if (s && STATUS_FILTERS[s] && STATUS_FILTERS[s] !== status) {
      setStatus(STATUS_FILTERS[s])
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const suppliers = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.supplier))).sort(),
    [rows],
  )

  const summary = useMemo(() => {
    const list = rows ?? []
    return {
      totalUnits: list.reduce((s, r) => s + r.quantity, 0),
      inventoryValue: list.reduce((s, r) => s + r.stockValue, 0),
      lowStock: list.filter((r) => r.status === 'Low stock').length,
      nearExpiry: list.filter((r) => r.status === 'Near expiry').length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    let list = rows ?? []
    if (term) {
      list = list.filter(
        (r) =>
          r.medicine.toLowerCase().includes(term) ||
          r.brand.toLowerCase().includes(term) ||
          r.batchNumber.toLowerCase().includes(term),
      )
    }
    if (status !== 'all') list = list.filter((r) => r.status === status)
    if (supplier !== 'all') list = list.filter((r) => r.supplier === supplier)
    if (expiry === '30') list = list.filter((r) => r.daysToExpiry <= 30)
    if (expiry === '90') list = list.filter((r) => r.daysToExpiry <= 90)
    if (expiry === '180') list = list.filter((r) => r.daysToExpiry <= 180)

    const { key, direction } = sort
    return [...list].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''))
      return direction === 'asc' ? cmp : -cmp
    })
  }, [rows, debouncedSearch, status, supplier, expiry, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  const openAdjust = (row) => {
    setAdjustRow(row)
    setAdjustForm({ direction: 'add', quantity: '', reason: MOVEMENT_TYPES[0] })
    setAdjustErrors({})
  }

  const submitAdjustment = async (event) => {
    event.preventDefault()
    const errors = {}
    const qty = Number(adjustForm.quantity)
    if (!adjustForm.quantity || Number.isNaN(qty) || qty <= 0) {
      errors.quantity = 'Enter a quantity greater than zero.'
    }
    const delta = adjustForm.direction === 'add' ? qty : -qty
    if (adjustForm.direction === 'remove' && delta < -adjustRow.quantity) {
      errors.quantity = `Only ${adjustRow.quantity} units are on hand in ${adjustRow.batchNumber}.`
    }
    if (!adjustForm.reason.trim()) errors.reason = 'Select a reason for the adjustment.'
    setAdjustErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      await adjustStock({
        batchId: adjustRow.id,
        delta,
        reason: adjustForm.reason,
        user: user?.name,
      })
      toast(
        `${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} units of ${adjustRow.medicine} (${adjustRow.batchNumber}).`,
        { type: 'success' },
      )
      setAdjustRow(null)
      reload()
    } catch (err) {
      toast(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const header = ['Medicine', 'Batch', 'Quantity', 'Expiry', 'Status', 'Supplier', 'Stock value']
    const lines = filtered.map((r) =>
      [r.medicine, r.batchNumber, r.quantity, r.expiryDate, r.status, r.supplier, r.stockValue].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mediflow-inventory.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast(
      USE_MOCK_API ? 'Inventory export downloaded (demo CSV).' : 'Inventory export downloaded.',
      { type: 'info' },
    )
  }

  const clearFilters = () => {
    setPage(1)
    setSearch('')
    setStatus('all')
    setSupplier('all')
    setExpiry('all')
    setSearchParams({})
  }

  const columns = [
    {
      key: 'medicine',
      header: 'Medicine',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{row.medicine}</p>
          <p className="text-xs text-app-muted">{row.brand}</p>
        </div>
      ),
    },
    { key: 'batchNumber', header: 'Batch', sortable: true, render: (row) => <span className="font-mono text-xs text-slate-600">{row.batchNumber}</span> },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{formatNumber(row.quantity)}</p>
          <p className="text-[11px] text-app-muted">reorder {formatNumber(row.reorderLevel)}</p>
        </div>
      ),
    },
    {
      key: 'expiryDate',
      header: 'Expiry',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-slate-700">{formatDate(row.expiryDate)}</p>
          <p
            className={`text-[11px] ${
              row.daysToExpiry <= 30
                ? 'font-medium text-red-600'
                : row.daysToExpiry <= 90
                  ? 'font-medium text-amber-600'
                  : 'text-app-muted'
            }`}
          >
            {row.daysToExpiry < 0 ? 'Expired' : `${row.daysToExpiry} days left`}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} size="sm" /> },
    { key: 'supplier', header: 'Supplier', sortable: true, render: (row) => <span className="text-slate-600">{row.supplier}</span> },
    {
      key: 'stockValue',
      header: 'Stock value',
      align: 'right',
      sortable: true,
      className: 'hidden lg:table-cell',
      render: (row) => <span className="text-slate-700">{formatCurrency(row.stockValue, { compact: true })}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        permissions.adjustStock ? (
          <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={() => openAdjust(row)}>
            Adjust
          </Button>
        ) : (
          <span className="text-xs text-app-muted">View only</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Helmet title="Inventory" description="Batch-level stock, expiry dates and adjustments." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Stock control
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Batch inventory
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            FEFO tracked batches across all warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <DemoBanner icon={Boxes}>
        Quantities, batch numbers and expiry dates below are sample data for interface development.
        Stock adjustments are recorded only in the browser session.
      </DemoBanner>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total units', value: summary.totalUnits, icon: Boxes, tone: 'text-brand-700', load: loading },
          { label: 'Inventory value', value: formatCurrency(summary.inventoryValue, { compact: true }), icon: TrendingUp, tone: 'text-accent-700', load: loading },
          { label: 'Low-stock batches', value: summary.lowStock, icon: TrendingDown, tone: 'text-amber-700', load: loading },
          { label: 'Near-expiry batches', value: summary.nearExpiry, icon: CalendarClock, tone: 'text-red-700', load: loading },
        ].map(({ label, value, icon: Icon, tone, load }) => (
          <Card
            key={label}
            className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex items-center gap-2.5 text-app-muted">
              <span className="rounded-xl bg-app-surface p-1.5 text-slate-500 shadow-soft">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{label}</p>
            </div>
            {load ? (
              <Skeleton className="mt-2.5 h-7 w-20" />
            ) : (
              <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <Input
              label="Search inventory"
              name="inventory-search"
              icon={Search}
              placeholder="Medicine, brand or batch number"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select label="Stock status" name="status-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select label="Supplier" name="supplier-filter" value={supplier} onChange={(e) => { setSupplier(e.target.value); setPage(1) }}>
              <option value="all">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select label="Expiry window" name="expiry-filter" value={expiry} onChange={(e) => { setExpiry(e.target.value); setPage(1) }}>
              <option value="all">Any expiry</option>
              <option value="30">Within 30 days</option>
              <option value="90">Within 90 days</option>
              <option value="180">Within 180 days</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-app-muted">
            <p>
              {filtered.length} {filtered.length === 1 ? 'batch' : 'batches'} shown
            </p>
            {search || status !== 'all' || supplier !== 'all' || expiry !== 'all' ? (
              <button type="button" onClick={clearFilters} className="font-medium text-brand-700 hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <SkeletonTable rows={PAGE_SIZE} cols={6} />
        ) : (
          <DataTable
            columns={columns}
            rows={pageRows}
            sort={sort}
            onSort={onSort}
            page={safePage}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
            emptyIcon={Search}
            emptyTitle="No batches match your filters"
            emptyDescription="Adjust the filters or clear them to view all tracked batches."
            mobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{row.medicine}</p>
                    <p className="font-mono text-xs text-app-muted">{row.batchNumber}</p>
                  </div>
                  <StatusBadge status={row.status} size="sm" />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-app-muted">Quantity</dt>
                    <dd className="font-medium text-slate-800">{formatNumber(row.quantity)}</dd>
                  </div>
                  <div>
                    <dt className="text-app-muted">Expiry</dt>
                    <dd className="font-medium text-slate-800">{formatDate(row.expiryDate)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-app-muted">Supplier</dt>
                    <dd className="text-slate-700">{row.supplier}</dd>
                  </div>
                </dl>
                {permissions.adjustStock ? (
                  <Button variant="secondary" size="sm" icon={SlidersHorizontal} className="w-full" onClick={() => openAdjust(row)}>
                    Adjust stock
                  </Button>
                ) : null}
              </div>
            )}
          />
        )}
      </Card>

      {!loading && filtered.length === 0 && !error ? (
        <EmptyState
          icon={Search}
          title="Nothing to adjust right now"
          description="Try widening the expiry window or clearing the supplier filter."
          compact
        />
      ) : null}

      <Modal
        open={Boolean(adjustRow)}
        onClose={() => setAdjustRow(null)}
        title="Adjust stock"
        description={adjustRow ? `${adjustRow.medicine} - batch ${adjustRow.batchNumber}` : ''}
        icon={SlidersHorizontal}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustRow(null)}>
              Cancel
            </Button>
            <Button form="adjust-form" type="submit" loading={saving}>
              Apply adjustment
            </Button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={submitAdjustment} noValidate className="space-y-4">
          <div className="rounded-2xl border border-white/40 bg-app-surface/60 px-4 py-3.5 shadow-inset-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-muted">Units on hand</span>
              <span className="font-semibold text-slate-800">{formatNumber(adjustRow?.quantity ?? 0)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-app-muted">Expiry</span>
              <span className="font-semibold text-slate-800">{formatDate(adjustRow?.expiryDate)}</span>
            </div>
          </div>

          <div role="radiogroup" aria-label="Adjustment direction" className="grid grid-cols-2 gap-2">
            {[
              { key: 'add', label: 'Add units', icon: TrendingUp },
              { key: 'remove', label: 'Remove units', icon: TrendingDown },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={adjustForm.direction === key}
                onClick={() => setAdjustForm({ ...adjustForm, direction: key })}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  adjustForm.direction === key
                    ? 'neu-chip-active'
                    : 'neu-chip text-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <Input
            label="Quantity"
            name="quantity"
            type="number"
            min="1"
            required
            value={adjustForm.quantity}
            error={adjustErrors.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
            hint={adjustForm.direction === 'remove' ? `Maximum ${adjustRow?.quantity ?? 0} units` : undefined}
          />

          <Select
            label="Reason"
            name="reason"
            required
            value={adjustForm.reason}
            error={adjustErrors.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
          >
            {MOVEMENT_TYPES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          <Textarea
            label="Notes (optional)"
            name="notes"
            rows={2}
            placeholder="Reference number, supervisor approval, reason detail..."
          />

          <p className="flex items-start gap-2 rounded-2xl bg-brand-50/80 px-3.5 py-3 text-xs font-medium text-brand-800 shadow-soft">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Stock can never fall below zero. Adjustments are posted to the movement ledger and cannot be
            undone from this screen.
          </p>
        </form>
      </Modal>

      <div className="flex items-center gap-2 text-xs text-app-muted">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Batch quantities are never hidden or estimated - every row reflects a specific batch and expiry.
      </div>
    </div>
  )
}

export default Inventory