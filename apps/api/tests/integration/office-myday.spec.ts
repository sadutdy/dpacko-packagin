import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
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

describe('office admin — My Day (Module 1)', () => {
  let officeToken = '';
  let adminToken = '';
  const today = () => isoBusinessDay();
  const yesterday = () => isoBusinessDay(new Date(Date.now() - 86_400_000));

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+910000000001', Role.OfficeAdmin);
    await seedUser('+910000000002', Role.Admin);
    officeToken = await login('+910000000001');
    adminToken = await login('+910000000002');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    // Keep users; drop office collections between cases.
    const { ChecklistItem, ChecklistSubmission, OfficeTask, Appointment } = await import(
      '../../src/modules/office/office.model.js'
    );
    await Promise.all([
      ChecklistItem.deleteMany({}).exec(),
      ChecklistSubmission.deleteMany({}).exec(),
      OfficeTask.deleteMany({}).exec(),
      Appointment.deleteMany({}).exec(),
    ]);
  });

  it('saves the opening checklist for today and lets answers be re-saved', async () => {
    const created = await api()
      .post('/api/v1/office/checklist/templates')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'opening', labelEn: 'Drinking water arranged' });
    expect(created.status).toBe(201);
    const itemId = created.body.data._id as string;

    const saved = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'opening', date: today(), items: [{ itemId, done: true, note: 'OK' }] });
    expect(saved.status).toBe(200);
    expect(saved.body.data.date).toBe(today());

    const state = await api()
      .get('/api/v1/office/checklist/daily?kind=opening')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(state.status).toBe(200);
    expect(state.body.data.items[0].answer?.done).toBe(true);

    const resaved = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'opening', date: today(), items: [{ itemId, done: true }] });
    expect(resaved.status).toBe(200);
    const state2 = await api()
      .get('/api/v1/office/checklist/daily?kind=opening')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(state2.body.data.items[0].answer?.done).toBe(true);
    const { ChecklistSubmission } = await import('../../src/modules/office/office.model.js');
    expect(await ChecklistSubmission.countDocuments({ kind: 'opening', date: today() }).exec()).toBe(1);
  });

  it("refuses office_admin to backdate a checklist, allows admin", async () => {
    const created = await api()
      .post('/api/v1/office/checklist/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'closing', labelEn: 'Keys handed over' });
    const itemId = created.body.data._id as string;

    const backdated = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'closing', date: yesterday(), items: [{ itemId, done: true }] });
    expect(backdated.status).toBe(403);

    const adminBackdate = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'closing', date: yesterday(), items: [{ itemId, done: true }] });
    expect(adminBackdate.status).toBe(200);

    const future = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'closing', date: '2099-01-01', items: [{ itemId, done: true }] });
    expect(future.status).toBe(422);

    const unknown = await api()
      .post('/api/v1/office/checklist/daily')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'closing', date: today(), items: [{ itemId: '665f0c0c0c0c0c0c0c0c0c0c', done: true }] });
    expect(unknown.status).toBe(422);
  });

  it('moves a task through the status ladder and stamps doneAt', async () => {
    const created = await api()
      .post('/api/v1/office/tasks')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ title: 'Call Wandoor customers', priority: 'urgent', kind: 'task' });
    expect(created.status).toBe(201);
    const taskId = created.body.data._id as string;

    const directDone = await api()
      .patch(`/api/v1/office/tasks/${taskId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'done' });
    expect(directDone.status).toBe(409);

    await api()
      .patch(`/api/v1/office/tasks/${taskId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'in_progress' });
    const done = await api()
      .patch(`/api/v1/office/tasks/${taskId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.data.doneAt).toBeTruthy();
  });

  it('builds a shared inbox and urgent view', async () => {
    const admin = await seedUserForInbox('+910000000003');
    async function seedUserForInbox(phone: string): Promise<Types.ObjectId> {
      await seedUser(phone, Role.Dispatcher);
      const res = await api().post('/api/v1/auth/login').send({ phone, password: 'supersecret1' });
      return res.body.data.user._id as Types.ObjectId;
    }

    await api()
      .post('/api/v1/office/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Unassigned urgent claim', priority: 'urgent', kind: 'inbox' });
    await api()
      .post('/api/v1/office/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Assigned task', owner: admin, kind: 'task' });

    const inbox = await api()
      .get('/api/v1/office/tasks?view=inbox')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(inbox.body.meta.total).toBe(1);

    const urgent = await api()
      .get('/api/v1/office/tasks?view=urgent')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(urgent.body.meta.total).toBe(1);
    expect(urgent.body.data[0].title).toBe('Unassigned urgent claim');
  });

  it('checks visitors in and out exactly once', async () => {
    const created = await api()
      .post('/api/v1/office/visitors')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'visitor', personName: 'Vijay', organization: 'Vijay Traders', date: today(), checkIn: true, restrictedArea: false });
    expect(created.status).toBe(201);
    expect(created.body.data.timeIn).toBeTruthy();
    const visitorId = created.body.data._id as string;

    const out = await api()
      .patch(`/api/v1/office/visitors/${visitorId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ timeOut: new Date().toISOString() });
    expect(out.status).toBe(200);
    expect(out.body.data.timeOut).toBeTruthy();

    const again = await api()
      .patch(`/api/v1/office/visitors/${visitorId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ timeOut: new Date().toISOString() });
    expect(again.status).toBe(409);
  });

  it('composes the My Day summary', async () => {
    await api()
      .post('/api/v1/office/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Due today', dueDate: new Date().toISOString(), priority: 'normal' });
    await api()
      .post('/api/v1/office/visitors')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'visitor', personName: 'Vijay', date: today() });

    const summary = await api()
      .get('/api/v1/office/summary')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.date).toBe(today());
    expect(summary.body.data.tasks.dueToday).toBe(1);
    expect(summary.body.data.visitors.total).toBe(1);
    expect(summary.body.data.checklist.opening.items.length).toBe(0);
  });

  it('denies a customer the office module', async () => {
    await seedUser('+910000000009', Role.Customer);
    const token = await login('+910000000009');
    const res = await api().get('/api/v1/office/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('office date helper', () => {
  it('produces YYYY-MM-DD business days', () => {
    expect(isoBusinessDay(new Date('2026-10-22T04:12:00.000Z'))).toBe('2026-10-22');
    expect(isoBusinessDay(new Date('2026-10-22T17:30:00.000Z'))).toBe('2026-10-22');
  });
});
