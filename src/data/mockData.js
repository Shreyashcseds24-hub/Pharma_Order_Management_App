/**
 * DEMO DATA LAYER
 *
 * All records here are fictional sample data used while the Flask backend is not
 * connected. Nothing in this file should be treated as real pharmacy stock, real
 * prices, or output of a real forecasting model.
 */

const NOW = new Date()

const iso = (date) => date.toISOString().slice(0, 10)

export const daysFromNow = (days) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return iso(d)
}

export const daysAgo = (days) => daysFromNow(-days)

/* ------------------------------------------------------------------ */
/* Medicines                                                           */
/* ------------------------------------------------------------------ */

const medicineSeed = [
  ['Paracetamol', 'Panadol', '500 mg', 'Tablet', '10 tablets x 10 strips', 'Analgesic', 1.85, 'MedCore Distributors'],
  ['Amoxicillin', 'Moxicip', '500 mg', 'Capsule', '10 capsules x 10 strips', 'Antibiotic', 4.4, 'Sunrise Pharma Ltd.'],
  ['Ibuprofen', 'Brufen', '400 mg', 'Tablet', '10 tablets x 10 strips', 'Analgesic', 2.15, 'Sunrise Pharma Ltd.'],
  ['Cetirizine', 'Zyrtec', '10 mg', 'Tablet', '10 tablets x 10 strips', 'Antihistamine', 1.6, 'Vertex Generics'],
  ['Azithromycin', 'Azithral', '500 mg', 'Tablet', '6 tablets x 5 strips', 'Antibiotic', 6.9, 'MedCore Distributors'],
  ['Metformin', 'Glycomet', '500 mg', 'Tablet', '10 tablets x 10 strips', 'Antidiabetic', 2.75, 'BlueLife Pharmaceuticals'],
  ['Amlodipine', 'Amlokind', '5 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 3.2, 'Aster Health Supply'],
  ['Atorvastatin', 'Atorva', '10 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 4.95, 'Aster Health Supply'],
  ['Omeprazole', 'Prilosec', '20 mg', 'Capsule', '10 capsules x 10 strips', 'Gastrointestinal', 3.4, 'Vertex Generics'],
  ['Pantoprazole', 'Pan-40', '40 mg', 'Tablet', '10 tablets x 10 strips', 'Gastrointestinal', 3.85, 'Vertex Generics'],
  ['Montelukast', 'Montek', '10 mg', 'Tablet', '10 tablets x 5 strips', 'Respiratory', 8.6, 'CuraNova India'],
  ['Salbutamol', 'Ventolin', '100 mcg', 'Inhaler', '1 inhaler x 200 doses', 'Respiratory', 118.0, 'CuraNova India'],
  ['Budesonide', 'Pulmicort', '0.5 mg/2 ml', 'Inhaler', '1 inhaler x 20 respules', 'Respiratory', 214.5, 'CuraNova India'],
  ['Loratadine', 'Loratadine', '10 mg', 'Tablet', '10 tablets x 10 strips', 'Antihistamine', 1.35, 'Vertex Generics'],
  ['Dextromethorphan', 'Robitussin DM', '15 mg/5 ml', 'Syrup', '100 ml bottle', 'Respiratory', 42.0, 'BlueLife Pharmaceuticals'],
  ['Ondansetron', 'Emeset', '4 mg/2 ml', 'Injection', '5 ampoules x 2 ml', 'Gastrointestinal', 34.5, 'BlueLife Pharmaceuticals'],
  ['Ceftriaxone', 'Monocef', '1 g', 'Injection', '1 vial x 10 vials', 'Antibiotic', 96.0, 'MedCore Distributors'],
  ['Prednisolone', 'Deltasone', '10 mg', 'Tablet', '10 tablets x 10 strips', 'Respiratory', 4.1, 'Sunrise Pharma Ltd.'],
  ['Levocetirizine', 'Xyzal', '5 mg', 'Tablet', '10 tablets x 10 strips', 'Antihistamine', 2.05, 'Vertex Generics'],
  ['Losartan', 'Losar', '50 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 3.6, 'Aster Health Supply'],
  ['Clopidogrel', 'Clopilet', '75 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 5.4, 'Aster Health Supply'],
  ['Insulin Glargine', 'Basalog', '100 IU/ml', 'Injection', '3 pens x 3 ml', 'Antidiabetic', 842.0, 'CuraNova India'],
  ['Metronidazole', 'Flagyl', '400 mg', 'Tablet', '10 tablets x 10 strips', 'Antibiotic', 2.9, 'MedCore Distributors'],
  ['Ciprofloxacin', 'Cipro', '500 mg', 'Tablet', '10 tablets x 10 strips', 'Antibiotic', 5.05, 'MedCore Distributors'],
  ['Doxycycline', 'Vibramycin', '100 mg', 'Capsule', '10 capsules x 10 strips', 'Antibiotic', 4.75, 'MedCore Distributors'],
  ['Vitamin D3', 'Calcirol', '1000 IU', 'Capsule', '10 capsules x 10 strips', 'Vitamins & Supplements', 3.25, 'Vertex Generics'],
  ['Vitamin B12', 'Methycobal', '1500 mcg', 'Tablet', '10 tablets x 10 strips', 'Vitamins & Supplements', 2.95, 'Vertex Generics'],
  ['Calcium Carbonate', 'Shelcal', '500 mg', 'Tablet', '15 tablets x 10 strips', 'Vitamins & Supplements', 2.4, 'Vertex Generics'],
  ['Ferrous Sulphate', 'Orofer XT', '325 mg', 'Tablet', '10 tablets x 10 strips', 'Vitamins & Supplements', 1.75, 'Sunrise Pharma Ltd.'],
  ['Folic Acid', 'Folvite', '5 mg', 'Tablet', '10 tablets x 10 strips', 'Vitamins & Supplements', 1.2, 'Sunrise Pharma Ltd.'],
  ['Clotrimazole', 'Canesten', '1%', 'Ointment', '20 g tube', 'Dermatology', 38.0, 'BlueLife Pharmaceuticals'],
  ['Betamethasone', 'Betnovate', '0.1%', 'Ointment', '20 g tube', 'Dermatology', 41.5, 'BlueLife Pharmaceuticals'],
  ['Mometasone', 'Elocon', '0.1%', 'Ointment', '15 g tube', 'Dermatology', 62.0, 'CuraNova India'],
  ['Normal Saline', 'NS 0.9%', '500 ml', 'Drops', '1 bottle x 500 ml', 'Respiratory', 28.0, 'BlueLife Pharmaceuticals'],
  ['Oral Rehydration Salts', 'Electral', '21.8 g', 'Drops', '1 sachet x 10 sachets', 'Gastrointestinal', 22.5, 'Sunrise Pharma Ltd.'],
  ['Oncologist - Imatinib', 'Glivec', '400 mg', 'Tablet', '10 tablets x 3 strips', 'Oncology', 1280.0, 'CuraNova India'],
  ['Allopurinol', 'Zyloprim', '100 mg', 'Tablet', '10 tablets x 10 strips', 'Respiratory', 2.05, 'Vertex Generics'],
  ['Levothyroxine', 'Eltroxin', '50 mcg', 'Tablet', '10 tablets x 10 strips', 'Respiratory', 3.6, 'BlueLife Pharmaceuticals'],
  ['Isosorbide Mononitrate', 'Imdur', '30 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 3.35, 'Aster Health Supply'],
  ['Ramipril', 'Cardilol', '2.5 mg', 'Tablet', '10 tablets x 10 strips', 'Cardiovascular', 2.55, 'Aster Health Supply'],
]

const STOCK_SHAPE = [
  { batches: 3, stock: 1840, reorder: 400 },
  { batches: 2, stock: 620, reorder: 300 },
  { batches: 4, stock: 96, reorder: 250 },
  { batches: 2, stock: 1420, reorder: 350 },
  { batches: 2, stock: 78, reorder: 200 },
  { batches: 3, stock: 760, reorder: 300 },
  { batches: 2, stock: 1205, reorder: 300 },
  { batches: 3, stock: 214, reorder: 250 },
  { batches: 2, stock: 980, reorder: 250 },
  { batches: 2, stock: 430, reorder: 200 },
  { batches: 2, stock: 62, reorder: 150 },
  { batches: 3, stock: 148, reorder: 120 },
  { batches: 2, stock: 88, reorder: 100 },
  { batches: 2, stock: 1340, reorder: 300 },
  { batches: 2, stock: 310, reorder: 150 },
  { batches: 2, stock: 46, reorder: 120 },
  { batches: 2, stock: 268, reorder: 150 },
  { batches: 2, stock: 715, reorder: 200 },
  { batches: 2, stock: 1090, reorder: 300 },
  { batches: 3, stock: 130, reorder: 200 },
  { batches: 2, stock: 540, reorder: 200 },
  { batches: 2, stock: 34, reorder: 80 },
  { batches: 2, stock: 690, reorder: 250 },
  { batches: 2, stock: 420, reorder: 200 },
  { batches: 2, stock: 585, reorder: 220 },
  { batches: 3, stock: 240, reorder: 200 },
  { batches: 2, stock: 1560, reorder: 400 },
  { batches: 2, stock: 880, reorder: 300 },
  { batches: 3, stock: 118, reorder: 200 },
  { batches: 2, stock: 2240, reorder: 400 },
  { batches: 2, stock: 905, reorder: 250 },
  { batches: 2, stock: 372, reorder: 180 },
  { batches: 2, stock: 240, reorder: 150 },
  { batches: 2, stock: 164, reorder: 120 },
  { batches: 2, stack: 6, stock: 205, reorder: 150 },
  { batches: 2, stock: 41, reorder: 150 },
  { batches: 2, stock: 640, reorder: 200 },
  { batches: 2, stock: 29, reorder: 60 },
  { batches: 2, stock: 498, reorder: 200 },
  { batches: 2, stock: 826, reorder: 220 },
  { batches: 2, stock: 352, reorder: 180 },
  { batches: 2, stock: 294, reorder: 150 },
]

const EXPIRY_OFFSETS = [
  [220, 405, 610],
  [150, 330],
  [28, 74, 190],
  [260, 480],
  [16, 55, 240],
  [190, 355, 520],
  [310, 470],
  [41, 96],
  [205, 430],
  [275, 505],
  [22, 68, 300],
  [360, 540],
  [12, 88, 210],
  [240, 450],
  [180, 395],
  [58, 160],
  [300, 520],
  [265, 480],
  [230, 425],
  [33, 120],
  [345, 560],
  [420, 640],
  [155, 340],
  [200, 410],
  [140, 305],
  [290, 495],
  [370, 580],
  [255, 460],
  [320, 540],
  [360, 600],
  [190, 380],
  [165, 350],
  [245, 470],
  [410, 600],
  [210, 430],
  [270, 505],
  [600, 820],
  [285, 490],
  [310, 540],
  [225, 455],
  [200, 420],
]

let batchCounter = 4200

export const medicines = medicineSeed.map((item, index) => {
  const [name, brand, strength, dosageForm, packSize, category, unitPrice, supplier] = item
  const shape = STOCK_SHAPE[index] || { batches: 2, stock: 400, reorder: 150 }
  const offsets = EXPIRY_OFFSETS[index] || [200, 400]
  const perBatch = Math.max(1, Math.round(shape.stock / Math.max(shape.batches, 1)))

  const batches = Array.from({ length: Math.max(shape.batches, offsets.length) }, (_, b) => {
    batchCounter += 1
    const offset = offsets[b % offsets.length] + b * 11
    const isNearExpiry = offset <= 90
    return {
      id: `BATCH-${batchCounter}`,
      batchNumber: `MF${String(2400 + batchCounter).slice(-4)}`,
      expiryDate: daysFromNow(offset),
      quantity: isNearExpiry ? Math.round(perBatch * 0.35) : perBatch,
      supplier,
      receivedDate: daysAgo(30 + b * 21),
      costPrice: Number((unitPrice * 0.78).toFixed(2)),
    }
  })

  const availableQuantity = batches.reduce((sum, b) => sum + b.quantity, 0)

  return {
    id: `MED-${String(index + 1).padStart(3, '0')}`,
    name,
    brand,
    strength,
    dosageForm,
    packSize,
    category,
    unitPrice,
    supplier,
    reorderLevel: shape.reorder,
    batches,
    availableQuantity,
    primaryExpiryDate: batches.reduce(
      (min, b) => (b.expiryDate < min ? b.expiryDate : min),
      batches[0].expiryDate,
    ),
    requiresPrescription: ['Antibiotic', 'Oncology'].includes(category),
    isSample: true,
  }
})

/* ------------------------------------------------------------------ */
/* Inventory ledger (derived stock movement)                           */
/* ------------------------------------------------------------------ */

export const stockMovements = [
  { id: 'MOV-1', date: daysAgo(1), medicineId: 'MED-001', medicine: 'Paracetamol 500 mg', type: 'Outbound', quantity: -240, reference: 'ORD-2041', user: 'System (order fulfilment)' },
  { id: 'MOV-2', date: daysAgo(1), medicineId: 'MED-012', medicine: 'Salbutamol Inhaler', type: 'Inbound', quantity: 120, reference: 'GRN-882', user: 'K. Iyer' },
  { id: 'MOV-3', date: daysAgo(2), medicineId: 'MED-003', medicine: 'Ibuprofen 400 mg', type: 'Adjustment', quantity: -12, reference: 'ADJ-114', user: 'R. Menon (damaged units)' },
  { id: 'MOV-4', date: daysAgo(2), medicineId: 'MED-022', medicine: 'Insulin Glargine', type: 'Outbound', quantity: -36, reference: 'ORD-2038', user: 'System (order fulfilment)' },
  { id: 'MOV-5', date: daysAgo(3), medicineId: 'MED-008', medicine: 'Atorvastatin 10 mg', type: 'Outbound', quantity: -180, reference: 'ORD-2036', user: 'System (order fulfilment)' },
  { id: 'MOV-6', date: daysAgo(3), medicineId: 'MED-015', medicine: 'Dextromethorphan Syrup', type: 'Return', quantity: 24, reference: 'RET-041', user: 'S. Rao' },
  { id: 'MOV-7', date: daysAgo(4), medicineId: 'MED-005', medicine: 'Azithromycin 500 mg', type: 'Outbound', quantity: -96, reference: 'ORD-2033', user: 'System (order fulfilment)' },
  { id: 'MOV-8', date: daysAgo(5), medicineId: 'MED-027', medicine: 'Vitamin D3 1000 IU', type: 'Inbound', quantity: 500, reference: 'GRN-879', user: 'K. Iyer' },
  { id: 'MOV-9', date: daysAgo(6), medicineId: 'MED-035', medicine: 'Normal Saline 500 ml', type: 'Outbound', quantity: -210, reference: 'ORD-2029', user: 'System (order fulfilment)' },
  { id: 'MOV-10', date: daysAgo(7), medicineId: 'MED-013', medicine: 'Budesonide Inhaler', type: 'Outbound', quantity: -40, reference: 'ORD-2025', user: 'System (order fulfilment)' },
]

/* ------------------------------------------------------------------ */
/* Retailers                                                           */
/* ------------------------------------------------------------------ */

export const retailers = [
  { id: 'RTL-01', name: 'Apex Medical Retail', city: 'Chennai', contact: 'S. Balaji', phone: '+91 98400 11223' },
  { id: 'RTL-02', name: 'NovaCare Pharmacy Chain', city: 'Bengaluru', contact: 'P. Nandini', phone: '+91 99000 55412' },
  { id: 'RTL-03', name: 'Sunrise Drugstore', city: 'Coimbatore', contact: 'M. Arun', phone: '+91 97400 88310' },
  { id: 'RTL-04', name: 'GreenLeaf Pharmacy', city: 'Madurai', contact: 'T. Kavitha', phone: '+91 93800 66125' },
  { id: 'RTL-05', name: 'CityCare Medical Outlet', city: 'Trichy', contact: 'R. Selvam', phone: '+91 96770 23004' },
  { id: 'RTL-06', name: 'Sanjeevani Health Mart', city: 'Salem', contact: 'A. Divya', phone: '+91 90000 47718' },
  { id: 'RTL-07', name: 'Lotus Wellness Stores', city: 'Pondicherry', contact: 'V. Kumar', phone: '+91 94420 33990' },
  { id: 'RTL-08', name: 'MedPlus Junction', city: 'Chennai', contact: 'D. Farah', phone: '+91 90030 71145' },
]

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

const orderSeed = [
  ['ORD-2041', 'Apex Medical Retail', 1, 6, 'Delivered', 48620],
  ['ORD-2040', 'NovaCare Pharmacy Chain', 0, 11, 'Shipped', 214580],
  ['ORD-2039', 'GreenLeaf Pharmacy', 2, 4, 'Processing', 36840],
  ['ORD-2038', 'Sunrise Drugstore', 1, 9, 'Shipped', 412960],
  ['ORD-2037', 'CityCare Medical Outlet', 3, 3, 'Approved', 12450],
  ['ORD-2036', 'MedPlus Junction', 0, 14, 'Delivered', 289340],
  ['ORD-2035', 'Sanjeevani Health Mart', 1, 7, 'Pending', 97230],
  ['ORD-2034', 'Lotus Wellness Stores', 4, 5, 'Pending', 63880],
  ['ORD-2033', 'Apex Medical Retail', 1, 8, 'Delivered', 154720],
  ['ORD-2032', 'NovaCare Pharmacy Chain', 2, 6, 'Cancelled', 31290],
  ['ORD-2031', 'GreenLeaf Pharmacy', 3, 10, 'Delivered', 187450],
  ['ORD-2030', 'Sunrise Drugstore', 5, 4, 'Delivered', 27680],
  ['ORD-2029', 'CityCare Medical Outlet', 6, 12, 'Delivered', 241800],
  ['ORD-2028', 'MedPlus Junction', 8, 5, 'Delivered', 74320],
  ['ORD-2027', 'Sanjeevani Health Mart', 9, 7, 'Delivered', 118960],
  ['ORD-2026', 'Lotus Wellness Stores', 11, 6, 'Delivered', 88410],
  ['ORD-2025', 'Apex Medical Retail', 12, 8, 'Delivered', 196230],
  ['ORD-2024', 'NovaCare Pharmacy Chain', 14, 5, 'Delivered', 66370],
  ['ORD-2023', 'GreenLeaf Pharmacy', 16, 9, 'Delivered', 163740],
  ['ORD-2022', 'Sunrise Drugstore', 18, 6, 'Delivered', 104250],
  ['ORD-2021', 'CityCare Medical Outlet', 20, 7, 'Delivered', 129380],
  ['ORD-2020', 'MedPlus Junction', 22, 8, 'Delivered', 171620],
  ['ORD-2019', 'Sanjeevani Health Mart', 24, 5, 'Delivered', 79240],
  ['ORD-2018', 'Lotus Wellness Stores', 26, 6, 'Delivered', 94870],
]

const STATUS_EVENTS = {
  Pending: ['Order placed'],
  Approved: ['Order placed', 'Approved by distributor'],
  Processing: ['Order placed', 'Approved by distributor', 'Picking started'],
  Shipped: ['Order placed', 'Approved by distributor', 'Picking started', 'Dispatched - AWB generated'],
  Delivered: ['Order placed', 'Approved by distributor', 'Picking started', 'Dispatched - AWB generated', 'Delivered and confirmed'],
  Cancelled: ['Order placed', 'Cancelled by retailer'],
}

const pickItems = (count, seedOffset) => {
  const items = []
  for (let i = 0; i < count; i += 1) {
    const med = medicines[(seedOffset + i * 3) % medicines.length]
    const quantity = 12 + ((seedOffset * 7 + i * 29) % 160)
    items.push({
      id: `ITM-${seedOffset}-${i}`,
      medicineId: med.id,
      name: `${med.name} ${med.strength}`,
      brand: med.brand,
      packSize: med.packSize,
      quantity,
      unitPrice: med.unitPrice,
      lineTotal: Number((med.unitPrice * quantity).toFixed(2)),
    })
  }
  return items
}

export const orders = orderSeed.map(
  ([id, retailerName, daysBack, itemCount, status, amount], index) => {
    const items = pickItems(itemCount, index * 5)
    return {
      id,
      retailerId: retailers.find((r) => r.name === retailerName)?.id ?? 'RTL-01',
      retailer: retailerName,
      orderDate: daysAgo(daysBack),
      status,
      items,
      itemCount: items.length,
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      totalAmount: amount,
      paymentTerms: 'Net 30',
      warehouse: index % 2 === 0 ? 'Chennai Central WH' : 'Bengaluru South WH',
      timeline: STATUS_EVENTS[status].map((label, i) => ({
        label,
        timestamp: new Date(
          new Date(daysAgo(daysBack)).setHours(9 + i * 2, (index * 13) % 60, 0, 0),
        ).toISOString(),
        done: true,
      })),
    }
  },
)

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export const invoices = orders
  .filter((o) => o.status !== 'Cancelled')
  .slice(0, 14)
  .map((order, index) => {
    const issued = new Date(order.orderDate)
    const due = new Date(issued)
    due.setDate(due.getDate() + 30)
    const paid = ['Delivered', 'Shipped'].includes(order.status)
    const overdue = !paid && due.getTime() < NOW.getTime()
    return {
      id: `INV-${9025 + index}`,
      invoiceNumber: `MF/25-26/${String(1200 + index * 7).padStart(5, '0')}`,
      orderId: order.id,
      retailer: order.retailer,
      invoiceDate: order.orderDate,
      dueDate: iso(due),
      totalAmount: order.totalAmount,
      taxAmount: Number((order.totalAmount * 0.05).toFixed(2)),
      paymentStatus: paid ? 'Paid' : overdue ? 'Overdue' : 'Pending',
      paidOn: paid ? iso(new Date(issued.getTime() + 6 * 86400000)) : null,
    }
  })

/* ------------------------------------------------------------------ */
/* Analytics: sales & order activity                                   */
/* ------------------------------------------------------------------ */

const buildSeries = (days, seedBase) =>
  Array.from({ length: days }, (_, i) => {
    const date = daysAgo(days - 1 - i)
    const dow = new Date(date).getDay()
    const weekendFactor = dow === 0 ? 0.72 : dow === 6 ? 0.85 : 1
    const trend = 1 + i * 0.011
    const noise = 0.82 + (((i * 37 + seedBase * 13) % 41) / 100)
    const revenue = Math.round(148000 * weekendFactor * trend * noise)
    const orders = Math.max(4, Math.round(revenue / 26400))
    const units = Math.round(revenue / 41.5)
    return { date, revenue, orders, units }
  })

export const salesSeries = {
  '7d': buildSeries(7, 1),
  '30d': buildSeries(30, 2),
  '90d': buildSeries(90, 3),
}

/* ------------------------------------------------------------------ */
/* Analytics: AI forecasting (DEMO / heuristic, not a trained model)   */
/* ------------------------------------------------------------------ */

const HEURISTIC_NOTE =
  'Demo heuristic (moving average + seasonality). Not produced by a trained model; will be replaced by the Python forecasting service.'

export const demandForecast = [
  { medicineId: 'MED-001', label: 'Paracetamol 500 mg', horizon: 7, predicted: 1180, actual: 1240, confidence: 82, note: HEURISTIC_NOTE },
  { medicineId: 'MED-003', label: 'Ibuprofen 400 mg', horizon: 7, predicted: 880, actual: 912, confidence: 78, note: HEURISTIC_NOTE },
  { medicineId: 'MED-008', label: 'Atorvastatin 10 mg', horizon: 7, predicted: 640, actual: 655, confidence: 74, note: HEURISTIC_NOTE },
  { medicineId: 'MED-012', label: 'Salbutamol Inhaler', horizon: 7, predicted: 210, actual: 236, confidence: 61, note: HEURISTIC_NOTE },
  { medicineId: 'MED-022', label: 'Insulin Glargine', horizon: 7, predicted: 96, actual: 88, confidence: 69, note: HEURISTIC_NOTE },
  { medicineId: 'MED-035', label: 'Normal Saline 500 ml', horizon: 7, predicted: 540, actual: 498, confidence: 77, note: HEURISTIC_NOTE },
]

const monthlyForecast = [
  { period: 'Week 1', actual: 4120, predicted: 3980 },
  { period: 'Week 2', actual: 4360, predicted: 4210 },
  { period: 'Week 3', actual: 3980, predicted: 4105 },
  { period: 'Week 4', actual: 4520, predicted: 4390 },
  { period: 'Week 5', actual: 4680, predicted: 4615 },
  { period: 'Week 6', actual: null, predicted: 4820 },
  { period: 'Week 7', actual: null, predicted: 4955 },
  { period: 'Week 8', actual: null, predicted: 5090 },
]

export const aiInsights = {
  isDemo: true,
  disclaimer:
    'These values are generated locally from sample data using a simple moving-average heuristic. They are not outputs of a trained machine-learning model.',
  model: {
    name: 'Demo heuristic v0 (mock)',
    accuracy: 87.4,
    horizonDays: 7,
    trainedOn: daysAgo(6),
    sampleSize: 8421,
  },
  monthlyForecast,
  demandForecast,
  recommendations: [
    {
      id: 'REC-1',
      medicineId: 'MED-003',
      title: 'Ibuprofen 400 mg',
      suggestedQuantity: 120,
      currentStock: 96,
      reorderLevel: 250,
      urgency: 'high',
      confidence: 84,
      reason:
        'Forecast demand is increasing (up 18% week over week) and current usable stock may be insufficient before the next replenishment cycle.',
    },
    {
      id: 'REC-2',
      medicineId: 'MED-005',
      title: 'Azithromycin 500 mg',
      suggestedQuantity: 200,
      currentStock: 78,
      reorderLevel: 200,
      urgency: 'high',
      confidence: 79,
      reason:
        'Stock is below the reorder level and seasonal respiratory infection trends historically lift demand in the next 30 days.',
    },
    {
      id: 'REC-3',
      medicineId: 'MED-022',
      title: 'Insulin Glargine',
      suggestedQuantity: 60,
      currentStock: 34,
      reorderLevel: 80,
      urgency: 'critical',
      confidence: 88,
      reason:
        'Only 34 usable units remain against an average weekly issue rate of 96 units. Stockout risk is high within 4 days.',
    },
    {
      id: 'REC-4',
      medicineId: 'MED-012',
      title: 'Salbutamol Inhaler',
      suggestedQuantity: 90,
      currentStock: 148,
      reorderLevel: 120,
      urgency: 'medium',
      confidence: 71,
      reason:
        'Respiratory demand has been consistently above the 7-day baseline and current stock sits marginally above the reorder level.',
    },
    {
      id: 'REC-5',
      medicineId: 'MED-008',
      title: 'Atorvastatin 10 mg',
      suggestedQuantity: 300,
      currentStock: 214,
      reorderLevel: 250,
      urgency: 'medium',
      confidence: 76,
      reason:
        'Chronic-therapy demand is stable and predictable; replenishing now avoids an emergency purchase with a supplier price uplift.',
    },
  ],
  stockoutRisk: [
    { medicineId: 'MED-022', name: 'Insulin Glargine', daysToStockout: 4, risk: 'critical' },
    { medicineId: 'MED-035', name: 'Normal Saline 500 ml', daysToStockout: 6, risk: 'critical' },
    { medicineId: 'MED-005', name: 'Azithromycin 500 mg', daysToStockout: 9, risk: 'high' },
    { medicineId: 'MED-016', name: 'Ondansetron Injection', daysToStockout: 12, risk: 'high' },
    { medicineId: 'MED-003', name: 'Ibuprofen 400 mg', daysToStockout: 14, risk: 'medium' },
    { medicineId: 'MED-024', name: 'Doxycycline 100 mg', daysToStockout: 18, risk: 'low' },
  ],
  expiryRisk: medicines
    .flatMap((m) =>
      m.batches
        .filter((b) => {
          const days = Math.round((new Date(b.expiryDate) - NOW) / 86400000)
          return days <= 90
        })
        .map((b) => ({
          id: b.id,
          medicineId: m.id,
          name: `${m.name} ${m.strength}`,
          batchNumber: b.batchNumber,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
          daysLeft: Math.round((new Date(b.expiryDate) - NOW) / 86400000),
          valueAtRisk: Number((b.quantity * b.costPrice).toFixed(2)),
        })),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft),
}

/* ------------------------------------------------------------------ */
/* Dashboard feed                                                      */
/* ------------------------------------------------------------------ */

export const activityFeed = [
  { id: 'ACT-1', type: 'order', title: 'Order ORD-2041 delivered', detail: 'Apex Medical Retail - 6 items', time: daysAgo(0), actor: 'System' },
  { id: 'ACT-2', type: 'inventory', title: 'Low stock alert: Ibuprofen 400 mg', detail: 'Stock fell below reorder level (96 units)', time: daysAgo(0), actor: 'Inventory monitor' },
  { id: 'ACT-3', type: 'approval', title: 'Order ORD-2037 approved', detail: 'CityCare Medical Outlet - INR 12,450', time: daysAgo(1), actor: 'K. Iyer' },
  { id: 'ACT-4', type: 'inventory', title: 'Goods received GRN-882', detail: '120 Salbutamol Inhaler units from CuraNova India', time: daysAgo(1), actor: 'K. Iyer' },
  { id: 'ACT-5', type: 'order', title: 'New order ORD-2034 received', detail: 'Lotus Wellness Stores - INR 63,880', time: daysAgo(1), actor: 'Lotus Wellness Stores' },
  { id: 'ACT-6', type: 'alert', title: 'Near-expiry batch expiring in 12 days', detail: 'Budesonide Inhaler - BATCH-4271 (88 units)', time: daysAgo(2), actor: 'Expiry monitor' },
  { id: 'ACT-7', type: 'order', title: 'Order ORD-2032 cancelled', detail: 'NovaCare Pharmacy Chain - stock unavailable', time: daysAgo(2), actor: 'P. Nandini' },
  { id: 'ACT-8', type: 'inventory', title: 'Stock adjustment ADJ-114', detail: 'Ibuprofen -12 units written off (damaged packaging)', time: daysAgo(2), actor: 'R. Menon' },
]

/* ------------------------------------------------------------------ */
/* Users (demo only)                                                   */
/* ------------------------------------------------------------------ */

export const demoUsers = [
  {
    id: 'USR-1',
    name: 'Ananya Krishnan',
    email: 'admin@mediflow.demo',
    role: 'admin',
    title: 'Head of Operations',
    initials: 'AK',
    permissions: ['catalog:write', 'inventory:write', 'orders:approve', 'reports:view', 'settings:write'],
  },
  {
    id: 'USR-2',
    name: 'Karthik Iyer',
    email: 'distributor@mediflow.demo',
    role: 'distributor',
    title: 'Distribution Manager',
    initials: 'KI',
    permissions: ['catalog:write', 'inventory:write', 'orders:approve', 'reports:view'],
  },
  {
    id: 'USR-3',
    name: 'Priya Nandini',
    email: 'retailer@mediflow.demo',
    role: 'retailer',
    title: 'NovaCare Pharmacy - Buyer',
    initials: 'PN',
    permissions: ['orders:create', 'reports:view'],
  },
]

export const notifications = [
  { id: 'N-1', title: 'Stockout risk: Insulin Glargine', detail: 'Estimated 4 days of cover remaining', time: daysAgo(0), tone: 'danger', read: false },
  { id: 'N-2', title: '8 pending orders awaiting approval', detail: 'Oldest pending for 2 days', time: daysAgo(0), tone: 'warning', read: false },
  { id: 'N-3', title: 'Invoice MF/25-26/01235 overdue', detail: 'INR 63,880 - due 6 days ago', time: daysAgo(1), tone: 'danger', read: false },
  { id: 'N-4', title: 'Weekly demand forecast ready', detail: '5 replenishment recommendations generated', time: daysAgo(1), tone: 'info', read: true },
  { id: 'N-5', title: 'Goods receipt GRN-882 completed', detail: '120 units added to Chennai Central WH', time: daysAgo(1), tone: 'success', read: true },
]