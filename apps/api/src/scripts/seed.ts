import { Role, type Role as RoleType } from '@ameen/domain';
import type { Document } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { CatalogSku, BomTemplate } from '../modules/catalog/catalog.model.js';
import { Company } from '../modules/company/company.model.js';
import { Customer } from '../modules/crm/crm.model.js';
import { Counter } from '../modules/counters/counter.model.js';
import { Delivery, DeliveryRoute, Driver, Vehicle } from '../modules/delivery/delivery.model.js';
import { InventoryMovement, InventoryStock, Material } from '../modules/inventory/inventory.model.js';
import { DELEGATION_DEFAULTS, DelegationMatrix } from '../modules/office/office.model.js';
import { computePricing } from '../modules/orders/orders.service.js';
import { Order, Quote } from '../modules/orders/orders.model.js';
import { Invoice, Payment, RazorpayWebhook } from '../modules/payments/payments.model.js';
import { PriceRule } from '../modules/pricing/pricing.model.js';
import { Machine, ProductionJob, QcChecklist, Shift } from '../modules/production/production.model.js';
import { GoodsReceipt, PurchaseOrder, Vendor } from '../modules/purchasing/purchasing.model.js';
import { User } from "../modules/auth/auth.model.js";
import { userRepository, type UserDoc } from '../modules/auth/auth.repository.js';
import { hashPassword } from '../modules/auth/strategies/password.js';

/** Seed documents are only touched through a few fields each. */
type SeedDoc = Document<unknown> & { _id: unknown };

interface SeedVendor extends SeedDoc {
  gstin?: string;
  phone?: string;
  name?: string;
}

interface SeedMaterial extends SeedDoc {
  materialCode: string;
  name: string;
  unit: string;
  unitCostPaise: number;
  reorderPoint: number;
}

interface SeedSku extends SeedDoc {
  skuCode: string;
  name: string;
  category: string;
  pricing: { basePricePaise: number; minQty: number; taxRate: number };
}

const STAFF: { phone: string; name: string; role: RoleType }[] = [
  { phone: '+919000000001', name: 'Ameen Admin', role: Role.Admin },
  { phone: '+919000000002', name: 'Production Operator', role: Role.Production },
  { phone: '+919000000003', name: 'Inventory Keeper', role: Role.Inventory },
  { phone: '+919000000004', name: 'Dispatcher', role: Role.Dispatcher },
  { phone: '+919000000005', name: 'Driver One', role: Role.Driver },
  { phone: '+919000000006', name: 'Finance Manager', role: Role.Finance },
  { phone: '+919000000007', name: 'Office Clerk Sasi', role: Role.OfficeAdmin },
];

let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(list: readonly T[]): T {
  const v = list[Math.floor(rand() * list.length)];
  return v as T;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, randInt(0, 59), 0, 0);
  return d;
}

const CITIES = [
  { city: 'Coimbatore', district: 'Coimbatore', pincode: '641014' },
  { city: 'Erode', district: 'Erode', pincode: '638001' },
  { city: 'Tirupur', district: 'Tirupur', pincode: '641604' },
  { city: 'Salem', district: 'Salem', pincode: '636001' },
  { city: 'Madurai', district: 'Madurai', pincode: '625001' },
];

const COMPANY_WORDS = ['Lunch Box', 'Hotel', 'Sweets', 'Cafe', 'Traders', 'Bakehouse', 'Sari Store', 'Foods', 'Bakery', 'Mess'];
const MATERIALS: {
  materialCode: string;
  name: string;
  category: string;
  unit: string;
  unitCostPaise: number;
  reorderPoint: number;
  reorderQuantity: number;
}[] = [
  { materialCode: 'MAT-KRP-350', name: 'Kraft paper 350 GSM roll', category: 'kraft_paper', unit: 'roll', unitCostPaise: 420_000, reorderPoint: 8, reorderQuantity: 40 },
  { materialCode: 'MAT-KRP-250', name: 'Kraft paper 250 GSM roll', category: 'kraft_paper', unit: 'roll', unitCostPaise: 310_000, reorderPoint: 10, reorderQuantity: 40 },
  { materialCode: 'MAT-COR3', name: 'Corrugated sheet 3-ply', category: 'corrugated_sheet', unit: 'sheet', unitCostPaise: 9_500, reorderPoint: 250, reorderQuantity: 1500 },
  { materialCode: 'MAT-COR2', name: 'Corrugated sheet 2-ply', category: 'corrugated_sheet', unit: 'sheet', unitCostPaise: 6_400, reorderPoint: 200, reorderQuantity: 1200 },
  { materialCode: 'MAT-WHT-300', name: 'White board 300 GSM', category: 'kraft_paper', unit: 'sheet', unitCostPaise: 4_200, reorderPoint: 300, reorderQuantity: 2000 },
  { materialCode: 'MAT-INK-BLK', name: 'Flexo ink black 5L', category: 'ink', unit: 'ml', unitCostPaise: 18, reorderPoint: 15_000, reorderQuantity: 40_000 },
  { materialCode: 'MAT-INK-RED', name: 'Flexo ink red 5L', category: 'ink', unit: 'ml', unitCostPaise: 19, reorderPoint: 12_000, reorderQuantity: 30_000 },
  { materialCode: 'MAT-GLU', name: 'Hot melt glue 10kg', category: 'glue', unit: 'kg', unitCostPaise: 24_500, reorderPoint: 40, reorderQuantity: 100 },
  { materialCode: 'MAT-BRD-WIR', name: 'Wire stitch roll', category: 'tape', unit: 'roll', unitCostPaise: 28_000, reorderPoint: 12, reorderQuantity: 60 },
  { materialCode: 'MAT-LBL-ROLL', name: 'Label stock roll', category: 'label_stock', unit: 'roll', unitCostPaise: 52_000, reorderPoint: 30, reorderQuantity: 60 },
];

const SKUS: {
  skuCode: string;
  name: string;
  category: string;
  material: string;
  dims: [number, number, number];
  minQty: number;
  price: number;
}[] = [
  { skuCode: 'PB-1010-K', name: 'Parcel box 10x10", kraft', category: 'parcel_box', material: 'corrugated_3ply', dims: [254, 254, 120], minQty: 250, price: 14_000 },
  { skuCode: 'PB-1215-K', name: 'Parcel box 12x15", kraft', category: 'parcel_box', material: 'corrugated_3ply', dims: [305, 381, 150], minQty: 250, price: 21_000 },
  { skuCode: 'CB-0808-K', name: 'Cake box 8x8x5", kraft', category: 'cake_box', material: 'kraft', dims: [203, 203, 127], minQty: 500, price: 5_200 },
  { skuCode: 'CB-1010-K', name: 'Cake box 10x10x5", kraft', category: 'cake_box', material: 'kraft', dims: [254, 254, 127], minQty: 500, price: 6_800 },
  { skuCode: 'BB-0503-W', name: 'Burger box small, board', category: 'burger_box', material: 'whiteboard', dims: [127, 89, 64], minQty: 1000, price: 3_400 },
  { skuCode: 'BB-0606-W', name: 'Burger box medium, board', category: 'burger_box', material: 'whiteboard', dims: [152, 152, 89], minQty: 1000, price: 4_100 },
  { skuCode: 'CHB-12-K', name: 'Chicken basket 12pc', category: 'chicken_basket', material: 'corrugated_2ply', dims: [305, 203, 89], minQty: 500, price: 7_900 },
  { skuCode: 'CHB-8-K', name: 'Chicken basket 8pc', category: 'chicken_basket', material: 'corrugated_2ply', dims: [254, 178, 89], minQty: 500, price: 6_500 },
  { skuCode: 'TR-0404-K', name: 'Tray 4x4" kraft liner', category: 'tray', material: 'kraft', dims: [102, 102, 25], minQty: 2000, price: 2_600 },
  { skuCode: 'TR-0908-K', name: 'Tray 9x8" kraft', category: 'tray', material: 'kraft', dims: [229, 203, 38], minQty: 1000, price: 3_900 },
  { skuCode: 'LN-CIRC-16', name: 'Liner circle 16cm', category: 'liner', material: 'paperboard', dims: [160, 160, 2], minQty: 5000, price: 1_800 },
  { skuCode: 'PB-1812-K', name: 'Parcel box 18x12x12", kraft', category: 'parcel_box', material: 'corrugated_3ply', dims: [457, 305, 305], minQty: 200, price: 34_500 },
];

