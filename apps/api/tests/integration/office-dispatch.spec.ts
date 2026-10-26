import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
import { inventoryService } from '../../src/modules/inventory/inventory.service.js';
import { Material } from '../../src/modules/inventory/inventory.model.js';
import { Order } from '../../src/modules/orders/orders.model.js';
import { isoBusinessDay } from '../../src/modules/office/office.service.js';
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

describe('dispatch, complaints & stock alerts (Module 5)', () => {
  let officeToken = '';
  let officeId = '';
  let customerId = '';

  async function seedCustomer(): Promise<string> {
    const [customer] = await Customer.create([
      {
        customerCode: `CUS-DP-${Math.floor(Math.random() * 1_000_000)}`,
        businessName: 'Mukkam Bakery',
        phone: `+9143${Math.floor(Math.random() * 1_000_000_000)}`,
        segment: 'small',
        isBlacklisted: false,
      },
    ]);
    return String(customer._id);
  }

  async function seedOrder(daysAhead: number): Promise<string> {
    const requested = new Date(Date.now() + daysAhead * 86_400_000);    const [order] = await Order.create([
      {
        orderNumber: `ORD-DP-${Math.floor(Math.random() * 1_000_000)}`,
        customerId,
        status: 'ready',
        requestedDeliveryDate: requested,
        items: [],
        pricing: { subtotalPaise: 0, discountPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, roundOffPaise: 0, grandTotalPaise: 0 },
      },
    ]);
    return String(order._id);
  }

  beforeAll(async () => {
    await startTestDb();
    officeId = await seedUser('+916000000001', Role.OfficeAdmin);
    officeToken = await login('+916000000001');
    customerId = await seedCustomer();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    customerId = await seedCustomer();
  });

  afterEach(async () => {
    const { OfficeComplaint } = await import('../../src/modules/office/office.model.js');
    const { Delivery, Driver, Vehicle } = await import('../../src/modules/delivery/delivery.model.js');
    await Promise.all([
      OfficeComplaint.deleteMany({}).exec(),
      Delivery.deleteMany({}).exec(),
      Driver.deleteMany({}).exec(),
      Vehicle.deleteMany({}).exec(),
      Order.deleteMany({}).exec(),
      Customer.deleteMany({}).exec(),
    ]);
  });

  it('renders the dispatch board with today / delayed buckets', async () => {
    const due = await seedOrder(0);
    await seedOrder(-3);

    const board = await api()
      .get('/api/v1/office/dispatch-board')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(board.status).toBe(200);
    const dueToday = board.body.data.dueToday as { orderId: string }[];
    const delayed = board.body.data.delayed as { orderId: string }[];
    expect(dueToday.some((row) => row.orderId === due)).toBe(true);
    expect(delayed.length).toBeGreaterThanOrEqual(1);
    expect(delayed[0]?.delivery).toBeNull();
  });

  it('records and resolves a complaint with ticket numbers', async () => {
    const created = await api()
      .post('/api/v1/office/complaints')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, kind: 'product', title: 'Printing misaligned', detail: 'Logo shifted 3mm on 200 boxes', guidance: 'Check plate registration before reprint' });
    expect(created.status).toBe(200);
    expect(created.body.data.ticketNo).toMatch(/^CMP-/);
    const complaintId = created.body.data._id as string;

    const updated = await api()
      .patch(`/api/v1/office/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'resolved', resolution: 'Reprinted 200 boxes, RAF free of charge' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('resolved');
    expect(updated.body.data.closureDate).toBe(isoBusinessDay());

    const reopened = await api()
      .patch(`/api/v1/office/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'open' });
    expect(reopened.status).toBe(200);

    void complaintId;
  });

  it('closes complaints immutably', async () => {
    const created = await api()
      .post('/api/v1/office/complaints')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, kind: 'service', detail: 'Late delivery on Saturday route' });
    expect(created.status).toBe(200);
    const id = created.body.data._id as string;

    const closed = await api()
      .patch(`/api/v1/office/complaints/${id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'closed', resolution: 'Driver warned' });
    expect(closed.status).toBe(200);

    const immutability = await api()
      .patch(`/api/v1/office/complaints/${id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'open' });
    expect(immutability.status).toBe(409);
  });

  it('lists low-stock alerts and cycles the acknowledgement', async () => {
    const [material] = await Material.create([
      {
        materialCode: `MAT-DP-${Math.floor(Math.random() * 1_000_000)}`,
        name: 'Kraft roll 100gsm',
        category: 'kraft_paper',
        unit: 'kg',
        reorderPoint: 100,
        reorderQuantity: 400,
      },
    ]);
    const materialId = String(material._id);

    const alerts = await api()
      .get('/api/v1/office/stock-alerts')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(alerts.status).toBe(200);
    const rows = alerts.body.data as { materialId: string; onHand: number; reorderPoint: number; ack: unknown }[];
    const mine = rows.find((row) => row.materialId === materialId);
    expect(mine).toBeTruthy();
    expect(mine?.onHand).toBe(0);
    expect(mine?.ack).toBeNull();

    const acked = await api()
      .post(`/api/v1/office/stock-alerts/${materialId}/ack`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ note: 'PO raised to vendor' });
    expect(acked.status).toBe(200);
    expect(acked.body.data.minQtyAlertAck.note).toBe('PO raised to vendor');

    // Restocking above the reorder point clears the ack.
    await inventoryService.adjust({ materialId, quantity: 500, location: 'STORE-1', reason: 'restock' }, String(officeId));
    const after = await api()
      .get('/api/v1/office/stock-alerts')
      .set('Authorization', `Bearer ${officeToken}`);
    const afterRows = after.body.data as { materialId: string; ack: unknown; onHand: number }[];
    expect(afterRows.some((row) => row.materialId === materialId)).toBe(false);
    const materialDoc = await Material.findById(materialId);
    expect(materialDoc?.minQtyAlertAck).toBeNull();
  });
});
