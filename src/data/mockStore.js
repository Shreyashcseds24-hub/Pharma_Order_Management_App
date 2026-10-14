/**
 * In-memory store for demo mode.
 *
 * The Flask backend will become the source of truth. Until then, services read
 * and write here so that create/update/delete actions in the UI behave like a
 * real API without a network call.
 */

import {
  medicines as seedMedicines,
  orders as seedOrders,
  invoices as seedInvoices,
  aiInsights,
  activityFeed,
  notifications,
  retailers,
  salesSeries,
  stockMovements,
} from './mockData'

const clone = (value) => JSON.parse(JSON.stringify(value))

export const store = {
  medicines: clone(seedMedicines),
  orders: clone(seedOrders),
  invoices: clone(seedInvoices),
  activity: clone(activityFeed),
  notifications: clone(notifications),
  retailers: clone(retailers),
  movements: clone(stockMovements),
  salesSeries: clone(salesSeries),
  aiInsights: clone(aiInsights),
}

let movementSeq = 100

export const nextSequence = (key) => {
  movementSeq += 1
  return `${key}-${movementSeq}`
}

export const pushMovement = (entry) => {
  store.movements.unshift({ id: nextSequence('MOV'), date: new Date().toISOString().slice(0, 10), ...entry })
}

export const pushActivity = (entry) => {
  store.activity.unshift({
    id: nextSequence('ACT'),
    time: new Date().toISOString().slice(0, 10),
    ...entry,
  })
}

export const recalculateMedicine = (medicine) => {
  medicine.availableQuantity = medicine.batches.reduce((sum, batch) => sum + batch.quantity, 0)
  if (medicine.batches.length) {
    medicine.primaryExpiryDate = medicine.batches.reduce(
      (min, b) => (b.expiryDate < min ? b.expiryDate : min),
      medicine.batches[0].expiryDate,
    )
  }
  return medicine
}