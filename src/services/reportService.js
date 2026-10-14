import { store } from '../data/mockStore'
import { daysAgo } from '../data/mockData'

const round = (n) => Math.round(n)

/**
 * Derives the Reports page aggregates from the in-memory demo store.
 * With a real backend this logic moves to Flask (or is served from
 * GET /analytics/reports) and this file is no longer needed.
 */
export const buildReports = () => {
  const { orders, medicines, salesSeries } = store
  const delivered = orders.filter((o) => o.status === 'Delivered' || o.status === 'Shipped')

  const unitsByMedicine = {}
  const revenueByMedicine = {}
  delivered.forEach((order) => {
    order.items.forEach((item) => {
      unitsByMedicine[item.medicineId] = (unitsByMedicine[item.medicineId] || 0) + item.quantity
      revenueByMedicine[item.medicineId] =
        (revenueByMedicine[item.medicineId] || 0) + item.lineTotal
    })
  })

  const topSelling = Object.entries(unitsByMedicine)
    .map(([medicineId, units]) => {
      const medicine = medicines.find((m) => m.id === medicineId)
      return {
        medicineId,
        name: medicine ? `${medicine.name} ${medicine.strength}` : medicineId,
        brand: medicine?.brand ?? '-',
        category: medicine?.category ?? '-',
        units,
        revenue: round(revenueByMedicine[medicineId] || 0),
      }
    })
    .sort((a, b) => b.units - a.units)

  const batches = medicines.flatMap((m) =>
    m.batches.map((b) => ({
      medicineId: m.id,
      name: `${m.name} ${m.strength}`,
      batchNumber: b.batchNumber,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
      supplier: b.supplier,
      costValue: round(b.quantity * b.costPrice),
      retailValue: round(b.quantity * m.unitPrice),
    })),
  )

  const expiryRisk = batches
    .map((b) => ({
      ...b,
      daysToExpiry: Math.round((new Date(b.expiryDate).getTime() - Date.now()) / 86400000),
    }))
    .filter((b) => b.daysToExpiry <= 120)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

  const inventoryValue = batches.reduce((s, b) => s + b.costValue, 0)
  const retailValue = batches.reduce((s, b) => s + b.retailValue, 0)

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const categoryValue = batches.reduce((acc, b) => {
    const medicine = medicines.find((m) => m.id === b.medicineId)
    const category = medicine?.category ?? 'Other'
    acc[category] = (acc[category] || 0) + b.costValue
    return acc
  }, {})

  const nearExpiryValue = expiryRisk.reduce((s, b) => s + b.costValue, 0)

  const movementTrend = salesSeries['30d'].slice(-14).map((row) => ({
    date: row.date,
    outbound: -Math.round(row.units * 0.62),
    inbound: Math.round(row.units * 0.48),
  }))

  return {
    salesTrend: salesSeries['90d'].filter((_, i) => i % 3 === 0).map((row) => ({
      date: row.date,
      revenue: row.revenue,
      orders: row.orders,
      units: row.units,
    })),
    orderVolume: Object.entries(statusCounts).map(([status, value]) => ({ status, value })),
    topSelling,
    inventoryValuation: {
      totalValue: inventoryValue,
      retailValue,
      potentialMargin: round(retailValue - inventoryValue),
      batchCount: batches.length,
      categoryBreakdown: Object.entries(categoryValue)
        .map(([category, value]) => ({ category, value: round(value) }))
        .sort((a, b) => b.value - a.value),
    },
    stockMovement: {
      series: movementTrend,
      recent: store.movements.slice(0, 10),
    },
    expiryRisk: {
      rows: expiryRisk,
      totalValueAtRisk: nearExpiryValue,
      expiredValue: batches
        .filter((b) => new Date(b.expiryDate).getTime() < Date.now())
        .reduce((s, b) => s + b.costValue, 0),
    },
    kpis: {
      revenue30d: salesSeries['30d'].reduce((s, r) => s + r.revenue, 0),
      orders30d: salesSeries['30d'].reduce((s, r) => s + r.orders, 0),
      units30d: salesSeries['30d'].reduce((s, r) => s + r.units, 0),
      avgOrderValue: round(
        salesSeries['30d'].reduce((s, r) => s + r.revenue, 0) /
          Math.max(1, salesSeries['30d'].reduce((s, r) => s + r.orders, 0)),
      ),
      batchCoverageDays: 42,
      generatedAt: daysAgo(0),
    },
  }
}

export default buildReports