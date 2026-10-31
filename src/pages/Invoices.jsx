import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ReceiptText,
  Search,
  Wallet,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { Drawer } from '../components/ui/Drawer'
import { StatusBadge } from '../components/ui/Badge'
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, EmptyState, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DataTable } from '../components/tables/DataTable'
import { useAsync } from '../hooks/useAsync'
import { useDebounce } from '../hooks/useDebounce'
import { getInvoiceDetail, listInvoices, recordPayment } from '../services/analyticsService'
import { PAYMENT_STATUSES } from '../data/constants'
import { USE_MOCK_API } from '../services/api'
import { cn, formatCurrency, formatDate, formatNumber } from '../utils/format'

const PAGE_SIZE = 8

export const Invoices = () => {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'dueDate', direction: 'asc' })
  const [openId, setOpenId] = useState(null)
  const [paying, setPaying] = useState(false)

  const debouncedSearch = useDebounce(search, 200)
  const { data: invoices, loading, error, reload } = useAsync(() => listInvoices(), [])
  const { data: detail, loading: detailLoading } = useAsync(
    () => (openId ? getInvoiceDetail(openId) : Promise.resolve(null)),
    [openId],
  )

  const summary = useMemo(() => {
    const list = invoices ?? []
    return {
      billed: list.reduce((s, i) => s + i.totalAmount, 0),
      outstanding: list
        .filter((i) => i.paymentStatus === 'Pending' || i.paymentStatus === 'Overdue')
        .reduce((s, i) => s + i.totalAmount, 0),
      overdue: list.filter((i) => i.paymentStatus === 'Overdue').length,
      collected: list.filter((i) => i.paymentStatus === 'Paid').length,
    }
  }, [invoices])

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    let list = invoices ?? []
    if (term) {
      list = list.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(term) ||
          i.orderId.toLowerCase().includes(term) ||
          i.retailer.toLowerCase().includes(term),
      )
    }
    if (status !== 'all') list = list.filter((i) => i.paymentStatus === status)

    const { key, direction } = sort
    return [...list].sort((a, b) => {
      const cmp =
        typeof a[key] === 'number' && typeof b[key] === 'number'
          ? a[key] - b[key]
          : String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
      return direction === 'asc' ? cmp : -cmp
    })
  }, [invoices, debouncedSearch, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    )

  const markPaid = async (invoice) => {
    setPaying(true)
    try {
      await recordPayment(invoice.id)
      toast(`${invoice.invoiceNumber} marked as paid.`, { type: 'success' })
      reload()
      if (openId === invoice.id) setOpenId(null)
    } catch (err) {
      toast(err.message, { type: 'error' })
    } finally {
      setPaying(false)
    }
  }

  const downloadInvoice = (invoice) => {
    toast(
      USE_MOCK_API
        ? `Invoice download requires the backend document endpoint. Use Print for a local copy of ${invoice.invoiceNumber}.`
        : `Use Print to save ${invoice.invoiceNumber} as a PDF.`,
      { type: 'info', title: USE_MOCK_API ? 'Demo action' : 'Print invoice' },
    )
    window.print()
  }

  const columns = [
    {
      key: 'invoiceNumber',
      header: 'Invoice',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id)}
          className="font-medium text-brand-700 hover:underline"
        >
          {row.invoiceNumber}
        </button>
      ),
    },
    {
      key: 'orderId',
      header: 'Order',
      sortable: true,
      render: (row) => <span className="text-slate-600">{row.orderId}</span>,
    },
    { key: 'retailer', header: 'Retailer', sortable: true, render: (row) => <span className="text-slate-700">{row.retailer}</span> },
    { key: 'invoiceDate', header: 'Invoice date', sortable: true, render: (row) => formatDate(row.invoiceDate) },
    {
      key: 'dueDate',
      header: 'Due date',
      sortable: true,
      render: (row) => (
        <span className={cn(row.paymentStatus === 'Overdue' ? 'font-medium text-red-600' : 'text-slate-700')}>
          {formatDate(row.dueDate)}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-800">{formatCurrency(row.totalAmount)}</span>,
    },
    { key: 'paymentStatus', header: 'Payment', sortable: true, render: (row) => <StatusBadge status={row.paymentStatus} size="sm" /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => setOpenId(row.id)}>
            View
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadInvoice(row)} aria-label={`Download ${row.invoiceNumber}`}>
            <span className="sr-only">Download</span>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Helmet title="Invoices & Payments" description="Invoice status, due dates and payment tracking." />

      <div>
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
          Billing
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Invoices and payments
        </h2>
        <p className="mt-0.5 text-sm text-app-muted">
          Track billing cycles and settle outstanding retailer invoices.
        </p>
      </div>

      <DemoBanner icon={ReceiptText}>
        Invoice numbering, tax splits and payment states are sample records. Marking an invoice as paid
        only updates the browser demo store.
      </DemoBanner>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total billed', value: formatCurrency(summary.billed, { compact: true }), icon: FileText, tone: 'text-brand-700' },
          { label: 'Outstanding', value: formatCurrency(summary.outstanding, { compact: true }), icon: Wallet, tone: 'text-amber-700' },
          { label: 'Overdue', value: summary.overdue, icon: ReceiptText, tone: 'text-red-700' },
          { label: 'Settled invoices', value: summary.collected, icon: CheckCircle2, tone: 'text-emerald-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
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
            {loading ? (
              <Skeleton className="mt-2.5 h-7 w-20" />
            ) : (
              <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              label="Search invoices"
              name="invoice-search"
              icon={Search}
              placeholder="Invoice number, order ID or retailer"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select label="Payment status" name="payment-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="all">All statuses</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
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
            emptyIcon={ReceiptText}
            emptyTitle="No invoices found"
            emptyDescription="Adjust the payment status filter or clear your search."
            mobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.invoiceNumber}</p>
                    <p className="text-xs text-app-muted">
                      {row.orderId} &middot; {row.retailer}
                    </p>
                  </div>
                  <StatusBadge status={row.paymentStatus} size="sm" />
                </div>
                <div className="flex items-center justify-between text-xs text-app-muted">
                  <span>Due {formatDate(row.dueDate)}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(row.totalAmount)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpenId(row.id)}>
                    View invoice
                  </Button>
                  {row.paymentStatus !== 'Paid' ? (
                    <Button size="sm" className="flex-1" loading={paying} onClick={() => markPaid(row)}>
                      Mark paid
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <Drawer
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={detail?.invoiceNumber ?? 'Invoice'}
        description={detail ? `${detail.retailer} - due ${formatDate(detail.dueDate)}` : undefined}
        footer={
          detail ? (
            <>
              <Button variant="secondary" icon={Download} onClick={() => downloadInvoice(detail)}>
                Print / download
              </Button>
              {detail.paymentStatus !== 'Paid' ? (
                <Button loading={paying} icon={CheckCircle2} onClick={() => markPaid(detail)}>
                  Mark as paid
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-app-muted uppercase">Billed to</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detail.retailer}</p>
                {detail.retailerRecord ? (
                  <p className="text-xs text-app-muted">
                    {detail.retailerRecord.city} &middot; {detail.retailerRecord.contact} &middot;{' '}
                    {detail.retailerRecord.phone}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs tracking-wide text-app-muted uppercase">Status</p>
                <StatusBadge status={detail.paymentStatus} size="sm" className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-app-surface/60 p-4 shadow-inset-sm sm:grid-cols-4">
              {[
                ['Invoice date', formatDate(detail.invoiceDate)],
                ['Due date', formatDate(detail.dueDate)],
                ['Order', detail.orderId],
                ['Warehouse', detail.warehouse],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] tracking-wide text-app-muted uppercase">{label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-app-border/60 bg-white/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border/60 text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase">
                    <th scope="col" className="px-3.5 py-2.5 text-left font-semibold">Description</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right font-semibold">Qty</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right font-semibold">Rate</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3.5 py-2.5">
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-app-muted">{item.packSize}</p>
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-slate-700">{formatNumber(item.quantity)}</td>
                      <td className="px-3.5 py-2.5 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-slate-800">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1.5 border-t border-app-border/60 bg-white/30 px-4 py-3 text-sm">
                <div className="flex justify-between text-app-muted">
                  <span>Taxable value</span>
                  <span>{formatCurrency(detail.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-app-muted">
                  <span>GST (5%)</span>
                  <span>{formatCurrency(detail.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-app-border pt-1.5 font-semibold text-slate-900">
                  <span>Invoice total</span>
                  <span>{formatCurrency(detail.totalAmount + detail.taxAmount)}</span>
                </div>
              </div>
            </div>

            {detail.paidOn ? (
              <p className="rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-medium text-emerald-800 shadow-soft">
                Payment received on {formatDate(detail.paidOn)}.
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState compact title="Invoice unavailable" description="The invoice could not be loaded." />
        )}
      </Drawer>
    </div>
  )
}

export default Invoices