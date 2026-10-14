import api, { simulateLatency, withFallback } from './api'
import { pushActivity, recalculateMedicine, store } from '../data/mockStore'

const normalise = (medicine) => ({
  ...medicine,
  availability:
    medicine.availableQuantity <= 0
      ? 'Out of stock'
      : medicine.availableQuantity <= medicine.reorderLevel
        ? 'Low stock'
        : 'In stock',
})

export const listMedicines = async () =>
  withFallback(
    async () => simulateLatency(store.medicines.map(normalise), 500),
    async () => {
      const { data } = await api.get('/medicines')
      return data
    },
  )

export const createMedicine = async (payload) =>
  withFallback(
    async () => {
      const medicine = recalculateMedicine({
        id: `MED-${String(store.medicines.length + 1).padStart(3, '0')}`,
        batches: payload.batchNumber
          ? [
              {
                id: `BATCH-${Date.now()}`,
                batchNumber: payload.batchNumber,
                expiryDate: payload.expiryDate,
                quantity: Number(payload.quantity) || 0,
                supplier: payload.supplier || 'Unassigned',
                receivedDate: new Date().toISOString().slice(0, 10),
                costPrice: Number(payload.costPrice) || Number(payload.unitPrice) * 0.78,
              },
            ]
          : [],
        availableQuantity: 0,
        primaryExpiryDate: payload.expiryDate || null,
        requiresPrescription: ['Antibiotic', 'Oncology'].includes(payload.category),
        isSample: true,
        ...payload,
        unitPrice: Number(payload.unitPrice),
        reorderLevel: Number(payload.reorderLevel),
      })
      if (medicine.batches[0]) medicine.availableQuantity = medicine.batches[0].quantity
      recalculateMedicine(medicine)
      store.medicines.unshift(medicine)
      pushActivity({
        type: 'inventory',
        title: `New medicine added: ${medicine.name}`,
        detail: `${medicine.brand} - ${medicine.strength}`,
        actor: 'Current user',
      })
      return simulateLatency(normalise(medicine), 450)
    },
    async () => {
      const { data } = await api.post('/medicines', payload)
      return data
    },
  )

export const updateMedicine = async (id, payload) =>
  withFallback(
    async () => {
      const index = store.medicines.findIndex((m) => m.id === id)
      if (index === -1) {
        return Promise.reject(
          Object.assign(new Error('Medicine not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      store.medicines[index] = recalculateMedicine({
        ...store.medicines[index],
        ...payload,
        unitPrice: Number(payload.unitPrice ?? store.medicines[index].unitPrice),
        reorderLevel: Number(payload.reorderLevel ?? store.medicines[index].reorderLevel),
      })
      pushActivity({
        type: 'inventory',
        title: `Medicine updated: ${store.medicines[index].name}`,
        detail: 'Catalog details were edited',
        actor: 'Current user',
      })
      return simulateLatency(normalise(store.medicines[index]), 450)
    },
    async () => {
      const { data } = await api.put(`/medicines/${id}`, payload)
      return data
    },
  )

export const deleteMedicine = async (id) =>
  withFallback(
    async () => {
      const index = store.medicines.findIndex((m) => m.id === id)
      if (index !== -1) {
        pushActivity({
          type: 'inventory',
          title: `Medicine removed: ${store.medicines[index].name}`,
          detail: 'Catalog entry deleted',
          actor: 'Current user',
        })
        store.medicines.splice(index, 1)
      }
      return simulateLatency({ ok: true }, 400)
    },
    async () => {
      const { data } = await api.delete(`/medicines/${id}`)
      return data
    },
  )

export const getMedicine = async (id) =>
  withFallback(
    async () => {
      const medicine = store.medicines.find((m) => m.id === id)
      if (!medicine) {
        return Promise.reject(
          Object.assign(new Error('Medicine not found.'), { name: 'ApiError', status: 404 }),
        )
      }
      return simulateLatency(normalise(medicine), 300)
    },
    async () => {
      const { data } = await api.get(`/medicines/${id}`)
      return data
    },
  )

const medicineService = {
  listMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getMedicine,
}
export default medicineService