async function seedStaffAndUsers(passwordHash: string): Promise<{ users: UserDoc[]; customerUser: UserDoc }> {
  const users: UserDoc[] = [];
  for (const staff of STAFF) {
    const created = await userRepository.create({
      phone: staff.phone,
      name: staff.name,
      role: staff.role,
      status: 'active',
      passwordHash,
    });
    users.push(created);
  }
  const customerUser = await userRepository.create({
    phone: '+919000000100',
    name: 'Anbu Traders (portal)',
    role: Role.Customer,
    status: 'active',
    passwordHash,
  });
  logger.info('staff + customer portal user created');
  return { users, customerUser };
}

interface CustomerSeeded {
  doc: SeedDoc;
  code: string;
  segment: string;
  city: string;
}

async function seedCustomers(): Promise<CustomerSeeded[]> {
  const customers: CustomerSeeded[] = [];
  for (let i = 0; i < 20; i += 1) {
    const segment = i < 3 ? 'enterprise' : i < 8 ? 'large' : i < 14 ? 'mid' : i < 18 ? 'small' : 'walk_in';
    const place = CITIES[i % CITIES.length];
    if (!place) throw new Error('Seed data misconfigured: missing city');
    const code = `CUS-${String(i + 1).padStart(4, '0')}`;
    const doc = await Customer.create({
      customerCode: code,      businessName: `${pick(COMPANY_WORDS)} ${pick(['Anbu', 'Selvam', 'Kumar', 'Raj', 'Vijay', 'Divya', 'Priya', 'Murugan'])}`,
      contactName: `Contact ${i + 1}`,
      phone: `+9198${String(10000000 + i * 111111).slice(0, 8)}`,
      email: `biz${i + 1}@example.in`,
      gstin: i % 4 === 0 ? `33AAECA${String(1000 + i)}L1Z${String(10 + i)}` : '',
      pan: 'AAECA0000L',
      segment,
      priceTier: 'standard',
      creditLimit: segment === 'enterprise' ? 800_000_00 : segment === 'large' ? 400_000_00 : segment === 'mid' ? 150_000_00 : 50_000_00,
      creditUsed: 0,
      paymentTermsDays: segment === 'enterprise' ? 30 : segment === 'large' ? 21 : 15,
      addresses: [
        {
          label: 'Main shop',
          contactName: `Contact ${i + 1}`,
          phone: `+9198${String(10000000 + i * 222222).slice(0, 8)}`,
          line1: `${randInt(1, 100)} Bazaar street`,
          area: place.district,
          city: place.city,
          district: place.district,
          state: 'TN',
          pincode: place.pincode,
          geo: {
            type: 'Point',
            coordinates: [76.9 + rand() * 0.6, 10.9 + rand() * 0.6],
          },
          isDefault: true,
        },
      ],
      notes: '',
      deskNotes:
        i < 3
          ? {
              preferredLanguage: 'ta',
              boxSizeHabits: ['9x9x5', '10x10x5'],
              otherReplies: 'Sizes vary order to order — 9x9x5 ↔ 10x10x5 mix, confirm on each call.',
              followUpPrefs: 'Prefers a call after 4pm; WhatsApp accepted.',
            }
          : {},
      tags: [],
      isBlacklisted: false,
      totalOrderValue: 0,
      orderCount: 0,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
    });
    customers.push({ doc: doc as unknown as SeedDoc, code, segment, city: place.city });
  }
  logger.info('customers seeded');
  return customers;
}

async function seedVendors(): Promise<{ vendors: SeedVendor[] }> {
  const vendorDocs = await Vendor.insertMany(
    [
      ['Sri Paper Traders', 'raw_material'],
      ['Coimbatore Sheets', 'raw_material'],
      ['Print Partners LLP', 'print_partner'],
      ['Anbu Adhesives', 'raw_material'],
      ['Label World', 'packaging_other'],
    ].map(([name, type], index) => ({
      vendorCode: `VEN-${String(index + 1).padStart(4, '0')}`,
      name,
      type,
      gstin: `33AACCS${String(2000 + index)}L1ZS`,
      phone: `+9194${String(30000000 + index * 12345)}`,
      email: `vendor${index + 1}@example.in`,
      address: { line1: `${index + 1} Industrial estate`, city: 'Coimbatore', district: 'Coimbatore', state: 'TN', pincode: '641012' },
      paymentTermsDays: 30,
      rating: 3 + (index % 3),
      isActive: true,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    })),
  );
  logger.info('vendors seeded');
  return { vendors: vendorDocs as unknown as SeedVendor[] };
}

async function seedMaterials(): Promise<SeedMaterial[]> {
  const materialDocs = await Material.insertMany(
    MATERIALS.map((material, index) => ({
      ...material,
      taxRate: 18,
      hsnCode: '4802',
      leadTimeDays: 3 + (index % 4),
      vendorId: null,
      storageLocation: 'STORE-1',
      isActive: true,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    })),
  );
  return materialDocs as unknown as SeedMaterial[];
}

