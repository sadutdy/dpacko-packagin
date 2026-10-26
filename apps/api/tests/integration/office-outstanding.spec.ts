import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
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

async function seedCustomer(creditUsedPaise = 0): Promise<string> {
  const [customer] = await Customer.create([
    {
      customerCode: `CUS-OU-${Math.floor(Math.random() * 1_000_000)}`,
      businessName: 'Perinthalmanna Stores',
      phone: `+9142${Math.floor(Math.random() * 1_000_000_000)}`,
      segment: 'mid',
      creditLimit: 20_000_00,
      creditUsed: creditUsedPaise,
      paymentTermsDays: 15,
      isBlacklisted: false,
    },
  ]);
  return String(customer._id);
}

async function seedOrder(customerId: string): Promise<string> {
  const [order] = await Order.create([
    {
      orderNumber: `ORD-OU-${Math.floor(Math.random() * 1_000_000)}`,
      customerId,
      status: 'placed',
      items: [],
      pricing: { subtotalPaise: 0, discountPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, roundOffPaise: 0, grandTotalPaise: 0 },
    },
  ]);
  return String(order._id);
}

describe('outstanding (Module 4)', () => {
  let officeToken = '';

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+915000000001', Role.OfficeAdmin);
    officeToken = await login('+915000000001');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    const { Deviation, DailyCashClose, OutstandingFollowup, SmallOutstandingLedger } = await import(
      '../../src/modules/office/office.model.js'
    );
    await Promise.all([
      Customer.deleteMany({}).exec(),
      Order.deleteMany({}).exec(),
      Deviation.deleteMany({}).exec(),
      DailyCashClose.deleteMany({}).exec(),
      OutstandingFollowup.deleteMany({}).exec(),
      SmallOutstandingLedger.deleteMany({}).exec(),
    ]);
  });

  it('shows credit customers with latest followup in daily view', async () => {
    const customerId = await seedCustomer(150_000);
    const other = await seedCustomer(0);

    const followup = await api()
      .post(`/api/v1/office/outstanding/${customerId}/followup`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ promiseDate: isoBusinessDay(), outcome: 'Promised to clear by tomorrow' });
    expect(followup.status).toBe(200);
    expect(followup.body.data.amountPaise).toBe(150_000);

    const daily = await api()
      .get('/api/v1/office/outstanding?view=daily')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(daily.status).toBe(200);
    const rows = daily.body.data.rows as { customerId: string; creditUsedPaise: number; overdue: boolean }[];
    const mine = rows.find((row) => row.customerId === customerId);
    expect(mine?.creditUsedPaise).toBe(150_000);
    expect(mine?.overdue).toBe(false);
    expect(rows.some((row) => row.customerId === other)).toBe(false);
  });

  it('flags overdue customers and raises one missed_deadline deviation', async () => {
    const customerId = await seedCustomer(250_000);
    // A stale promise (2 days ago) breaches the default one-working-day SLO.
    const followup = await api()
      .post(`/api/v1/office/outstanding/${customerId}/followup`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ promiseDate: isoBusinessDay(new Date(Date.now() - 2 * 86_400_000)), outcome: 'Will settle' });
    expect(followup.status).toBe(200);

    const overdue = await api()
      .get('/api/v1/office/outstanding?view=overdue')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(overdue.status).toBe(200);
    const rows = overdue.body.data.rows as { customerId: string; overdue: boolean }[];
    expect(rows.some((row) => row.customerId === customerId)).toBe(true);

    const again = await api()
      .get('/api/v1/office/outstanding?view=overdue')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(again.status).toBe(200);

    const { Deviation } = await import('../../src/modules/office/office.model.js');
    const deviations = await Deviation.find({ customerId, kind: 'missed_deadline' }).exec();
    expect(deviations.length).toBe(1);
  });

  it('books small entries, applies them to an order, and reports pending totals', async () => {
    const customerId = await seedCustomer(0);

    const entry = await api()
      .post('/api/v1/office/outstanding/small')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, amountPaise: 3500, reason: 'Short collected on last visit' });
    expect(entry.status).toBe(200);
    expect(entry.body.data.settled).toBe(false);

    await api()
      .post('/api/v1/office/outstanding/small')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, amountPaise: 2500 });

    const context = await api()
      .get(`/api/v1/office/followups/screen-context/${customerId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(context.status).toBe(200);
    expect(context.body.data.pendingSmallOutstandingPaise).toBe(6000);

    // A zero-credit customer can also take small entries — followup refuses.
    const followup = await api()
      .post(`/api/v1/office/outstanding/${customerId}/followup`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ promiseDate: isoBusinessDay(), outcome: 'Nothing due' });
    expect(followup.status).toBe(409);

    const orderId = await seedOrder(customerId);
    const applied = await api()
      .post(`/api/v1/office/outstanding/${customerId}/apply-to-order`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ orderId });
    expect(applied.status).toBe(200);
    expect(applied.body.data.appliedCount).toBe(2);
    expect(applied.body.data.appliedPaise).toBe(6000);

    const after = await api()
      .get('/api/v1/office/outstanding?view=small')
      .set('Authorization', `Bearer ${officeToken}`);
    const smallRows = after.body.data.rows as { customerId: string }[];
    expect(smallRows.some((row) => row.customerId === customerId)).toBe(false);
  });

  it('rejects applying small outstanding to other customers or closed orders', async () => {
    const customerId = await seedCustomer(0);
    await seedOrder(customerId);
    const foreignCustomer = await seedCustomer(0);

    await api()
      .post('/api/v1/office/outstanding/small')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, amountPaise: 2000 });

    const otherOrder = await seedOrder(foreignCustomer);
    const wrongOrder = await api()
      .post(`/api/v1/office/outstanding/${customerId}/apply-to-order`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ orderId: otherOrder });
    expect(wrongOrder.status).toBe(409);
  });

  it('closes the day: cash entries with totals', async () => {
    const customerId = await seedCustomer(0);
    const orderId = await seedOrder(customerId);
    const first = await api()
      .post('/api/v1/office/daily-cash')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ orderId, customerId, collectedPaise: 41_200, expensesPaise: 500, outstandingPaise: 800 });
    expect(first.status).toBe(200);
    expect(first.body.data.date).toBe(isoBusinessDay());

    await api()
      .post('/api/v1/office/daily-cash')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ collectedPaise: 10_000, expensesPaise: 0, outstandingPaise: 0 });

    const day = await api()
      .get('/api/v1/office/daily-cash')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(day.status).toBe(200);
    expect(day.body.data.totals.collectedPaise).toBe(51_200);
    expect(day.body.data.totals.expensesPaise).toBe(500);
    expect(day.body.data.rows.length).toBe(2);
  });
});
