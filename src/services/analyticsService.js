import api, { simulateLatency, withFallback } from './api'
import { store } from '../data/mockStore'
import { buildReports } from './reportService'

export const listInvoices = async () =>
  withFallback(
    async () => simulateLatency(store.invoices, 450),
    async () => {
      const { data } = await api.get('/invoices')
      return data
    },
  )

export const recordPayment = async (invoiceId) =>
  withFallback(
    async () => {
      const invoice = store.invoices.find((i) => i.id === invoiceId)
      if (!invoice) {
        return Promise.reject(
          Object.assign(new Error('Invoice not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      invoice.paymentStatus = 'Paid'
      invoice.paidOn = new Date().toISOString().slice(0, 10)
      return simulateLatency(invoice, 450)
    },
    async () => {
      const { data } = await api.post(`/invoices/${invoiceId}/payment`)
      return data
    },
  )

/** Invoice payload for the printable / downloadable invoice view. */
export const getInvoiceDetail = async (invoiceId) =>
  withFallback(
    async () => {
      const invoice = store.invoices.find((i) => i.id === invoiceId)
      if (!invoice) {
        return Promise.reject(
          Object.assign(new Error('Invoice not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      const order = store.orders.find((o) => o.id === invoice.orderId)
      return simulateLatency(
        {
          ...invoice,
          items: order?.items ?? [],
          retailerRecord: store.retailers.find((r) => r.name === invoice.retailer) ?? null,
          warehouse: order?.warehouse ?? 'Chennai Central WH',
        },
        300,
      )
    },
    async () => {
      const { data } = await api.get(`/invoices/${invoiceId}`)
      return data
    },
  )

export const getDashboardData = async () =>
  withFallback(
    async () => {
      const orders = store.orders
      const insights = store.aiInsights
      const medicines = store.medicines
      const nearExpiry = insights.expiryRisk
      const lowStock = medicines.filter((m) => m.availableQuantity <= m.reorderLevel)

      return simulateLatency(
        {
          stats: {
            totalMedicines: medicines.length,
            pendingOrders: orders.filter((o) => o.status === 'Pending').length,
            lowStockMedicines: lowStock.length,
            nearExpiryBatches: nearExpiry.length,
          },
          sales: store.salesSeries,
          recentOrders: orders.slice(0, 6),
          lowStock: lowStock
            .slice(0, 6)
            .map((m) => ({
              id: m.id,
              name: `${m.name} ${m.strength}`,
              brand: m.brand,
              quantity: m.availableQuantity,
              reorderLevel: m.reorderLevel,
            })),
          insights: {
            recommendations: insights.recommendations.slice(0, 3),
            stockoutRisk: insights.stockoutRisk.slice(0, 3),
            disclaimer: insights.disclaimer,
          },
          activity: store.activity.slice(0, 6),
          notifications: store.notifications,
        },
        650,
      )
    },
    async () => {
      const { data } = await api.get('/analytics/dashboard')
      return data
    },
  )

export const getAIInsights = async (horizon = 7) =>
  withFallback(
    async () => {
      const insights = store.aiInsights
      const factor = horizon === 30 ? 4 : 1
      return simulateLatency(
        {
          ...insights,
          horizon,
          model: { ...insights.model, horizonDays: horizon },
          demandForecast: insights.demandForecast.map((row) => ({
            ...row,
            predicted: row.predicted * factor,
            actual: row.actual * factor,
          })),
        },
        700,
      )
    },
    async () => {
      const { data } = await api.get('/analytics/forecast', { params: { horizon } })
      return data
    },
  )

export const getReports = async () =>
  withFallback(
    async () => simulateLatency(buildReports(), 700),
    async () => {
      const { data } = await api.get('/analytics/reports')
      return data
    },
  )

const analyticsService = { getDashboardData, getAIInsights, getReports }
export default analyticsService