async function seedCatalog(materials: SeedMaterial[]): Promise<void> {
  const skuDocs = await CatalogSku.insertMany(
    SKUS.map((sku) => ({
      skuCode: sku.skuCode,
      name: sku.name,
      category: sku.category,
      material: sku.material,
      dimensions: { length: sku.dims[0], width: sku.dims[1], height: sku.dims[2], unit: 'mm' },
      print: { type: 'none', sides: 0, colors: 0 },
      pricing: { basePricePaise: sku.price, minQty: sku.minQty, taxRate: 18, hsnCode: '4819' },
      leadTimeDays: 2,
      tags: [],
      isActive: true,
      createdAt: daysAgo(80),
      updatedAt: daysAgo(80),
    })),
  );

  const kraft = materials.find((m) => m.materialCode === 'MAT-KRP-350');
  const cor3 = materials.find((m) => m.materialCode === 'MAT-COR3');
  const cor2 = materials.find((m) => m.materialCode === 'MAT-COR2');
  const white = materials.find((m) => m.materialCode === 'MAT-WHT-300');
  const ink = materials.find((m) => m.materialCode === 'MAT-INK-BLK');
  const bomDocs = skuDocs.flatMap((sku) => {
    const materialId =
      sku.material === 'corrugated_3ply' ? cor3 : sku.material === 'corrugated_2ply' ? cor2 : sku.material === 'whiteboard' ? white : kraft;
    return [
      {
        skuId: sku._id,
        materialId: materialId ? materialId._id : cor3?._id,
        quantityPerUnit: 1.2,
        unit: 'sq_m',
        wastagePct: 5,
        isPrimary: true,
      },
      {
        skuId: sku._id,
        materialId: ink ? ink._id : cor3?._id,
        quantityPerUnit: 2,
        unit: 'ml',
        wastagePct: 2,
        isPrimary: false,
      },
    ];
  });
  await BomTemplate.insertMany(bomDocs);

  await PriceRule.insertMany([
    {
      name: 'Small-shop discount',
      scope: 'segment',
      ruleType: 'percentage',
      value: 5,
      priority: 40,
      segment: 'small',
      isActive: true,
    },
    {
      name: 'Mid-size discount',
      scope: 'segment',
      ruleType: 'percentage',
      value: 8,
      priority: 30,
      segment: 'mid',
      isActive: true,
    },
    {
      name: 'Large discount',
      scope: 'segment',
      ruleType: 'percentage',
      value: 12,
      priority: 20,
      segment: 'large',
      isActive: true,
    },
    {
      name: 'Enterprise discount',
      scope: 'segment',
      ruleType: 'percentage',
      value: 15,
      priority: 10,
      segment: 'enterprise',
      isActive: true,
    },
  ]);
  logger.info('catalog + pricing rules seeded');
}

async function seedStockAndMovements(materials: SeedMaterial[]): Promise<void> {
  for (const [index, material] of materials.entries()) {
    const reorderPoint = (material.reorderPoint as number) ?? 0;
    const onHand = index === 1 ? reorderPoint - 3 : randInt(Math.max(0, reorderPoint * 2), Math.max(1, reorderPoint * 6));
    const reserved = randInt(0, Math.floor(onHand / 5));
    await InventoryStock.create({
      materialId: material._id,
      location: 'STORE-1',
      onHand,
      reserved,
      available: onHand - reserved,
      averageCostPaise: (material.unitCostPaise as number) ?? 0,
      lastMovementAt: daysAgo(randInt(1, 10)),
    });
    await InventoryMovement.create({
      materialId: material._id,
      type: 'receipt',
      quantity: onHand,
      unitCostPaise: (material.unitCostPaise as number) ?? 0,
      balanceAfter: onHand,
      referenceType: 'purchase_order',
      location: 'STORE-1',
      note: 'Opening stock',
      occurredAt: daysAgo(30),
    });
  }
  logger.info('stock seeded');
}

async function seedPurchasing(matDocs: SeedMaterial[], vendorDocs: SeedVendor[]): Promise<void> {
  const statuses = ['draft', 'sent', 'partially_received', 'received'];
  for (const [index, status] of statuses.entries()) {
    const items = [0, 1].flatMap((i) => {
      const material = matDocs[(index * 2 + i) % matDocs.length];
      if (!material) throw new Error('Seed data misconfigured: missing material');
      const quantity = 50 + i * 30;
      const lineTotal = quantity * ((material.unitCostPaise as number) ?? 0);
      return [
        {
          materialId: material._id,
          quantity,
          unit: material.unit,
          unitCostPaise: (material.unitCostPaise as number) ?? 0,
          taxRate: 18,
          receivedQty: (status === 'received' || (status === 'partially_received' && i === 0)) ? quantity : 0,
          lineTotalPaise: lineTotal,
        },
      ];
    });
    const total = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    const tax = Math.round(total * 0.18);
    const vendor = vendorDocs[index % vendorDocs.length];
    if (!vendor) throw new Error('Seed data misconfigured: missing vendor');
    await PurchaseOrder.create({
      poNumber: `PO-2526-${String(index + 1).padStart(5, '0')}`,
      vendorId: vendor._id,
      items,
      status,
      totalPaise: total,
      taxPaise: tax,
      grandTotalPaise: total + tax,
      expectedDeliveryDate: daysAgo(-7 - index),
      notes: '',
      sentAt: status === 'draft' ? null : daysAgo(14 - index * 2),
      receivedAt: status === 'received' ? daysAgo(6) : null,
      createdAt: daysAgo(16 - index * 3),
      updatedAt: daysAgo(6),
    });
  }
  logger.info('purchase orders seeded');
}

async function seedMachines(): Promise<void> {
  await Machine.insertMany([
    { code: 'MC-DIE-01', name: 'Die cutter A', type: 'die_cutter', capacityPerShift: 4000, isActive: true, maintenanceDueDate: daysAgo(-20), createdAt: daysAgo(80), updatedAt: daysAgo(80) },
    { code: 'MC-DIE-02', name: 'Die cutter B', type: 'die_cutter', capacityPerShift: 3500, isActive: true, maintenanceDueDate: daysAgo(-45), createdAt: daysAgo(80), updatedAt: daysAgo(80) },
    { code: 'MC-CRS-01', name: 'Creaser A', type: 'creaser', capacityPerShift: 5000, isActive: true, createdAt: daysAgo(80), updatedAt: daysAgo(80) },
    { code: 'MC-PRT-01', name: 'Flexo printer A', type: 'printer', capacityPerShift: 2500, isActive: true, createdAt: daysAgo(80), updatedAt: daysAgo(80) },
    { code: 'MC-ASM-01', name: 'Assembling unit A', type: 'assembler', capacityPerShift: 3000, isActive: true, createdAt: daysAgo(80), updatedAt: daysAgo(80) },
  ]);
  await QcChecklist.create({
    name: 'Standard parcel box QC',
    appliesTo: 'category',
    category: 'parcel_box',
    items: [
      { code: 'DIM', label: 'Dimensions within tolerance', type: 'pass_fail', required: true },
      { code: 'GLUE', label: 'Glue joints hold 5kg', type: 'pass_fail', required: true },
      { code: 'PRINT', label: 'Print alignment clear', type: 'pass_fail', required: false },
    ],
    isActive: true,
    createdAt: daysAgo(70),
    updatedAt: daysAgo(70),
  });
  await Shift.create({ name: 'Day', startMinutes: 540, endMinutes: 1020, isNight: false, days: [1, 2, 3, 4, 5, 6] });
  await Shift.create({ name: 'Night', startMinutes: 1020, endMinutes: 1800, isNight: true, days: [1, 2, 3, 4, 5] });
  logger.info('machines, checklists, shifts seeded');
}

interface DriverVehicle {
  drivers: SeedDoc[];
  vehicles: SeedDoc[];
  driverUserPhone: string;
}

