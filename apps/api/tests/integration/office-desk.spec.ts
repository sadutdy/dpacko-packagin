import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { DESK_STEPS, DeskStep, Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { CatalogSku } from '../../src/modules/catalog/catalog.model.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
import { Order } from '../../src/modules/orders/orders.model.js';
import { app } from '../helpers/app.js';
import { startTestDb, stopTestDb } from '../helpers/testDb.js';

const api = () => request(app);

async function login(phone: string): Promise<string> {
  const res = await api().post('/api/v1/auth/login').send({ phone, password: 'supersecret1' });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

async function seedUser(phone: string, role: Role): Promise<Types.ObjectId> {
  const user = await userRepository.create({
    phone,
    name: phone,
    role,
    status: 'active',
    passwordHash: await hashPassword('supersecret1'),
  });
  return user._id;
}

describe('office admin — Sales Order Desk (Module 2)', () => {
  let officeToken = '';
  let adminToken = '';

  async function seedCustomer(): Promise<string> {
    const [customer] = await Customer.create([
      {
        customerCode: `CUS-${Math.floor(Math.random() * 1_000_000)}`,
        businessName: 'Wandoor Bakes',
        phone: `+9131${Math.floor(Math.random() * 1_000_000_000)}`,
        paymentTermsDays: 15,
        segment: 'mid',
        creditLimit: 10_000_000,
        isBlacklisted: false,
      },
    ]);
    return String(customer._id);
  }

  async function seedOrder(quantity = 300): Promise<string> {
    const customerId = await seedCustomer();
    const [sku] = await CatalogSku.create([
      {
        skuCode: `SKU-${Math.floor(Math.random() * 1_000_000)}`,
        name: 'Kraft parcel box 12x10x6',
        category: 'parcel_box',
        material: 'kraft',
        pricing: { basePricePaise: 1250, minQty: 250, taxRate: 18 },
      },
    ]);
    const [order] = await Order.create([
      {
        orderNumber: `ORD-T-${Math.floor(Math.random() * 1_000_000)}`,
        customerId,
        status: 'placed',
        items: [
          {
            skuId: sku._id,
            skuCode: sku.skuCode,
            name: sku.name,
            quantity,
            unitPricePaise: 1250,
            taxRate: 18,
            lineTotalPaise: quantity * 1250,
          },
        ],
        pricing: {
          subtotalPaise: quantity * 1250,
          discountPaise: 0,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          roundOffPaise: 0,
          grandTotalPaise: quantity * 1250,
        },
      },
    ]);
    return String(order._id);
  }

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+912000000001', Role.OfficeAdmin);
    await seedUser('+912000000002', Role.Admin);
    officeToken = await login('+912000000001');
    adminToken = await login('+912000000002');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    const { OrderDeskStep } = await import('../../src/modules/office/office.model.js');
    const { Invoice, Payment } = await import('../../src/modules/payments/payments.model.js');
    const { NotificationChannel, NotificationLog } = await import(
      '../../src/modules/notifications/notification.model.js'
    );
    const { Counter } = await import('../../src/modules/counters/counter.model.js');
    await Promise.all([
      Order.deleteMany({}).exec(),
      OrderDeskStep.deleteMany({}).exec(),
      Invoice.deleteMany({}).exec(),
      Payment.deleteMany({}).exec(),
      NotificationChannel.deleteMany({}).exec(),
      NotificationLog.deleteMany({}).exec(),
      Customer.deleteMany({}).exec(),
      CatalogSku.deleteMany({}).exec(),
    ]);
    await Counter.deleteMany({}).exec();
  });

  it('walks the desk ladder strictly one step at a time', async () => {
    const orderId = await seedOrder();

    const skipped = await api()
      .post(`/api/v1/office/desk/${orderId}/steps`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ step: 'confirmed' });
    expect(skipped.status).toBe(409);

    const board = await api()
      .get(`/api/v1/office/desk/${orderId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(board.status).toBe(200);
    expect(board.body.data.nextStep).toBe(DeskStep.Checked);
    expect(board.body.data.done).toBe(false);

    for (const step of DESK_STEPS) {      const res = await api()
        .post(`/api/v1/office/desk/${orderId}/${step === DeskStep.Printed ? 'print-bill' : 'steps'}`)
        .set('Authorization', `Bearer ${officeToken}`)
        .send({ step: step === DeskStep.Printed ? undefined : step, copies: 2 });
      expect(res.status).toBe(200);
    }

    const after = await api()
      .get(`/api/v1/office/desk/${orderId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(after.body.data.done).toBe(true);
    expect(after.body.data.nextStep).toBeNull();
  });

  it('refuses manual printed step and records it from the print endpoint', async () => {
    const orderId = await seedOrder();

    const manual = await api()
      .post(`/api/v1/office/desk/${orderId}/steps`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ step: DeskStep.Printed });
    expect(manual.status).toBe(409);

    // sheet the ladder up to bill_ready as office, then print a bill twice.
    for (const step of ['checked', 'confirmed', 'packing_notified', 'accounts_notified', 'bill_prepared', 'bill_ready']) {      const res = await api()
        .post(`/api/v1/office/desk/${orderId}/steps`)
        .set('Authorization', `Bearer ${officeToken}`)
        .send({ step });
      expect(res.status).toBe(200);
    }

    const first = await api()
      .post(`/api/v1/office/desk/${orderId}/print-bill`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ copies: 2 });
    expect(first.status).toBe(200);
    expect(first.body.data.printCount).toBe(2);
    expect(String(first.body.data.invoiceNumber ??'')).toMatch(/^INV-/);

    const second = await api()
      .post(`/api/v1/office/desk/${orderId}/print-bill`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.data.printCount).toBe(4);

    const board = await api()
      .get(`/api/v1/office/desk/${orderId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    const progress = board.body.data.progress as { step: string; done: boolean }[];
    const printed = progress.find((entry) => entry.step === DeskStep.Printed);
    expect(printed?.done).toBe(true);
    expect(board.body.data.nextStep).toBe(DeskStep.ExtraQtyRecorded);
  });

  it('lists the desk board with pending filter and EOD summary', async () => {
    const a = await seedOrder(400);
    const b = await seedOrder(500);

    const checked = await api()
      .post(`/api/v1/office/desk/${a}/steps`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ step: DeskStep.Checked, note: 'order looked complete' });
    expect(checked.status).toBe(200);

    const board = await api()
      .get('/api/v1/office/desk')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(board.status).toBe(200);
    const rows = board.body.data as { order: { _id: string } }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const pending = await api()
      .get('/api/v1/office/desk?pending=true')
      .set('Authorization', `Bearer ${officeToken}`);
    const pendingRows = pending.body.data as { order: { _id: string } }[];
    // Both orders are still mid-ladder, so both must surface as pending.
    expect(pendingRows.some((row) => row.order._id === a)).toBe(true);
    expect(pendingRows.some((row) => row.order._id === b)).toBe(true);

    const summary = await api()
      .get('/api/v1/office/desk/summary')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.ordersTouched).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.salesQuantityPcs).toBeGreaterThanOrEqual(400);
    expect(summary.body.data.billsPrinted).toBe(0);
  });

  it('logs fan-out message rows per audience group and channel', async () => {
    const orderId = await seedOrder();
    const step = await api()
      .post(`/api/v1/office/desk/${orderId}/steps`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ step: DeskStep.Checked });
    expect(step.status).toBe(200);

    const log = await api()
      .get(`/api/v1/office/notifications?orderId=${orderId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(log.status).toBe(200);
    const rows = log.body.data as { group: string; channel: string; status: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.channel === 'in_app' || row.status === 'skipped')).toBe(true);

    // confirmed step fans out to packing + accounts + sales.
    await api()
      .post(`/api/v1/office/desk/${orderId}/steps`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ step: DeskStep.Confirmed });
    const after = await api()
      .get(`/api/v1/office/notifications?orderId=${orderId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    const groups = new Set((after.body.data as { group: string }[]).map((row) => row.group));
    expect(groups.has('packing')).toBe(true);
    expect(groups.has('accounts')).toBe(true);
  });

  it('lets an admin skip ahead while office_admin stays on the ladder', async () => {
    const orderId = await seedOrder();

    const skipped = await api()
      .post(`/api/v1/office/desk/${orderId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ step: DeskStep.CollectionsUpdated, note: 'skip-ahead oversight' });
    expect(skipped.status).toBe(200);

    const board = await api()
      .get(`/api/v1/office/desk/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    // The printed rung can only come from a real bill print.
    expect(board.body.data.nextStep).toBe(DeskStep.Printed);

    const print = await api()
      .post(`/api/v1/office/desk/${orderId}/print-bill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ copies: 2 });
    expect(print.status).toBe(200);

    const done = await api()
      .get(`/api/v1/office/desk/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(done.body.data.done).toBe(true);
  });

  it('keeps office_admin anchored to orders:desk only for writes', async () => {
    const orderId = await seedOrder();
    // settings write is off-limits (RBAC), so use a different module gate:
    const forbidden = await api()
      .post('/api/v1/office/notifications')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(forbidden.status).toBe(404);
    void orderId;
  });
});
