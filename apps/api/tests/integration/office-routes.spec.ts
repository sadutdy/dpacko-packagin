import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
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

describe('office admin — follow-ups & routes (Module 3)', () => {
  let officeToken = '';
  let customerId = '';

  async function seedCustomer(): Promise<string> {
    const [customer] = await Customer.create([
      {
        customerCode: `CUS-FU-${Math.floor(Math.random() * 1_000_000)}`,
        businessName: 'Vengara Sweets',
        phone: `+9141${Math.floor(Math.random() * 1_000_000_000)}`,
        segment: 'mid',
        creditLimit: 5_000_000,
        isBlacklisted: false,
        deskNotes: {
          preferredLanguage: 'ta',
          boxSizeHabits: ['9x9x5', '10x10x5'],
          otherReplies: 'Takes a mix, confirm sizes each call.',
          followUpPrefs: 'Call after 4pm.',
        },
      },
    ]);
    return String(customer._id);
  }

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+914000000001', Role.OfficeAdmin);
    officeToken = await login('+914000000001');
    customerId = await seedCustomer();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    const { RouteSchedule, CallLog } = await import('../../src/modules/office/office.model.js');
    await Promise.all([RouteSchedule.deleteMany({}).exec(), CallLog.deleteMany({}).exec()]);
  });

  it('manages the weekly route schedule (CRUD + duplicate area guard)', async () => {
    const created = await api()
      .post('/api/v1/office/routes')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ weekday: 2, area: 'Wandoor', kind: 'retail', customers: [customerId] });
    expect(created.status).toBe(200);
    expect(created.body.data.weekday).toBe(2);

    const duplicate = await api()
      .post('/api/v1/office/routes')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ weekday: 2, area: 'wandoor' });
    expect(duplicate.status).toBe(409);

    const listed = await api()
      .get('/api/v1/office/routes')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.length).toBeGreaterThanOrEqual(1);

    const updated = await api()
      .patch(`/api/v1/office/routes/${created.body.data._id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.active).toBe(false);

    const hidden = await api()
      .get('/api/v1/office/routes')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(hidden.body.data.length).toBe(0);
  });

  it('serves today routes with desk notes attached', async () => {
    const todayWeekday = new Date(`${isoBusinessDay()}T00:00:00.000Z`).getUTCDay();
    const created = await api()
      .post('/api/v1/office/routes')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ weekday: todayWeekday, area: 'Vengara East', kind: 'wholesale', customers: [customerId] });
    expect(created.status).toBe(200);

    const today = await api()
      .get('/api/v1/office/routes/today')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(today.status).toBe(200);
    expect(today.body.data.date).toBe(isoBusinessDay());
    const routes = today.body.data.routes as { area: string; customers: { customerId: string; deskNotes: { preferredLanguage: string } }[] }[];
    const mine = routes.find((row) => row.area === 'Vengara East');
    expect(mine).toBeTruthy();
    expect(mine?.customers[0].deskNotes.preferredLanguage).toBe('ta');
  });

  it('records call logs and lists them per customer', async () => {
    const created = await api()
      .post('/api/v1/office/followups/call-logs')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, channel: 'whatsapp', outcome: 'Sent quote for 500 boxes', nextAction: 'Confirm quantity', nextActionDate: isoBusinessDay() });
    expect(created.status).toBe(200);
    expect(created.body.data.channel).toBe('whatsapp');
    expect(created.body.data.date).toBe(isoBusinessDay());

    const missing = await api()
      .post('/api/v1/office/followups/call-logs')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId: '665f0c0c0c0c0c0c0c0c0c0c', outcome: 'no answer' });
    expect(missing.status).toBe(404);

    const listed = await api()
      .get(`/api/v1/office/followups/call-logs?customerId=${customerId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns the order-screen context (desk notes + recent contacts)', async () => {
    await api()
      .post('/api/v1/office/followups/call-logs')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ customerId, outcome: 'seeded outcome' });

    const context = await api()
      .get(`/api/v1/office/followups/screen-context/${customerId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect(context.status).toBe(200);
    expect(context.body.data.deskNotes.boxSizeHabits).toEqual(['9x9x5', '10x10x5']);
    expect(context.body.data.callLogs.length).toBeGreaterThanOrEqual(1);
  });
});