async function seedDriversAndVehicles(): Promise<DriverVehicle> {
  const vehicles = (await Vehicle.insertMany([
    { vehicleCode: 'VEH-001', type: 'mini_truck', registrationNumber: 'TN37BX1234', capacityKg: 800, capacityBoxes: 400, isActive: true, createdAt: daysAgo(70), updatedAt: daysAgo(70) },
    { vehicleCode: 'VEH-002', type: 'van', registrationNumber: 'TN37BX5678', capacityKg: 500, capacityBoxes: 200, isActive: true, createdAt: daysAgo(70), updatedAt: daysAgo(70) },
    { vehicleCode: 'VEH-003', type: 'bike', registrationNumber: 'TN37BX9012', capacityKg: 50, capacityBoxes: 30, isActive: true, createdAt: daysAgo(70), updatedAt: daysAgo(70) },
  ])) as unknown as SeedDoc[];
  if (vehicles.length < 3) throw new Error('Seed data misconfigured: vehicles');
  const vehicle0 = vehicles[0] as SeedDoc;
  const vehicle1 = vehicles[1] as SeedDoc;
  const vehicle2 = vehicles[2] as SeedDoc;
  const drivers = (await Driver.insertMany([
    { driverCode: 'DRV-0001', name: 'Selvam K', phone: '+919845100001', vehicleIds: [vehicle0._id], isActive: true, rating: 5, totalDeliveries: 0, licenseNumber: 'TN37-2019000123' },
    { driverCode: 'DRV-0002', name: 'Ravi M', phone: '+919845100002', vehicleIds: [vehicle1._id], isActive: true, rating: 4, totalDeliveries: 0, licenseNumber: 'TN37-2018000456' },
    { driverCode: 'DRV-0003', name: 'Kumar S', phone: '+919845100003', vehicleIds: [vehicle2._id], isActive: true, rating: 5, totalDeliveries: 0, licenseNumber: 'TN37-2020000789' },
  ])) as unknown as SeedDoc[];
  if (drivers.length < 3) throw new Error('Seed data misconfigured: drivers');
  const driver0 = drivers[0] as SeedDoc;
  // Link driver profile to the Driver user account for the driver app view.
  const driverUser = await userRepository.findByPhone('+919000000005');
  if (driverUser) {
    await User.findByIdAndUpdate(driverUser._id, { driverId: driver0._id }).exec();
  }
  logger.info('drivers + vehicles seeded');
  return {
    drivers: drivers as SeedDoc[],
    vehicles: vehicles as SeedDoc[],
    driverUserPhone: '+919000000005',
  };
}

interface OrderPlan {
  state: string;
  createdAtDaysAgo: number;
  stage: string;
}

const STATE_PLAN: OrderPlan[] = [
  { state: 'payment_pending', createdAtDaysAgo: 44, stage: '' },
  { state: 'payment_pending', createdAtDaysAgo: 42, stage: '' },
  { state: 'placed', createdAtDaysAgo: 41, stage: '' },
  { state: 'cancelled', createdAtDaysAgo: 39, stage: '' },
  { state: 'paid', createdAtDaysAgo: 37, stage: '' },
  { state: 'on_hold', createdAtDaysAgo: 36, stage: '' },
  { state: 'planned', createdAtDaysAgo: 33, stage: 'queued' },
  { state: 'planned', createdAtDaysAgo: 31, stage: 'queued' },
  { state: 'in_production', createdAtDaysAgo: 27, stage: 'cutting' },
  { state: 'in_production', createdAtDaysAgo: 24, stage: 'received' },
  { state: 'in_production', createdAtDaysAgo: 21, stage: 'printing' },
  { state: 'in_production', createdAtDaysAgo: 18, stage: 'creasing' },
  { state: 'qc', createdAtDaysAgo: 15, stage: 'qc' },
  { state: 'qc', createdAtDaysAgo: 14, stage: 'qc' },
  { state: 'qc', createdAtDaysAgo: 12, stage: 'rework' },
  { state: 'ready', createdAtDaysAgo: 10, stage: 'ready' },
  { state: 'ready', createdAtDaysAgo: 9, stage: 'ready' },
  { state: 'dispatched', createdAtDaysAgo: 7, stage: 'ready' },
  { state: 'dispatched', createdAtDaysAgo: 5, stage: 'ready' },
  { state: 'dispatched', createdAtDaysAgo: 3, stage: 'ready' },
  { state: 'delivered', createdAtDaysAgo: 6, stage: 'ready' },
  { state: 'delivered', createdAtDaysAgo: 11, stage: 'ready' },
  { state: 'closed', createdAtDaysAgo: 9, stage: 'ready' },
  { state: 'closed', createdAtDaysAgo: 13, stage: 'ready' },
  { state: 'closed', createdAtDaysAgo: 16, stage: 'ready' },
  { state: 'rescheduled', createdAtDaysAgo: 8, stage: 'ready' },
  { state: 'cancelled', createdAtDaysAgo: 17, stage: '' },
];

/** Fills the remaining slots with completed orders to give the reports weight. */
function fullStatePlan(count: number): OrderPlan[] {
  const plans: OrderPlan[] = [];
  for (let i = 0; i < count; i += 1) {
    const cycle = i % 20;
    const daysAgoValue = 40 - cycle * 2;
    if (cycle < 12) plans.push({ state: 'closed', createdAtDaysAgo: Math.max(1, daysAgoValue), stage: 'ready' });
    else if (cycle < 15) plans.push({ state: 'delivered', createdAtDaysAgo: Math.max(1, daysAgoValue), stage: 'ready' });
    else if (cycle < 17) plans.push({ state: 'dispatched', createdAtDaysAgo: Math.max(1, daysAgoValue), stage: 'ready' });
    else if (cycle === 17) plans.push({ state: 'in_production', createdAtDaysAgo: 1, stage: 'cutting' });
    else plans.push({ state: 'placed', createdAtDaysAgo: 0, stage: '' });
  }
  return plans;
}

