import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Beaker,
  PackagePlus,
  Pencil,
  Pill,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { Helmet } from '../components/layout/Helmet'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import { SkeletonTable } from '../components/ui/Skeleton'
import { DemoBanner, ErrorState } from '../components/ui/States'
import { useToast } from '../components/ui/Toast'
import { DataTable } from '../components/tables/DataTable'
import { useAsync } from '../hooks/useAsync'
import { useDebounce } from '../hooks/useDebounce'
import { createMedicine, deleteMedicine, listMedicines, updateMedicine } from '../services/medicineService'
import { useAuth } from '../context/AuthContext'
import { DOSAGE_FORMS, MEDICINE_CATEGORIES, SUPPLIERS } from '../data/constants'
import { formatCurrency, formatNumber, isoPlusDays, todayIso } from '../utils/format'

const PAGE_SIZE = 8

const EMPTY_FORM = {
  name: '',
  brand: '',
  strength: '',
  dosageForm: 'Tablet',
  packSize: '',
  category: 'Analgesic',
  unitPrice: '',
  reorderLevel: '',
  supplier: '',
  batchNumber: '',
  expiryDate: isoPlusDays(365),
  quantity: '0',
  costPrice: '',
}

const validate = (form) => {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Medicine name is required.'
  if (!form.brand.trim()) errors.brand = 'Brand is required.'
  if (!form.strength.trim()) errors.strength = 'Strength is required.'
  if (!form.packSize.trim()) errors.packSize = 'Pack size is required.'
  if (!form.unitPrice || Number(form.unitPrice) <= 0) errors.unitPrice = 'Enter a price greater than zero.'
  if (form.reorderLevel === '' || Number(form.reorderLevel) < 0) errors.reorderLevel = 'Enter zero or a positive number.'
  if (form.batchNumber) {
    if (!form.expiryDate) errors.expiryDate = 'Expiry date is required when a batch is provided.'
    else if (form.expiryDate <= todayIso()) errors.expiryDate = 'Expiry date must be in the future.'
    if (Number(form.quantity) < 0) errors.quantity = 'Quantity cannot be negative.'
  }
  return errors
}

