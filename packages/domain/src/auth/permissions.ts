/**
 * Single source of truth for the role/permission matrix. The API guard and the
 * web UI's `useCan()` hook both read from here so they can never drift.
 */

export const Role = {
  Customer: 'customer',
  Admin: 'admin',
  Production: 'production',
  Inventory: 'inventory',
  Dispatcher: 'dispatcher',
  Driver: 'driver',
  Finance: 'finance',
  OfficeAdmin: 'office_admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const Permission = {
  UsersRead: 'users:read',
  UsersWrite: 'users:write',

  OrdersRead: 'orders:read',
  OrdersReadAll: 'orders:read:all',
  OrdersWrite: 'orders:write',
  OrdersCancel: 'orders:cancel',
  OrdersTransition: 'orders:transition',

  CatalogRead: 'catalog:read',
  CatalogWrite: 'catalog:write',

  PricingRead: 'pricing:read',
  PricingWrite: 'pricing:write',

  ProductionRead: 'production:read',
  ProductionWrite: 'production:write',

  InventoryRead: 'inventory:read',
  InventoryWrite: 'inventory:write',

  PurchasingRead: 'purchasing:read',
  PurchasingWrite: 'purchasing:write',

  CrmRead: 'crm:read',
  CrmWrite: 'crm:write',

  DeliveryRead: 'delivery:read',
  DeliveryWrite: 'delivery:write',

  DriverRead: 'driver:read',
  DriverWrite: 'driver:write',

  ReportsRead: 'reports:read',

  NotificationsRead: 'notifications:read',
  NotificationsWrite: 'notifications:write',

  AuditRead: 'audit:read',

  WebhooksRead: 'webhooks:read',
  WebhooksWrite: 'webhooks:write',

  SettingsRead: 'settings:read',
  SettingsWrite: 'settings:write',

  OfficeRead: 'office:read',
  OfficeWrite: 'office:write',
  OrdersDesk: 'orders:desk',
  OfficePettycash: 'office:pettycash',
  OfficeEmployeeRead: 'office:employee:read',
  OfficeEmployeeWrite: 'office:employee:write',
  OfficeMatrixRead: 'office:matrix:read',
  OfficeMatrixWrite: 'office:matrix:write',
  OfficeDocumentsAuthorize: 'office:documents:authorize',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  Permission.OrdersRead,
  Permission.OrdersWrite,
  Permission.OrdersCancel,
  Permission.CatalogRead,
  Permission.PricingRead,
  Permission.NotificationsRead,
  Permission.DriverRead,
];

const PRODUCTION_PERMISSIONS: readonly Permission[] = [
  Permission.OrdersRead,
  Permission.CatalogRead,
  Permission.ProductionRead,
  Permission.ProductionWrite,
  Permission.InventoryRead,
  Permission.NotificationsRead,
];

const INVENTORY_PERMISSIONS: readonly Permission[] = [
  Permission.CatalogRead,
  Permission.InventoryRead,
  Permission.InventoryWrite,
  Permission.PurchasingRead,
  Permission.PurchasingWrite,
  Permission.OrdersRead,
  Permission.NotificationsRead,
];

const DISPATCHER_PERMISSIONS: readonly Permission[] = [
  Permission.OrdersReadAll,
  Permission.DeliveryRead,
  Permission.DeliveryWrite,
  Permission.DriverRead,
  Permission.DriverWrite,
  Permission.CatalogRead,
  Permission.NotificationsRead,
];

const DRIVER_PERMISSIONS: readonly Permission[] = [
  Permission.DriverRead,
  Permission.DriverWrite,
  Permission.DeliveryRead,
  Permission.NotificationsRead,
];

const FINANCE_PERMISSIONS: readonly Permission[] = [
  Permission.OrdersReadAll,
  Permission.CrmRead,
  Permission.CrmWrite,
  Permission.PricingRead,
  Permission.PricingWrite,
  Permission.ReportsRead,
  Permission.AuditRead,
  Permission.NotificationsRead,
  Permission.SettingsRead,
];

/**
 * Office administrator. Runs the front office (order desk, follow-ups,
 * registers, complaints). Deliberately READ-ONLY for guarded areas: prices,
 * discounts, invoices, purchases, QC/batch/material records, dispatch and
 * traceability. No hard deletes, no backdating — corrections belong to the
 * owning role and land in the audit log. Office-specific writes flow through
 * `office:write` / `orders:desk`.
 */
const OFFICE_ADMIN_PERMISSIONS: readonly Permission[] = [
  // Views (their day job: check orders, customers, stock, dispatch)
  Permission.OrdersReadAll,
  Permission.CatalogRead,
  Permission.PricingRead,
  Permission.CrmRead,
  Permission.InventoryRead,
  Permission.ProductionRead,
  Permission.DeliveryRead,
  Permission.ReportsRead,
  Permission.AuditRead,

  // Office modules
  Permission.OfficeRead,
  Permission.OfficeWrite,
  Permission.OrdersDesk,
  Permission.OfficePettycash,
  Permission.OfficeEmployeeRead,
  Permission.OfficeEmployeeWrite,
  // Staff list for the attendance register only (no user management).
  Permission.UsersRead,

  // Order desk may create/update orders (pricing is recomputed server-side;
  // transitions beyond desk steps stay gated by `orders:transition`).
  Permission.OrdersWrite,
  Permission.CrmWrite,

  // Notifications: can read and trigger sends; channel config is admin-only.
  Permission.NotificationsRead,
  Permission.NotificationsWrite,
];

const MATRIX: Record<Role, readonly Permission[]> = {
  [Role.Admin]: ALL_PERMISSIONS,
  [Role.Customer]: CUSTOMER_PERMISSIONS,
  [Role.Production]: PRODUCTION_PERMISSIONS,
  [Role.Inventory]: INVENTORY_PERMISSIONS,
  [Role.Dispatcher]: DISPATCHER_PERMISSIONS,
  [Role.Driver]: DRIVER_PERMISSIONS,
  [Role.Finance]: FINANCE_PERMISSIONS,
  [Role.OfficeAdmin]: OFFICE_ADMIN_PERMISSIONS,
};

/** The full permission matrix, keyed by role. */
export const rolePermissions: Record<Role, readonly Permission[]> = MATRIX;

/** Returns the permissions granted to a role. */
export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role] ?? [];
}

/** True when `role` holds `permission`. */
export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** True when `role` holds every permission in `required`. */
export function canAll(role: Role, required: readonly Permission[]): boolean {
  const held = permissionsFor(role);
  return required.every((permission) => held.includes(permission));
}