async function seedOrders(
  customerDocs: CustomerSeeded[],
  skuDocs: SeedDoc[],
  drivers: SeedDoc[],
  vehicles: SeedDoc[],
  customerUser: UserDoc,
  adminUserId: string,
): Promise<void> {
  const TOTAL_ORDERS = 100;
  const plans = [...STATE_PLAN, ...fullStatePlan(TOTAL_ORDERS - STATE_PLAN.length)].slice(0, TOTAL_ORDERS);
  const skuList = skuDocs as unknown as SeedSku[];

  let orderSeq = 0;
  let quoteSeq = 0;
  const deliveryDocs: SeedDoc[] = [];
  const invoiceDocs: SeedDoc[] = [];
  const paymentDocs: SeedDoc[] = [];
  let deliveredCountByDriver = new Map<string, number>();

  for (const plan of plans) {
    orderSeq += 1;
    const customer = pick(customerDocs);
    const customerDoc = customer.doc as unknown as {
      _id: unknown;
      segment: string;
      creditLimit: number;
      creditUsed: number;
      totalOrderValue: number;
      orderCount: number;
      addresses: unknown[];
    };
    const sku = pick(skuList);
    const quantity = randInt(sku.pricing.minQty, sku.pricing.minQty * 4);
    const createdAt = daysAgo(plan.createdAtDaysAgo, randInt(9, 18));
    const printEnabled = rand() > 0.7;
    const paymentMethod = pick(['cod', 'cod', 'credit', 'razorpay'] as const);

    const chargeable = customerDoc.creditUsed + 0;
    void chargeable;
    const customerRecord = await Customer.findById(customerDoc._id).exec();
    if (!customerRecord) continue;

    const pricing = await computePricing({
      items: [{ skuId: String(sku._id), quantity, printSpec: printEnabled ? { type: 'single', sides: 1, colors: 2 } : null }],
      customerId: String(customerDoc._id),
      segment: customerDoc.segment,
      createdAt,
    });

    const statusLifecycle =
      plan.state === 'cancelled'
        ? ['placed', 'cancelled']
        : ['placed', 'paid', 'planned', 'in_production', 'qc', 'ready', 'dispatched', 'delivered', 'closed'];

    const history: Record<string, unknown>[] = [];
    let from = '';
    for (const state of statusLifecycle.slice(0, Math.max(1, statusLifecycle.indexOf(plan.state) + 1))) {
      history.push({ from, to: state, at: createdAt, by: adminUserId, reason: '', note: '' });
      from = state;
    }

    const itemDoc = {
      skuId: sku._id,
      skuCode: sku.skuCode,
      name: sku.name,
      quantity,
      dimensions: {},
      material: sku.category,
      printSpec: {
        type: printEnabled ? 'single' : 'none',
        sides: printEnabled ? 1 : 0,
        colors: printEnabled ? 2 : 0,
        artworkUrl: '',
        notes: '',
        plateChargePaise: pricing.setupChargePaise,
      },
      unitPricePaise: pricing.items[0]?.unitPricePaise ?? sku.pricing.basePricePaise,
      basePricePaise: sku.pricing.basePricePaise,
      setupChargePaise: pricing.setupChargePaise,
      discountPaise: pricing.discountPaise,
      taxRate: 18,
      lineTotalPaise: pricing.items[0]?.lineTotalPaise ?? 0,
      bomSnapshot: sku,
    };

    const amountPaid = plan.state === 'delivered' || plan.state === 'closed' ? pricing.grandTotalPaise : plan.state === 'dispatched' ? Math.round(pricing.grandTotalPaise / 2) : 0;
    const payment = {
      method: paymentMethod,
      status: amountPaid === 0 ? 'pending' : amountPaid >= pricing.grandTotalPaise ? 'paid' : 'partial',
      razorpayOrderId: paymentMethod === 'razorpay' ? `rzp_test_SEED${String(orderSeq).padStart(5, '0')}` : '',
      razorpayPaymentId: plan.state === 'delivered' || plan.state === 'closed' ? `pay_SEED${String(orderSeq).padStart(5, '0')}` : '',
      paidAt: amountPaid > 0 ? createdAt : null,
      amountPaidPaise: amountPaid,
      refunds: [],
    };

    const cancelled = plan.state === 'cancelled';
    const closed = plan.state === 'closed';
    const delivered = plan.state === 'delivered' || closed;
    const orderDoc = await Order.create({
      orderNumber: `ORD-2526-${String(orderSeq).padStart(5, '0')}`,
      customerId: customerDoc._id,
      status: plan.state,
      stateHistory: history,
      items: [itemDoc],
      pricing,
      payment,
      deliveryAddress: customerDoc.addresses[0] ?? {},
      requestedDeliveryDate: daysAgo(Math.max(-7, plan.createdAtDaysAgo - 7)),
      promisedDeliveryDate: daysAgo(Math.max(-7, plan.createdAtDaysAgo - 7)),
      notes: '',
      internalNotes: '',
      createdBy: customerUser._id,
      source: pick(['customer_app', 'customer_web', 'admin', 'phone', 'repeat'] as const),
      isRepeat: rand() > 0.6,
      cancelledAt: cancelled ? daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)) : null,
      cancelReason: cancelled ? 'Customer changed design' : '',
      placedAt: createdAt,
      closedAt: closed ? daysAgo(Math.max(0, plan.createdAtDaysAgo - 2)) : null,
      createdAt,
      updatedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 2)),
    });

    await Customer.findByIdAndUpdate(customerDoc._id, {
      $inc: cancelled || false
        ? { orderCount: 1 }
        : { orderCount: 1, totalOrderValue: pricing.grandTotalPaise },
    });
    if (paymentMethod === 'credit' && !cancelled) {
      await Customer.findByIdAndUpdate(customerDoc._id, { $inc: { creditUsed: pricing.grandTotalPaise } });
    }

    if (rand() > 0.9) {
      quoteSeq += 1;
      await Quote.create({
        quoteNumber: `QT-2526-${String(quoteSeq).padStart(5, '0')}`,
        customerId: customerDoc._id,
        items: [itemDoc],
        pricing,
        status: pick(['draft', 'sent', 'accepted'] as const),
        validUntil: daysAgo(-7),
        createdAt,
        updatedAt: createdAt,
      });
    }

    if (plan.stage) {
      const historyEntries = ['queued', 'received', 'cutting', 'creasing', 'printing', 'qc', 'rework', 'labelling', 'packing', 'ready'];
      const untilIndex = Math.max(0, historyEntries.indexOf(plan.stage));
      await ProductionJob.create({
        jobNumber: `JOB-2526-${String(orderSeq).padStart(5, '0')}`,
        orderId: orderDoc._id,
        orderNumber: orderDoc.orderNumber,
        items: [{ skuId: sku._id, skuCode: sku.skuCode, quantity, completedQty: plan.stage === 'ready' ? quantity : 0, wastedQty: randInt(0, 20) }],
        stage: plan.stage,
        stageHistory: historyEntries.slice(0, untilIndex + 1).map((stage, idx) => ({
          stage,
          at: new Date(createdAt.getTime() + idx * 86_400_000),
          by: adminUserId,
          deviceId: '',
          offline: false,
        })),
        priority: randInt(50, 150),
        scheduledDate: createdAt,
        materialReservations: [],
        qc:
          plan.stage === 'qc' || historyEntries.indexOf(plan.stage) > historyEntries.indexOf('qc')
            ? { checklist: [], result: plan.stage === 'rework' ? 'fail' : 'pass', reworkCount: plan.stage === 'rework' ? 1 : 0, notes: '' }
            : { checklist: [], result: null, reworkCount: 0, notes: '' },
        label: {},
        quantityCompleted: plan.stage === 'ready' ? quantity : 0,
        quantityScrapped: plan.stage === 'ready' ? randInt(0, 30) : 0,
        createdAt,
        updatedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 2)),
      });
    }

    if (['ready', 'dispatched', 'delivered', 'closed', 'rescheduled'].includes(plan.state)) {
      const deliveryStatus =
        plan.state === 'ready' ? pick(['unassigned', 'assigned'] as const)
        : plan.state === 'dispatched' ? 'in_transit'
        : plan.state === 'rescheduled' ? 'rescheduled'
        : 'delivered';
      const driver = deliveryStatus === 'unassigned' ? null : drivers[randInt(0, drivers.length - 1)];
      const vehicle = deliveryStatus === 'unassigned' ? null : vehicles[randInt(0, vehicles.length - 1)];
      const delivery = await Delivery.create({
        deliveryNumber: `DLV-2526-${String(orderSeq).padStart(5, '0')}`,
        orderId: orderDoc._id,
        customerId: customerDoc._id,
        address: customerDoc.addresses[0] ?? {},
        status: deliveryStatus,
        driverId: driver ? driver._id : null,
        vehicleId: vehicle ? vehicle._id : null,
        sequence: 0,
        pickup: deliveryStatus !== 'unassigned' ? { at: createdAt, lat: 11.02, lng: 76.96 } : {},
        pod: delivered
          ? { method: 'otp', otpVerifiedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)), recipientName: 'Contact', at: daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)) }
          : {},
        failedReason: deliveryStatus === 'rescheduled' ? 'Shop was closed' : '',
        proofOfDeliveryOtp: randInt(100000, 999999),
        plannedAt: deliveryStatus !== 'unassigned' ? daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)) : null,
        deliveredAt: delivered ? daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)) : null,
        distanceKm: Math.round(rand() * 40 + 3),
        etaMinutes: randInt(20, 90),
        trackings: deliveryStatus === 'in_transit' ? [{ lat: 11.02, lng: 76.98, at: daysAgo(1) }] : [],
        createdAt,
        updatedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 1)),
      });
      deliveryDocs.push(delivery as SeedDoc);
      await Order.findByIdAndUpdate(orderDoc._id, { deliveryId: delivery._id });
      if (delivered && driver) {
        const driverKey = String(driver._id);
        deliveredCountByDriver.set(driverKey, (deliveredCountByDriver.get(driverKey) ?? 0) + 1);
      }
    }

    if (['dispatched', 'delivered', 'closed'].includes(plan.state)) {
      const invoiceStatus = plan.state === 'dispatched' ? (paymentMethod === 'credit' ? 'unpaid' : 'unpaid') : delivered ? 'paid' : 'unpaid';
      const invoice = await Invoice.create({
        invoiceNumber: `INV-2526-${String(orderSeq).padStart(5, '0')}`,
        orderId: orderDoc._id,
        customerId: customerDoc._id,
        financialYear: '25-26',
        items: [
          {
            description: `${sku.name} (${sku.skuCode})`,
            hsnCode: '4819',
            qty: quantity,
            unit: 'pcs',
            unitPricePaise: pricing.items[0]?.unitPricePaise ?? 0,
            taxRate: 18,
            cgstPaise: Math.round(pricing.items[0]?.taxablePaise ?? 0) * 9 / 100,
            sgstPaise: Math.round(pricing.items[0]?.taxablePaise ?? 0) * 9 / 100,
            igstPaise: 0,
            lineTotalPaise: pricing.items[0]?.lineTotalPaise ?? 0,
          },
        ],
        placeOfSupply: '33',
        supplierGstin: '33AAECA0000L1ZP',
        customerGstin: '',
        subtotalPaise: pricing.subtotalPaise,
        discountPaise: pricing.discountPaise,
        cgstPaise: pricing.cgstPaise,
        sgstPaise: pricing.sgstPaise,
        igstPaise: pricing.igstPaise,
        roundOffPaise: pricing.roundOffPaise,
        grandTotalPaise: pricing.grandTotalPaise,
        amountInWords: '',
        status: invoiceStatus,
        issuedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 3)),
        dueDate: daysAgo(Math.max(0, plan.createdAtDaysAgo - 33)),
        paymentIds: [],
        createdAt,
        updatedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 2)),
      });
      invoiceDocs.push(invoice as SeedDoc);
      await Order.findByIdAndUpdate(orderDoc._id, { invoiceId: invoice._id });

      if (amountPaid > 0) {
        const paymentDoc = await Payment.create({
          paymentNumber: `PMT-2526-${String(orderSeq).padStart(5, '0')}`,
          orderId: orderDoc._id,
          invoiceId: invoice._id,
          customerId: customerDoc._id,
          provider: payment.method === 'razorpay' ? 'razorpay' : 'cash',
          method: payment.method === 'razorpay' ? 'upi' : 'cod',
          amountPaise: amountPaid,
          status: 'captured',
          providerOrderId: (payment.razorpayOrderId as string) || null,
          providerPaymentId: (payment.razorpayPaymentId as string) || null,
          reconciled: true,
          reconciledAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        });
        paymentDocs.push(paymentDoc as SeedDoc);
        await Invoice.findByIdAndUpdate(invoice._id, { $addToSet: { paymentIds: paymentDoc._id } });
      }
    }

    if (rand() > 0.93) {
      await RazorpayWebhook.create({
        eventId: `evt_seed_${String(Math.floor(rand() * 100000))}`,
        event: 'payment.captured',
        payload: {},
        status: 'processed',
        processedAt: daysAgo(Math.max(0, plan.createdAtDaysAgo - 2)),
      });
    }
  }

  // Driver delivery tallies
  for (const [driverId, count] of deliveredCountByDriver) {
    await Driver.findByIdAndUpdate(driverId, { totalDeliveries: count });
  }
  deliveredCountByDriver = new Map();

  // One planned route for tomorrow over some assignable deliveries.
  const routeDriver = drivers[0];
  const routeVehicle = vehicles[0];
  if (!routeDriver || !routeVehicle) throw new Error('Seed data misconfigured: drivers/vehicles');
  const routeCandidates = await Delivery.find({ status: 'assigned' }).limit(5).exec();
  if (routeCandidates.length >= 2) {
    const route = await DeliveryRoute.create({
      routeDate: daysAgo(-1),
      driverId: routeDriver._id,
      vehicleId: routeVehicle._id,
      stops: routeCandidates.map((d) => d._id),
      totalDistanceKm: Math.round(rand() * 80 + 40),
      totalDurationMinutes: routeCandidates.length * 15,
      status: 'planned',
      optimisedAt: new Date(),
    });
    for (const [index, stop] of routeCandidates.entries()) {
      await Delivery.findByIdAndUpdate(stop._id, { routeId: route._id, sequence: index + 1 });
    }
  }

  logger.info({ count: orderSeq }, `${orderSeq} orders, ${deliveryDocs.length} deliveries, ${invoiceDocs.length} invoices, ${paymentDocs.length} payments, ${quoteSeq} quotes seeded`);
}