const MedicineForm = ({ form, setForm, errors }) => {
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Medicine name" name="name" required value={form.name} error={errors.name} onChange={update('name')} placeholder="e.g. Paracetamol" />
      <Input label="Brand" name="brand" required value={form.brand} error={errors.brand} onChange={update('brand')} placeholder="e.g. Panadol" />
      <Input label="Strength" name="strength" required value={form.strength} error={errors.strength} onChange={update('strength')} placeholder="e.g. 500 mg" />
      <Select label="Dosage form" name="dosageForm" value={form.dosageForm} onChange={update('dosageForm')}>
        {DOSAGE_FORMS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Input label="Pack size" name="packSize" required value={form.packSize} error={errors.packSize} onChange={update('packSize')} placeholder="e.g. 10 tablets x 10 strips" />
      <Select label="Category" name="category" value={form.category} onChange={update('category')}>
        {MEDICINE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        label="Unit price (INR)"
        name="unitPrice"
        type="number"
        min="0"
        step="0.05"
        required
        value={form.unitPrice}
        error={errors.unitPrice}
        onChange={update('unitPrice')}
      />
      <Input
        label="Reorder level"
        name="reorderLevel"
        type="number"
        min="0"
        value={form.reorderLevel}
        error={errors.reorderLevel}
        onChange={update('reorderLevel')}
        hint="Alert threshold per SKU"
      />
      <Select label="Primary supplier" name="supplier" value={form.supplier} onChange={update('supplier')} className="sm:col-span-2">
        <option value="">Select a supplier</option>
        {SUPPLIERS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <div className="sm:col-span-2">
        <p className="mb-3 flex items-center gap-2 border-t border-app-border/60 pt-4 text-[11px] font-bold tracking-[0.08em] text-slate-600 uppercase">
          <Beaker className="h-3.5 w-3.5" aria-hidden="true" />
          Opening batch (optional)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Batch number" name="batchNumber" value={form.batchNumber} onChange={update('batchNumber')} placeholder="e.g. MF2412" />
          <Input label="Expiry date" name="expiryDate" type="date" value={form.expiryDate} error={errors.expiryDate} onChange={update('expiryDate')} />
          <Input label="Units received" name="quantity" type="number" min="0" value={form.quantity} error={errors.quantity} onChange={update('quantity')} />
          <Input
            label="Cost price per unit (INR)"
            name="costPrice"
            type="number"
            min="0"
            step="0.05"
            value={form.costPrice}
            onChange={update('costPrice')}
            hint="Optional. Defaults to 78% of unit price."
          />
        </div>
      </div>
    </div>
  )
}

export const Medicines = () => {
  const { permissions } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const debouncedSearch = useDebounce(search, 200)
  const { data: medicines, loading, error, reload } = useAsync(() => listMedicines(), [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== search) {
      setSearch(q)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    let rows = medicines ?? []
    if (term) {
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.brand.toLowerCase().includes(term) ||
          m.strength.toLowerCase().includes(term),
      )
    }
    if (category !== 'all') rows = rows.filter((m) => m.category === category)
    if (availability !== 'all') rows = rows.filter((m) => m.availability === availability)

    const { key, direction } = sort
    return [...rows].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      return direction === 'asc' ? cmp : -cmp
    })
  }, [medicines, debouncedSearch, category, availability, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setModal('create')
  }

  const openEdit = (medicine) => {
    setForm({
      ...EMPTY_FORM,
      name: medicine.name,
      brand: medicine.brand,
      strength: medicine.strength,
      dosageForm: medicine.dosageForm,
      packSize: medicine.packSize,
      category: medicine.category,
      unitPrice: String(medicine.unitPrice),
      reorderLevel: String(medicine.reorderLevel),
      supplier: medicine.supplier ?? '',
      batchNumber: '',
    })
    setErrors({})
    setModal({ type: 'edit', id: medicine.id })
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      if (modal?.type === 'edit') {
        await updateMedicine(modal.id, form)
        toast(`${form.name} updated.`, { type: 'success' })
      } else {
        await createMedicine(form)
        toast(`${form.name} added to the catalog.`, { type: 'success' })
      }
      setModal(null)
      reload()
    } catch (err) {
      toast(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const confirmRemoval = async () => {
    try {
      await deleteMedicine(confirmDelete.id)
      toast(`${confirmDelete.name} removed from the catalog.`, { type: 'success' })
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast(err.message, { type: 'error' })
    }
  }

  const clearFilters = () => {
    setPage(1)
    setSearch('')
    setCategory('all')
    setAvailability('all')
    setSearchParams({})
  }

  const columns = [
    {
      key: 'name',
      header: 'Medicine',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-slate-800">
            <span className="truncate">{row.name}</span>
            {row.requiresPrescription ? (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Prescription only" />
            ) : null}
          </p>
          <p className="text-xs text-app-muted">{row.brand}</p>
        </div>
      ),
    },
    { key: 'strength', header: 'Strength', sortable: true },
    { key: 'dosageForm', header: 'Form', sortable: true },
    { key: 'category', header: 'Category', sortable: true, render: (row) => <span className="text-slate-600">{row.category}</span> },
    { key: 'packSize', header: 'Pack size', className: 'hidden lg:table-cell' },
    {
      key: 'unitPrice',
      header: 'Unit price',
      align: 'right',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-800">{formatCurrency(row.unitPrice)}</span>,
    },
    {
      key: 'availableQuantity',
      header: 'Available',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{formatNumber(row.availableQuantity)}</p>
          <p className="text-[11px] text-app-muted">reorder {row.reorderLevel}</p>
        </div>
      ),
    },
    {
      key: 'availability',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.availability} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        permissions.manageCatalog ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmDelete(row)}
              aria-label={`Delete ${row.name}`}
            >
              <span className="sr-only sm:not-sr-only">Delete</span>
            </Button>
          </div>
        ) : (
          <span className="text-xs text-app-muted">View only</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Helmet title="Medicine Catalog" description="Search and manage the medicine catalog." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-600 uppercase">
            Catalog
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Medicine catalog
          </h2>
          <p className="mt-0.5 text-sm text-app-muted">
            {medicines?.length ?? 0} sample SKUs across {MEDICINE_CATEGORIES.length} categories.
          </p>
        </div>
        {permissions.manageCatalog ? (
          <Button icon={Plus} onClick={openCreate}>
            Add Medicine
          </Button>
        ) : (
          <span className="neu-soft rounded-xl px-3.5 py-2 text-xs font-medium text-app-muted">
            Catalog editing requires an administrator or distributor role.
          </span>
        )}
      </div>

      <DemoBanner icon={Beaker}>
        Demo medicines are fictional records created for interface development. They do not represent
        real products, stock levels, or pricing.
      </DemoBanner>

      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              label="Search medicines"
              name="catalog-search"
              icon={Search}
              placeholder="Search by name, brand or strength"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select
              label="Category"
              name="category-filter"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All categories</option>
              {MEDICINE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              label="Availability"
              name="availability-filter"
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">Any availability</option>
              <option value="In stock">In stock</option>
              <option value="Low stock">Low stock</option>
              <option value="Out of stock">Out of stock</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-app-muted">
            <p>
              {filtered.length} matching {filtered.length === 1 ? 'medicine' : 'medicines'}
              {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
            </p>
            {search || category !== 'all' || availability !== 'all' ? (
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
            emptyIcon={Pill}
            emptyTitle="No medicines match your filters"
            emptyDescription="Try a different search term or clear the filters to see the full catalog."
          />
        )}
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.type === 'edit' ? 'Edit medicine' : 'Add medicine'}
        description={
          modal?.type === 'edit'
            ? 'Update catalog details for this SKU.'
            : 'Create a new catalog entry and optionally open its first batch.'
        }
        icon={modal?.type === 'edit' ? Pencil : PackagePlus}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button form="medicine-form" type="submit" loading={saving}>
              {modal?.type === 'edit' ? 'Save changes' : 'Add medicine'}
            </Button>
          </>
        }
      >
        <form id="medicine-form" onSubmit={submit} noValidate>
          <MedicineForm form={form} setForm={setForm} errors={errors} />
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete medicine"
        size="sm"
        icon={Trash2}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemoval}>
              Delete medicine
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-700">
          Remove <span className="font-semibold text-slate-900">{confirmDelete?.name}</span> from the catalog? This
          hides the medicine from new orders while keeping historical orders and invoices intact.
        </p>
      </Modal>
    </div>
  )
}

export default Medicines