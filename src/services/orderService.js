import api, { simulateLatency, withFallback } from './api'
import { pushActivity, recalculateMedicine, store } from '../data/mockStore'

const nextOrderId = () => {
  const numbers = store.orders.map((o) => Number(o.id.split('-')[1]) || 0)
  return `ORD-${Math.max(0, ...numbers) + 1}`
}

const recomputeTotals = (order) => {
  order.items = order.items.map((item) => ({
    ...item,
    lineTotal: Number((item.unitPrice * item.quantity).toFixed(2)),
  }))
  order.itemCount = order.items.length
  order.totalQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  order.totalAmount = Number(
    order.items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2),
  )
  return order
}

export const listOrders = async () =>
  withFallback(
    async () => simulateLatency(store.orders, 500),
    async () => {
      const { data } = await api.get('/orders')
      return data
    },
  )

export const getOrder = async (id) =>
  withFallback(
    async () => {
      const order = store.orders.find((o) => o.id === id)
      if (!order) {
        return Promise.reject(
          Object.assign(new Error('Order not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      return simulateLatency(order, 250)
    },
    async () => {
      const { data } = await api.get(`/orders/${id}`)
      return data
    },
  )

const STATUS_EVENTS = {
  Pending: 'Order placed',
  Approved: 'Approved by distributor',
  Processing: 'Picking started',
  Shipped: 'Dispatched - AWB generated',
  Delivered: 'Delivered and confirmed',
  Cancelled: 'Cancelled',
}

export const updateOrderStatus = async (id, status, user) =>
  withFallback(
    async () => {
      const order = store.orders.find((o) => o.id === id)
      if (!order) {
        return Promise.reject(
          Object.assign(new Error('Order not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      order.status = status
      order.timeline = [
        ...(order.timeline || []),
        {
          label: STATUS_EVENTS[status],
          timestamp: new Date().toISOString(),
          done: true,
        },
      ]
      if (status === 'Cancelled') {
        order.items.forEach((item) => {
          const medicine = store.medicines.find((m) => m.id === item.medicineId)
          if (!medicine) return
          medicine.batches.forEach((batch, index) => {
            if (index === 0) {
              batch.quantity += item.quantity
              recalculateMedicine(medicine)
            }
          })
        })
      }
      pushActivity({
        type: status === 'Cancelled' ? 'order' : 'approval',
        title: `Order ${order.id} marked ${status.toLowerCase()}`,
        detail: `${order.retailer} - INR ${order.totalAmount.toLocaleString('en-IN')}`,
        actor: user || 'Current user',
      })
      return simulateLatency(order, 400)
    },
    async () => {
      const { data } = await api.patch(`/orders/${id}/status`, { status })
      return data
    },
  )

/** Retailer checkout flow. Validates stock and reserves it immediately. */
export const createOrder = async ({ retailer, retailerId, items, warehouse, user }) =>
  withFallback(
    async () => {
      if (!items.length) {
        return Promise.reject(
          Object.assign(new Error('Add at least one medicine to the order.'), {
            name: 'ApiError',
            status: 422,
          }),
        )
      }
      items.forEach((item) => {
        const medicine = store.medicines.find((m) => m.id === item.medicineId)
        if (!medicine) {
          throw Object.assign(new Error(`Medicine ${item.name} is no longer available.`), {
            name: 'ApiError',
            status: 422,
          })
        }
        if (medicine.availableQuantity < item.quantity) {
          throw Object.assign(
            new Error(
              `Only ${medicine.availableQuantity} units of ${medicine.name} ${medicine.strength} are in stock.`,
            ),
            { name: 'ApiError', status: 422 },
          )
        }
      })

      const order = recomputeTotals({
        id: nextOrderId(),
        retailer,
        retailerId,
        orderDate: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        items,
        warehouse,
        paymentTerms: 'Net 30',
        timeline: [{ label: 'Order placed', timestamp: new Date().toISOString(), done: true }],
      })
      order.items.forEach((item) => {
        const medicine = store.medicines.find((m) => m.id === item.medicineId)
        if (medicine?.batches[0]) {
          medicine.batches[0].quantity -= item.quantity
          medicine.batches[0].quantity = Math.max(0, medicine.batches[0].quantity)
          recalculateMedicine(medicine)
        }
      })
      store.orders.unshift(order)
      pushActivity({
        type: 'order',
        title: `New order ${order.id} placed`,
        detail: `${retailer} - ${order.itemCount} items`,
        actor: user || 'Current user',
      })
      return simulateLatency(order, 700)
    },
    async () => {
      const { data } = await api.post('/orders', { items, warehouse })
      return data
    },
  )

export const listRetailers = async () =>
  withFallback(
    async () => simulateLatency(store.retailers, 250),
    async () => {
      const { data } = await api.get('/retailers')
      return data
    },
  )

const orderService = { listOrders, getOrder, createOrder, updateOrderStatus, listRetailers }
export default orderService