async function seedCounters(): Promise<void> {
  await Counter.insertMany([
    { key: 'customer:all', value: 20, period: 'all' },
    { key: 'vendor:all', value: 5, period: 'all' },
    { key: 'driver:all', value: 3, period: 'all' },
    { key: 'vehicle:all', value: 3, period: 'all' },
    { key: 'order:25-26', value: 100, period: '25-26' },
    { key: 'job:25-26', value: 100, period: '25-26' },
    { key: 'delivery:25-26', value: 100, period: '25-26' },
    { key: 'invoice:25-26', value: 100, period: '25-26' },
    { key: 'payment:25-26', value: 100, period: '25-26' },
    { key: 'po:25-26', value: 4, period: '25-26' },
    { key: 'grn:25-26', value: 1, period: '25-26' },
    { key: 'quote:25-26', value: 10, period: '25-26' },
  ]);
  logger.info('counters seeded');
}

async function seedDelegationMatrix(): Promise<void> {
  const existing = await DelegationMatrix.countDocuments().exec();
  if (existing > 0) {
    await DelegationMatrix.deleteMany({}).exec();
  }
  await DelegationMatrix.insertMany(
    DELEGATION_DEFAULTS.map((row) => ({ ...row, updatedBy: null })),
  );
  logger.info('delegation matrix seeded');
}

