import { describe, expect, it } from 'vitest';

import {
  Permission,
  Role,
  ROLES,
  can,
  canAll,
  isRole,
  permissionsFor,
  rolePermissions,
} from './permissions.js';

describe('role/permission matrix', () => {
  it('grants admin every permission', () => {
    const all = Object.values(Permission) as Permission[];
    expect(permissionsFor(Role.Admin).sort()).toEqual([...all].sort());
  });

  it('exposes a permission list for every role', () => {
    for (const role of ROLES) {
      expect(permissionsFor(role).length).toBeGreaterThan(0);
    }
  });

  it('lets admin do anything', () => {
    expect(can(Role.Admin, Permission.SettingsWrite)).toBe(true);
    expect(can(Role.Admin, Permission.OrdersTransition)).toBe(true);
  });

  it('lets a customer place and cancel their own orders', () => {
    expect(can(Role.Customer, Permission.OrdersWrite)).toBe(true);
    expect(can(Role.Customer, Permission.OrdersCancel)).toBe(true);
  });

  it('forbids a customer from staff-only permissions', () => {
    expect(can(Role.Customer, Permission.UsersWrite)).toBe(false);
    expect(can(Role.Customer, Permission.OrdersTransition)).toBe(false);
    expect(can(Role.Customer, Permission.ReportsRead)).toBe(false);
  });

  it('gives production control of jobs but not finance', () => {
    expect(can(Role.Production, Permission.ProductionWrite)).toBe(true);
    expect(can(Role.Production, Permission.PurchasingWrite)).toBe(false);
    expect(can(Role.Production, Permission.ReportsRead)).toBe(false);
  });

  it('gives finance read access to orders and reports', () => {
    expect(can(Role.Finance, Permission.OrdersReadAll)).toBe(true);
    expect(can(Role.Finance, Permission.ReportsRead)).toBe(true);
    expect(can(Role.Finance, Permission.ProductionWrite)).toBe(false);
  });

  it('runs the order desk as office_admin', () => {
    expect(can(Role.OfficeAdmin, Permission.OrdersDesk)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.OfficeWrite)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.OrdersWrite)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.OfficePettycash)).toBe(true);
  });

  it('lets office_admin view orders, customers, stock and dispatch', () => {
    expect(can(Role.OfficeAdmin, Permission.OrdersReadAll)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.CrmRead)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.InventoryRead)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.DeliveryRead)).toBe(true);
    expect(can(Role.OfficeAdmin, Permission.ProductionRead)).toBe(true);
  });

  it('denies office_admin price, discount and catalog writes', () => {
    expect(can(Role.OfficeAdmin, Permission.PricingWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.CatalogWrite)).toBe(false);
  });

  it('denies office_admin invoice and purchase approvals', () => {
    expect(can(Role.OfficeAdmin, Permission.SettingsWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.PurchasingWrite)).toBe(false);
  });

  it('denies office_admin QC, batch, material and dispatch writes', () => {
    expect(can(Role.OfficeAdmin, Permission.ProductionWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.InventoryWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.DeliveryWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.DriverWrite)).toBe(false);
  });

  it('denies office_admin order state transitions and cancellation', () => {
    expect(can(Role.OfficeAdmin, Permission.OrdersTransition)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.OrdersCancel)).toBe(false);
  });

  it('denies office_admin user management and admin configuration', () => {
    expect(can(Role.OfficeAdmin, Permission.UsersWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.OfficeMatrixWrite)).toBe(false);
    expect(can(Role.OfficeAdmin, Permission.OfficeDocumentsAuthorize)).toBe(false);
  });

  it('supports multi-permission checks', () => {
    expect(canAll(Role.Dispatcher, [Permission.DeliveryRead, Permission.DeliveryWrite])).toBe(true);
    expect(canAll(Role.Dispatcher, [Permission.DeliveryRead, Permission.SettingsWrite])).toBe(
      false,
    );
  });

  it('validates role strings', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('nope')).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it('has a stable matrix export', () => {
    expect(Object.keys(rolePermissions).sort()).toEqual([...ROLES].sort());
  });
});
