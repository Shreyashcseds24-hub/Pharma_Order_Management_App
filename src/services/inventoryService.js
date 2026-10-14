import api, { simulateLatency, withFallback } from './api'
import { pushActivity, pushMovement, recalculateMedicine, store } from '../data/mockStore'

export const NEAR_EXPIRY_DAYS = 90

const daysUntil = (date) =>
  Math.round((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

export const stockStatus = ({ quantity, reorderLevel, expiryDate }) => {
  if (quantity <= 0) return 'Out of stock'
  if (daysUntil(expiryDate) <= NEAR_EXPIRY_DAYS) return 'Near expiry'
  if (quantity <= reorderLevel) return 'Low stock'
  return 'Healthy'
}

const buildRows = () =>
  store.medicines
    .flatMap((medicine) =>
      medicine.batches.map((batch) => ({
        id: batch.id,
        medicineId: medicine.id,
        medicine: `${medicine.name} ${medicine.strength}`,
        brand: medicine.brand,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        reorderLevel: medicine.reorderLevel,
        expiryDate: batch.expiryDate,
        daysToExpiry: daysUntil(batch.expiryDate),
        supplier: batch.supplier,
        costPrice: batch.costPrice,
        stockValue: Number((batch.quantity * batch.costPrice).toFixed(2)),
        retailValue: Number((batch.quantity * medicine.unitPrice).toFixed(2)),
        status: stockStatus({
          quantity: batch.quantity,
          reorderLevel: medicine.reorderLevel,
          expiryDate: batch.expiryDate,
        }),
        canAdjust: true,
      })),
    )
    .sort((a, b) => a.medicine.localeCompare(b.medicine) || a.batchNumber.localeCompare(b.batchNumber))

export const listInventory = async () =>
  withFallback(
    async () => simulateLatency(buildRows(), 520),
    async () => {
      const { data } = await api.get('/inventory')
      return data
    },
  )

export const getInventorySummary = async () =>
  withFallback(
    async () => {
      const rows = buildRows()
      return simulateLatency(
        {
          totalBatches: rows.length,
          totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
          inventoryValue: Number(rows.reduce((s, r) => s + r.stockValue, 0).toFixed(2)),
          lowStockCount: rows.filter((r) => r.status === 'Low stock').length,
          nearExpiryCount: rows.filter((r) => r.status === 'Near expiry').length,
          outOfStockCount: rows.filter((r) => r.status === 'Out of stock').length,
        },
        350,
      )
    },
    async () => {
      const { data } = await api.get('/inventory/summary')
      return data
    },
  )

export const listMovements = async () =>
  withFallback(
    async () => simulateLatency(store.movements, 400),
    async () => {
      const { data } = await api.get('/inventory/movements')
      return data
    },
  )

/**
 * Applies a stock adjustment to a batch. Negative resulting stock is rejected
 * both here (optimistically) and by the backend once it is connected.
 */
export const adjustStock = async ({ batchId, delta, reason, user }) =>
  withFallback(
    async () => {
      let result = null
      store.medicines.forEach((medicine) => {
        const batch = medicine.batches.find((b) => b.id === batchId)
        if (!batch) return
        const next = batch.quantity + Number(delta)
        if (next < 0) {
          throw Object.assign(
            new Error(`Adjustment rejected: only ${batch.quantity} units are on hand in this batch.`),
            { name: 'ApiError', status: 422 },
          )
        }
        batch.quantity = next
        recalculateMedicine(medicine)
        result = { medicine, batch }
      })

      if (!result) {
        return Promise.reject(
          Object.assign(new Error('Batch not found.'), { name: 'ApiError', status: 404 }),
        )
      }

      pushMovement({
        medicineId: result.medicine.id,
        medicine: `${result.medicine.name} ${result.medicine.strength}`,
        type: Number(delta) >= 0 ? 'Inbound' : 'Adjustment',
        quantity: Number(delta),
        reference: `ADJ-${String(Math.floor(Math.random() * 900) + 100)}`,
        user: user || 'Current user',
      })
      pushActivity({
        type: 'inventory',
        title: `Stock adjusted: ${result.medicine.name} ${result.medicine.strength}`,
        detail: `${delta > 0 ? '+' : ''}${delta} units - ${reason}`,
        actor: user || 'Current user',
      })

      return simulateLatency(buildRows(), 500)
    },
    async () => {
      const { data } = await api.post(`/inventory/batches/${batchId}/adjust`, { delta, reason })
      return data
    },
  )

const inventoryService = {
  listInventory,
  getInventorySummary,
  listMovements,
  adjustStock,
  stockStatus,
  NEAR_EXPIRY_DAYS,
}
export default inventoryService