/** OFF-3: weekly route plan per the shop's standing schedule. */
async function seedRouteSchedules(customerDocs: CustomerSeeded[]): Promise<void> {
  const { RouteSchedule } = await import('../modules/office/office.model.js');
  await RouteSchedule.deleteMany({}).exec();
  const pickForRange = (from: number, to: number) => customerDocs.slice(from, to).map((row) => row.doc._id);
  await RouteSchedule.insertMany([
    { weekday: 2, area: 'Wandoor', kind: 'retail', customers: pickForRange(0, 6), active: true },
    { weekday: 4, area: 'Vengara', kind: 'retail', customers: pickForRange(6, 12), active: true },
    { weekday: 6, area: 'Perinthalmanna', kind: 'wholesale', customers: pickForRange(0, 8), active: true },
  ]);
  logger.info('route schedules seeded');
}

/**
 * The proforma invoice used as the quotation-view reference: D Packo →
 * T&T Hospitality, 6,00,000 SP @ ₹2.35, 5% GST. Idempotent, and runs even on
 * an already-seeded database. The company profile is only filled when blank.
 */
async function seedReferenceQuote(): Promise<void> {
  const company = await Company.findById('org').lean<{ name?: string }>().exec();
  if (!company?.name) {
    await Company.findByIdAndUpdate(
      'org',
      {
        $set: {
          name: 'D PACKO PACKAGING SOLUTIONS',
          address: '29/229, MELMURI\nMALAPPURAM',
          phone: '+919846994836',
          gstin: '32FJIPS7458N1ZB',
          stateName: 'Kerala',
          stateCode: '32',
        },
      },
      { upsert: true },
    ).exec();
  }

  const sku = await CatalogSku.findOneAndUpdate(
    { skuCode: 'SP' },
    {
      $setOnInsert: {
        skuCode: 'SP',
        name: 'SP',
        category: 'parcel_box',
        material: 'kraft',
        pricing: { basePricePaise: 235, minQty: 10_000, taxRate: 5, hsnCode: '4819' },
      },
    },
    { upsert: true, new: true },
  ).exec();

  const customer = await Customer.findOneAndUpdate(
    { customerCode: 'CUS-TT-0001' },
    {
      $setOnInsert: {
        customerCode: 'CUS-TT-0001',
        businessName: 'T&T HOSPITALITY LLP',
        phone: '+919846000311',
        gstin: '32AAVFT2837P1ZD',
        segment: 'large',
        addresses: [
          {
            label: 'Registered office',
            line1: '9/154/S, U.T.R. CH ROAD',
            area: 'MOONNIYUR',
            city: 'CHINAKKAL',
            district: 'MALAPPURAM',
            state: 'KL',
            pincode: '676311',
            isDefault: true,
          },
        ],
      },
    },
    { upsert: true, new: true },
  ).exec();

  await seedReferenceInvoice(String(customer._id), String(sku._id));

  if (await Quote.exists({ quoteNumber: 'QT-DEMO-00001' })) return;
  const issued = new Date('2026-10-13T10:00:00+05:30');
  await Quote.create({
    quoteNumber: 'QT-DEMO-00001',
    customerId: customer._id,
    items: [
      {
        skuId: sku._id,
        skuCode: 'SP',
        name: 'SP',
        quantity: 600_000,
        unitPricePaise: 235,
        basePricePaise: 235,
        taxRate: 5,
        hsnCode: '4819',
        unit: 'NOS',
        lineTotalPaise: 148_050_000,
      },
    ],
    pricing: {
      subtotalPaise: 141_000_000,
      taxPaise: 7_050_000,
      cgstPaise: 3_525_000,
      sgstPaise: 3_525_000,
      grandTotalPaise: 148_050_000,
    },
    status: 'sent',
    validUntil: new Date(issued.getTime() + 14 * 86_400_000),
    createdAt: issued,
    updatedAt: issued,
  });
  logger.info('Reference quote QT-DEMO-00001 seeded');
}

/** Matching tax invoice for the reference quote (INV-DEMO-00001). Idempotent. */
async function seedReferenceInvoice(customerId: string, skuId: string): Promise<void> {
  if (await Invoice.exists({ invoiceNumber: 'INV-DEMO-00001' })) return;
  const issued = new Date('2026-10-20T10:00:00+05:30');
  await Invoice.create({
    invoiceNumber: 'INV-DEMO-00001',
    customerId,
    financialYear: '26-27',
    title: 'Tax Invoice',
    layout: 'tally',
    copies: ['original', 'duplicate'],
    buyerOrderNo: 'PO-TT-118',
    buyerOrderDate: new Date('2026-10-14T00:00:00+05:30'),
    dispatch: {
      paymentTerms: '15 days credit',
      deliveryNote: 'DN-0412',
      dispatchedThrough: 'Own vehicle',
      destination: 'Chinakkal',
      vehicleNo: 'KL-10-AB-1234',
      ewayBillNo: '321098765432',
      termsOfDelivery: 'Door delivery, freight paid.',
    },
    items: [
      {
        description: 'SP',
        name: 'SP',
        skuId,
        hsnCode: '4819',
        qty: 600_000,
        unit: 'NOS',
        unitPricePaise: 235,
        taxRate: 5,
        cgstPaise: 3_525_000,
        sgstPaise: 3_525_000,
        lineTotalPaise: 148_050_000,
      },
    ],
    placeOfSupply: '32',
    supplierGstin: '32FJIPS7458N1ZB',
    customerGstin: '32AAVFT2837P1ZD',
    subtotalPaise: 141_000_000,
    cgstPaise: 3_525_000,
    sgstPaise: 3_525_000,
    grandTotalPaise: 148_050_000,
    amountInWords: 'Rupees Fourteen Lakh Eighty Thousand Five Hundred Only',
    status: 'unpaid',
    issuedAt: issued,
    dueDate: new Date(issued.getTime() + 15 * 86_400_000),
    terms: ['Interest @18% p.a. will be charged on bills not paid by the due date.'],
    schemaVersion: 2,
  });
  logger.info('Reference invoice INV-DEMO-00001 seeded');
}

async function main() {
  await connectDatabase();
  logger.info('Seeding demo data');
  await seedReferenceQuote();

  // The demo seed is designed for a fresh database.
  const existing = await Order.countDocuments();
  if (existing > 0) {
    logger.info({ existing }, 'orders already present, skipping full demo seed');
    await disconnectDatabase();
    return;
  }

  const passwordHash = await hashPassword('Password123!');
  const { customerUser } = await seedStaffAndUsers(passwordHash);
  const adminUser = await userRepository.findByPhone('+919000000001');

  const customerDocs = await seedCustomers();
  const { vendors: vendorDocs } = await seedVendors();
  const materials = await seedMaterials();
  await seedCatalog(materials);
  await seedStockAndMovements(materials);
  await seedPurchasing(materials, vendorDocs);
  await seedMachines();
  const { drivers, vehicles } = await seedDriversAndVehicles();

  const skuDocs = await CatalogSku.find({}, null, { sort: 'skuCode' }).exec() as SeedDoc[];
  await seedOrders(customerDocs, skuDocs, drivers, vehicles, customerUser, String(adminUser?._id ?? ''));

  await seedCounters();
  await seedOneGoodsReceipt(materials, vendorDocs);
  await seedDelegationMatrix();
  await seedRouteSchedules(customerDocs);
  await seedReminderRules();
  await seedRegisters(customerDocs);

  // Seeding concurrently with a running API process (dev harness) keeps the
  // connection open; standalone runs disconnect so node exits cleanly.
  if (process.env.SEED_KEEP_CONNECTION !== '1') {
    await disconnectDatabase();
  }
  logger.info('Seed complete');
}

