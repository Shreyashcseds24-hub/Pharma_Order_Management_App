import {
  LayoutDashboard,
  Pill,
  Boxes,
  ShoppingCart,
  Sparkles,
  ReceiptText,
  BarChart3,
  Settings,
} from 'lucide-react'
import { ROLES } from '../data/constants'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR, ROLES.RETAILER] },
  { to: '/medicines', label: 'Medicine Catalog', icon: Pill, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR, ROLES.RETAILER] },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR] },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR, ROLES.RETAILER] },
  { to: '/ai-insights', label: 'AI Insights', icon: Sparkles, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR, ROLES.RETAILER] },
  { to: '/invoices', label: 'Invoices & Payments', icon: ReceiptText, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: [ROLES.ADMIN, ROLES.DISTRIBUTOR] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: [ROLES.ADMIN] },
]

export const navItemsForRole = (role) => NAV_ITEMS.filter((item) => item.roles.includes(role))

export const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', breadcrumb: 'Home' },
  '/medicines': { title: 'Medicine Catalog', breadcrumb: 'Operations' },
  '/inventory': { title: 'Inventory', breadcrumb: 'Operations' },
  '/orders': { title: 'Orders', breadcrumb: 'Operations' },
  '/ai-insights': { title: 'AI Insights', breadcrumb: 'Intelligence' },
  '/invoices': { title: 'Invoices & Payments', breadcrumb: 'Finance' },
  '/reports': { title: 'Reports', breadcrumb: 'Finance' },
  '/settings': { title: 'Settings', breadcrumb: 'Administration' },
}