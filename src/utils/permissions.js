import { ROLES } from '../data/constants'

export const hasPermission = (user, permission) =>
  Boolean(user?.permissions?.includes(permission))

export const isAdmin = (user) => user?.role === ROLES.ADMIN
export const isDistributor = (user) => user?.role === ROLES.DISTRIBUTOR
export const isRetailer = (user) => user?.role === ROLES.RETAILER

/** Roles allowed to write to the catalog / inventory. */
export const canManageCatalog = (user) => hasPermission(user, 'catalog:write')
export const canAdjustStock = (user) => hasPermission(user, 'inventory:write')
export const canApproveOrders = (user) => hasPermission(user, 'orders:approve')
export const canPlaceOrders = (user) => hasPermission(user, 'orders:create')
export const canViewReports = (user) => hasPermission(user, 'reports:view')