async function seedOneGoodsReceipt(materials: SeedMaterial[], vendorDocs: SeedVendor[]): Promise<void> {
  const vendor = vendorDocs[0];
  const material = materials[0];
  if (!vendor || !material) throw new Error('Seed data misconfigured: GRN inputs');
  await GoodsReceipt.create({
    grnNumber: 'GRN-2526-00001',
    purchaseOrderId: null,
    vendorId: vendor._id,
    items: [
      {
        materialId: material._id,
        orderedQty: 40,
        receivedQty: 40,
        rejectedQty: 0,
        unitCostPaise: material.unitCostPaise,
        binLocation: 'STORE-1',
      },
    ],
    invoiceNumber: 'SPT-INV-902',
    status: 'posted',
    postedAt: daysAgo(5),
  });
  logger.info('goods receipt seeded');
}

/** Resolves when the demo seed has finished (or the run already had data). */
export const seedDone: Promise<void> = main().catch((error) => {
  logger.error({ err: error }, 'Seed failed');
  process.exit(1);
});

/**
 * Reminder rules (M7) — BullMQ repeatables are synced from these every leg.
 */
async function seedReminderRules(): Promise<void> {
  const { ReminderRule } = await import('../modules/office/office.model.js');
  await ReminderRule.insertMany(
    [
      { key: 'opening-checklist', kind: 'checklist_opening', cron: '0 7 * * *', title: 'Morning checklist reminder' },
      { key: 'closing-checklist', kind: 'checklist_closing', cron: '0 20 * * *', title: 'End-of-day closing reminder' },
      { key: 'route-day', kind: 'route_day', cron: '0 6 * * 2,4,6', title: 'Today is a scheduled visit route day' },
      { key: 'outstanding-followup', kind: 'outstanding_followup', cron: '30 9 * * *', title: 'Review outstanding follow-ups' },
      { key: 'maintenance-monthly', kind: 'maintenance', cron: '0 9 1 * *', title: 'Monthly facility checks' },
      { key: 'sop-annual-review', kind: 'sop_review', cron: '0 9 1 1 *', title: 'Annual SOP document review' },
    ],
    {
      ordered: false,
    },
  );
  logger.info('reminder rules seeded');
}

/** Office register rows (M6/M8): courier, stationery, waste, petty cash, docs. */
async function seedRegisters(customerDocs: CustomerSeeded[]): Promise<void> {
  const officePicker = await userRepository.findByPhone('+919000000007');
  const officeId = officePicker?._id;
  if (!officeId) throw new Error('Seed data misconfigured: office_admin missing');
  const { CourierEntry, StationeryItem, WasteLog, PettyCashEntry, Deviation, DocumentsMaster } =
    await import('../modules/office/office.model.js');

  await CourierEntry.create({
    docketNo: 'DT-99901',
    direction: 'sent',
    routeTo: 'Mrudula Printers',
    customerId: customerDocs[0] ? String(customerDocs[0].doc._id) : null,
    dispatchedAt: new Date(),
    by: officeId,
  });
  await CourierEntry.create({
    docketNo: 'DT-99902',
    direction: 'received',
    company: 'India Post',
    podRef: 'POD-114',
    receivedAt: daysAgo(1),
    receivedBy: 'Front desk',
    by: officeId,
  });

  await StationeryItem.create({ name: 'A4 paper ream', unit: 'pcs', qty: 4, reorderLevel: 10, avgCostPaise: 28_000 });
  await StationeryItem.create({ name: 'Binding clips', unit: 'box', qty: 25, reorderLevel: 10, avgCostPaise: 6_500 });

  await WasteLog.create({ type: 'paper', qty: 18.5, unit: 'kg', handler: 'Haritha Karma Sena', note: 'Reduced sheets', at: daysAgo(2), by: officeId });
  await PettyCashEntry.create({ date: new Date().toISOString().slice(0, 10), purpose: 'Courier charge', requester: 'Front desk', amountPaise: 30_000, by: officeId });

  await Deviation.create({
    kind: 'near_miss',
    severity: 'low',
    category: 'facility',
    immediateEscalation: false,
    detail: 'Forklift clipped the shutter frame — no injuries',
    correctiveAction: 'Convex mirror planned at ramp',
    openedBy: null,
  });

  await DocumentsMaster.create({ docNo: 'ADM-SOP-1', fileName: 'office_sop.pdf', docType: 'other', date: '2025-04-01', accessRoles: ['office_admin', 'admin'], retentionUpto: '2045-04-01' });
  await DocumentsMaster.create({ docNo: 'ACC-FRM-2', fileName: 'gst_sale_book_25-26.xlsx', docType: 'gst_sale', date: '2025-04-01', accessRoles: ['finance', 'office_admin', 'admin'], retentionUpto: '2045-04-01' });

  await OutstandingsSeed(customerDocs, String(officeId));
  await AppointmentSeed(officeId.toHexString());

  logger.info('office register rows seeded');
}

/** Daily deal + overdue follow-ups and a small-outstanding sample. */
async function OutstandingsSeed(customerDocs: CustomerSeeded[], officeId: string): Promise<void> {
  const { OutstandingFollowup, SmallOutstandingLedger } = await import('../modules/office/office.model.js');
  await OutstandingFollowup.create({
    customerId: customerDocs[0] ? customerDocs[0].doc._id : undefined,
    date: new Date().toISOString().slice(0, 10),
    amountPaise: 5_000_00,
    promiseDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    outcome: 'promise_made',
    by: officeId,
  });
  await SmallOutstandingLedger.create({
    customerId: customerDocs[1] ? customerDocs[1].doc._id : undefined,
    amountPaise: 850_00,
    reason: 'Short cash note on delivery round',
    createdOn: new Date().toISOString().slice(0, 10),
    createdBy: officeId,
  });
}

/** A visitor book row for the My Day screen. */
async function AppointmentSeed(officeIdHex: string): Promise<void> {
  const { Appointment } = await import('../modules/office/office.model.js');
  await Appointment.create({
    kind: 'visitor',
    personName: 'Binoy Kumar',
    organization: 'Perintalmanna Traders',
    contact: '+919446002204',
    purpose: 'Cement bag sample drop',
    date: new Date().toISOString().slice(0, 10),
    idType: 'AADHAAR',
    idNumber: 'AQaAQa1234',
    createdBy: officeIdHex,
  });
}

/** Resolves when the demo seed has finished (or the run already had data). */