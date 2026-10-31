import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Ban,
  Check,
  ClipboardList,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { Drawer } from '../components/ui/Drawer'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DataTable } from '../components/tables/DataTable'
import { useAsync } from '../hooks/useAsync'
import { useDebounce } from '../hooks/useDebounce'
import { listMedicines } from '../services/medicineService'
import { createOrder, listOrders, listRetailers, updateOrderStatus } from '../services/orderService'
import { useAuth } from '../context/AuthContext'
import { ORDER_STATUSES } from '../data/constants'
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber } from '../utils/format'

const PAGE_SIZE = 8

const OrderTimeline = ({ order }) => (
  <ol className="relative space-y-4">
    {order.timeline?.map((event, index) => (
      <li key={`${event.label}-${index}`} className="relative flex gap-3">
        {index < order.timeline.length - 1 ? (
          <span className="absolute top-6 left-3 h-full w-px bg-app-border" aria-hidden="true" />
        ) : null}
        <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-200">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{event.label}</p>
          <p className="text-xs text-app-muted">{formatDateTime(event.timestamp)}</p>
        </div>
      </li>
    ))}
  </ol>
)

const OrderDrawer = ({ order, onClose, onStatusChange, busy, canApprove }) => {
  if (!order) return null

  const nextActions = {
    Pending: canApprove ? ['Approved', 'Cancelled'] : [],
    Approved: ['Processing', 'Cancelled'],
    Processing: ['Shipped'],
    Shipped: ['Delivered'],
  }[order.status] ?? []

  return (
    <Drawer
      open={Boolean(order)}
      onClose={onClose}
      title={`Order ${order.id}`}
      description={`${order.retailer} - placed ${formatDate(order.orderDate)}`}
      footer={
        nextActions.length ? (
          <>
            {nextActions
              .filter((s) => s !== 'Cancelled')
              .map((s) => (
                <Button
                  key={s}
                  variant={s === 'Delivered' ? 'accent' : 'primary'}
                  loading={busy}
                  icon={s === 'Shipped' ? Truck : Check}
                  onClick={() => onStatusChange(order.id, s)}
                >
                  Mark {s.toLowerCase()}
                </Button>
              ))}
            {nextActions.includes('Cancelled') ? (
              <Button variant="danger" icon={Ban} loading={busy} onClick={() => onStatusChange(order.id, 'Cancelled')}>
                Reject order
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-app-muted">
            {order.status === 'Delivered' ? 'Order completed - no further actions.' : 'Order is closed.'}
          </p>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-app-surface/60 p-4 shadow-inset-sm">
          {[
            ['Status', <StatusBadge key="s" status={order.status} size="sm" />],
            ['Items', formatNumber(order.itemCount)],
            ['Total units', formatNumber(order.totalQuantity)],
            ['Warehouse', order.warehouse],
            ['Payment terms', order.paymentTerms],
            ['Order value', formatCurrency(order.totalAmount)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] tracking-wide text-app-muted uppercase">{label}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Itemised medicines
          </h3>
          <div className="overflow-hidden rounded-2xl border border-app-border/60 bg-white/20">
            <ul className="divide-y divide-app-border/50">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-app-muted">
                      {item.brand} &middot; {item.packSize}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatNumber(item.quantity)} &times; {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-800">
                    {formatCurrency(item.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-app-border/60 bg-white/30 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Order total</span>
              <span className="text-base font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-600 uppercase">Order history</h3>
          <OrderTimeline order={order} />
        </div>
      </div>
    </Drawer>
  )
}

const CartLine = ({ line, onQuantity, onRemove }) => (
  <div className="flex items-start gap-3 border-b border-app-border/50 px-3.5 py-3 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-slate-800">{line.name}</p>
      <p className="text-xs text-app-muted">
        {line.brand} &middot; {line.packSize}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {formatCurrency(line.unitPrice)} / unit &middot; {formatNumber(line.stock)} in stock
      </p>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex items-center rounded-xl bg-app-surface shadow-inset-sm">
        <button
          type="button"
          onClick={() => onQuantity(line.id, -1)}
          className="px-2 py-1 text-slate-600 transition hover:bg-white/50 active:shadow-inset-sm disabled:opacity-40"
          disabled={line.quantity <= 1}
          aria-label={`Decrease ${line.name}`}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <input
          type="number"
          min="1"
          max={line.stock}
          value={line.quantity}
          onChange={(e) => onQuantity(line.id, 0, e.target.value)}
          className="w-12 border-x border-app-border/50 bg-transparent py-1 text-center text-sm font-semibold text-slate-800 focus:outline-none"
          aria-label={`Quantity for ${line.name}`}
        />
        <button
          type="button"
          onClick={() => onQuantity(line.id, 1)}
          className="px-2 py-1 text-slate-600 transition hover:bg-white/50 active:shadow-inset-sm disabled:opacity-40"
          disabled={line.quantity >= line.stock}
          aria-label={`Increase ${line.name}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{formatCurrency(line.lineTotal)}</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-app-muted transition hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove ${line.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
)

const NewOrderModal = ({ open, onClose, onCreated }) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [term, setTerm] = useState('')
  const [cart, setCart] = useState([])
  const [retailerId, setRetailerId] = useState('')
  const [warehouse, setWarehouse] = useState('Chennai Central WH')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const debounced = useDebounce(term, 200)

  const { data: medicines } = useAsync(() => listMedicines(), [open])
  const { data: retailers } = useAsync(() => listRetailers(), [open])

  const selectedRetailerId = retailerId || retailers?.[0]?.id || ''

  const close = () => {
    setCart([])
    setTerm('')
    setRetailerId('')
    setFormError(null)
    onClose()
  }

  const matches = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    const list = medicines ?? []
    if (!q) return list.slice(0, 6)
    return list
      .filter((m) => m.name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q))
      .slice(0, 6)
  }, [medicines, debounced])

  const addLine = (medicine) => {
    if (medicine.availableQuantity <= 0) {
      toast(`${medicine.name} is out of stock.`, { type: 'warning' })
      return
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.medicineId === medicine.id)
      if (existing) {
        return prev.map((l) =>
          l.medicineId === medicine.id
            ? {
                ...l,
                quantity: Math.min(l.quantity + 1, medicine.availableQuantity),
                lineTotal: Number(((l.quantity + 1) * l.unitPrice).toFixed(2)),
              }
            : l,
        )
      }
      return [
        ...prev,
        {
          id: `${medicine.id}-${Date.now()}`,
          medicineId: medicine.id,
          name: `${medicine.name} ${medicine.strength}`,
          brand: medicine.brand,
          packSize: medicine.packSize,
          unitPrice: medicine.unitPrice,
          stock: medicine.availableQuantity,
          quantity: 1,
          lineTotal: medicine.unitPrice,
        },
      ]
    })
  }

  const changeQuantity = (id, delta, raw) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line
        const next =
          raw !== undefined
            ? Math.max(1, Math.min(Number(raw) || 1, line.stock))
            : Math.max(1, Math.min(line.quantity + delta, line.stock))
        return { ...line, quantity: next, lineTotal: Number((next * line.unitPrice).toFixed(2)) }
      }),
    )
  }

  const removeLine = (id) => setCart((prev) => prev.filter((l) => l.id !== id))

  const total = cart.reduce((sum, l) => sum + l.lineTotal, 0)
  const retailer = retailers?.find((r) => r.id === selectedRetailerId)

  const submit = async () => {
    setFormError(null)
    if (!cart.length) {
      setFormError('Add at least one medicine before placing the order.')
      return
    }
    setSubmitting(true)
    try {
      const order = await createOrder({
        retailer: retailer?.name ?? 'Retailer',
        retailerId: selectedRetailerId,
        warehouse,
        items: cart.map((line) => ({
          medicineId: line.medicineId,
          name: line.name,
          brand: line.brand,
          packSize: line.packSize,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
        user: user?.name,
      })
      toast(`Order ${order.id} submitted for distributor approval.`, { type: 'success' })
      onCreated(order)
      close()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create order"
      description="Search the catalog, set quantities and submit for approval."
      icon={ShoppingCart}
      size="xl"
      footer={
        <>
          <span className="mr-auto text-sm text-app-muted">
            {cart.length} {cart.length === 1 ? 'line' : 'lines'} &middot;{' '}
            <span className="font-semibold text-slate-800">{formatCurrency(total)}</span>
          </span>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={submit} disabled={cart.length === 0}>
            Place order
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Input
            label="Search medicines"
            name="cart-search"
            icon={Search}
            placeholder="Search by name or brand"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />

          <div>
            <p className="mb-2 text-xs font-medium text-slate-700">Results</p>
            <ul className="scroll-thin max-h-72 divide-y divide-app-border/50 overflow-y-auto rounded-2xl border border-white/40 bg-white/20 shadow-inset-sm">
              {matches.length === 0 ? (
                <li>
                  <EmptyState compact title="No medicines found" description="Try a different search term." />
                </li>
              ) : (
                matches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {m.name} {m.strength}
                      </p>
                      <p className="text-xs text-app-muted">
                        {m.brand} &middot; {formatCurrency(m.unitPrice)} &middot;{' '}
                        <span className={cn(m.availableQuantity <= m.reorderLevel ? 'font-medium text-amber-700' : 'text-slate-600')}>
                          {formatNumber(m.availableQuantity)} available
                        </span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Plus}
                      onClick={() => addLine(m)}
                      disabled={m.availableQuantity <= 0}
                    >
                      Add
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <Select
            label="Deliver to retailer"
            name="retailer"
            value={selectedRetailerId}
            onChange={(e) => setRetailerId(e.target.value)}
          >
            {(retailers ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} - {r.city}
              </option>
            ))}
          </Select>
          <Select label="Fulfilment warehouse" name="warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option>Chennai Central WH</option>
            <option>Bengaluru South WH</option>
          </Select>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              Order summary
            </p>
            <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/20 shadow-inset-sm">
              {cart.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-sm text-app-muted">
                  Your cart is empty. Add medicines from the list.
                </p>
              ) : (
                cart.map((line) => (
                  <CartLine
                    key={line.id}
                    line={line}
                    onQuantity={changeQuantity}
                    onRemove={() => removeLine(line.id)}
                  />
                ))
              )}
              <div className="space-y-1.5 border-t border-app-border/60 bg-white/30 px-3.5 py-3">
                <div className="flex justify-between text-xs text-app-muted">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-xs text-app-muted">
                  <span>GST (5%)</span>
                  <span>{formatCurrency(total * 0.05)}</span>
                </div>
                <div className="flex justify-between border-t border-app-border pt-1.5 text-sm font-semibold text-slate-900">
                  <span>Order total</span>
                  <span>{formatCurrency(total * 1.05)}</span>
                </div>
              </div>
            </div>
          </div>

          {formError ? (
            <p className="flex items-start gap-2 rounded-2xl border border-red-200/60 bg-red-50/80 px-3.5 py-2.5 text-xs font-medium text-red-700 shadow-soft" role="alert">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

export const Orders = () => {
  const { user, permissions } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'orderDate', direction: 'desc' })
  const [activeId, setActiveId] = useState(searchParams.get('open') ?? null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const debouncedSearch = useDebounce(search, 200)
  const { data: orders, loading, error, reload } = useAsync(() => listOrders(), [])

  const activeOrder = useMemo(
    () => (activeId ? (orders ?? []).find((o) => o.id === activeId) ?? null : null),
    [orders, activeId],
  )

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    let list = orders ?? []
    if (term) {
      list = list.filter(
        (o) => o.id.toLowerCase().includes(term) || o.retailer.toLowerCase().includes(term),
      )
    }
    if (status !== 'all') list = list.filter((o) => o.status === status)

    const { key, direction } = sort
    return [...list].sort((a, b) => {
      const cmp = key === 'orderDate' ? new Date(a.orderDate) - new Date(b.orderDate) : 0
      if (cmp) return direction === 'asc' ? cmp : -cmp
      const av = a[key]
      const bv = b[key]
      const s =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''))
      return direction === 'asc' ? s : -s
    })
  }, [orders, debouncedSearch, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const counts = useMemo(() => {
    const map = { all: (orders ?? []).length }
    ;(orders ?? []).forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1
    })
    return map
  }, [orders])

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    )

  const changeStatus = async (id, next) => {
    setBusy(true)
    try {
      await updateOrderStatus(id, next, user?.name)
      toast(`Order ${id} marked ${next.toLowerCase()}.`, { type: 'success' })
      reload()
    } catch (err) {
      toast(err.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'id',
      header: 'Order ID',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setActiveId(row.id)}
          className="font-medium text-brand-700 hover:underline"
        >
          {row.id}
        </button>
      ),
    },
    { key: 'retailer', header: 'Retailer', sortable: true, render: (row) => <span className="text-slate-700">{row.retailer}</span> },
    { key: 'orderDate', header: 'Order date', sortable: true, render: (row) => formatDate(row.orderDate) },
    {
      key: 'itemCount',
      header: 'Items',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.itemCount}</p>
          <p className="text-[11px] text-app-muted">{formatNumber(row.totalQuantity)} units</p>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-800">{formatCurrency(row.totalAmount)}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} size="sm" /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {permissions.approveOrders && row.status === 'Pending' ? (
            <>
              <Button variant="ghost" size="sm" icon={Check} className="text-emerald-700 hover:bg-emerald-50" onClick={() => changeStatus(row.id, 'Approved')}>
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={XCircle}
                className="text-red-600 hover:bg-red-50"
                onClick={() => changeStatus(row.id, 'Cancelled')}
                aria-label={`Reject ${row.id}`}
              >
                Reject
              </Button>
            </>
          ) : null}
          <Button variant="secondary" size="sm" icon={Package} onClick={() => setActiveId(row.id)}>
            Details
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Helmet title="Orders" description="Track, approve and create pharmaceutical orders." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Fulfilment
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            {permissions.placeOrders && !permissions.approveOrders ? 'My orders' : 'Order management'}
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            {permissions.approveOrders
              ? 'Review retailer orders, approve or reject, and monitor fulfilment.'
              : 'Track the status of orders placed by your pharmacy.'}
          </p>
        </div>
        {permissions.placeOrders ? (
          <Button icon={ShoppingCart} onClick={() => setShowCreate(true)}>
            New order
          </Button>
        ) : null}
      </div>

      <DemoBanner icon={Truck}>
        Orders and retailers below are fictional sample records. Status changes update the demo store
        only and will map to Flask endpoints (PATCH /orders/:id/status) once connected.
      </DemoBanner>

      <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {['all', ...ORDER_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            aria-pressed={status === s}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200',
              status === s ? 'neu-chip-active' : 'neu-chip text-slate-600',
            )}
          >
            {s === 'all' ? 'All orders' : s}
            <span className="ml-1.5 opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardBody>
          <Input
            label="Search orders"
            name="order-search"
            icon={Search}
            placeholder="Search by order ID or retailer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            emptyIcon={ClipboardList}
            emptyTitle="No orders found"
            emptyDescription="Adjust the status filter or clear the search to see more orders."
            mobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.id}</p>
                    <p className="text-sm text-slate-600">{row.retailer}</p>
                  </div>
                  <StatusBadge status={row.status} size="sm" />
                </div>
                <div className="flex items-center justify-between text-xs text-app-muted">
                  <span>{formatDate(row.orderDate)}</span>
                  <span>
                    {row.itemCount} items &middot;{' '}
                    <span className="font-semibold text-slate-800">{formatCurrency(row.totalAmount)}</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setActiveId(row.id)}>
                    View details
                  </Button>
                  {permissions.approveOrders && row.status === 'Pending' ? (
                    <Button size="sm" className="flex-1" icon={Check} onClick={() => changeStatus(row.id, 'Approved')}>
                      Approve
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <OrderDrawer
        order={activeOrder}
        onClose={() => setActiveId(null)}
        onStatusChange={changeStatus}
        busy={busy}
        canApprove={permissions.approveOrders}
      />

      {permissions.placeOrders ? (
        <NewOrderModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => reload()}
        />
      ) : null}
    </div>
  )
}

export default Orders