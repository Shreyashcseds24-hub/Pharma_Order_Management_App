export const ROLES = {
  ADMIN: 'admin',
  DISTRIBUTOR: 'distributor',
  RETAILER: 'retailer',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.DISTRIBUTOR]: 'Distributor',
  [ROLES.RETAILER]: 'Retailer',
}

export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'Full access to catalog, inventory, orders, finances and settings.',
  [ROLES.DISTRIBUTOR]: 'Approves retailer orders, manages stock and monitors expiry risk.',
  [ROLES.RETAILER]: 'Browses the catalog, places orders and tracks deliveries.',
}

export const ORDER_STATUSES = [
  'Pending',
  'Approved',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
]

export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Overdue', 'Cancelled']

export const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Ointment',
  'Drops',
  'Inhaler',
  'Suppository',
]

export const MEDICINE_CATEGORIES = [
  'Analgesic',
  'Antibiotic',
  'Antihistamine',
  'Cardiovascular',
  'Antidiabetic',
  'Respiratory',
  'Dermatology',
  'Vitamins & Supplements',
  'Gastrointestinal',
  'Oncology',
]

export const SUPPLIERS = [
  'Sunrise Pharma Ltd.',
  'MedCore Distributors',
  'BlueLife Pharmaceuticals',
  'Aster Health Supply',
  'CuraNova India',
  'Vertex Generics',
]

export const UNITS = ['Strips', 'Boxes', 'Bottles', 'Vials']