import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { ReminderRule } from '../../src/modules/office/office.model.js';
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
  return user._id as Types.ObjectId;
}

describe('controls: reminders, matrix & deviations (Module 7)', () => {
  let officeToken = '';
  let adminToken = '';

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+913100000010', Role.OfficeAdmin);
    await seedUser('+913100000011', Role.Admin);
    officeToken = await login('+913100000010');
    adminToken = await login('+913100000011');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await ReminderRule.deleteMany({}).exec();
  });

  it('manages reminder rules with unique keys', async () => {
    const created = await api()
      .post('/api/v1/office/reminders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'opening-checklist', kind: 'checklist_opening', cron: '0 7 * * *', title: 'Open the checklist' });
    expect(created.status).toBe(201);
    expect((created.body.data as { active: boolean }).active).toBe(true);

    const duplicate = await api()
      .post('/api/v1/office/reminders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'opening-checklist', kind: 'checklist_opening', cron: '0 7 * * *' });
    expect(duplicate.status).toBe(409);

    const disabled = await api()
      .patch('/api/v1/office/reminders/opening-checklist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(disabled.status).toBe(200);
    expect((disabled.body.data as { active: boolean }).active).toBe(false);

    const rules = await api().get('/api/v1/office/reminders').set('Authorization', `Bearer ${officeToken}`);
    expect(rules.status).toBe(200);
    expect((rules.body.data as { key: string }[]).some((rule) => rule.key === 'opening-checklist')).toBe(true);
  });

  it('reflects delegation-matrix edits in indent approvals', async () => {
    const before = await api().get('/api/v1/office/matrix').set('Authorization', `Bearer ${adminToken}`);
    expect(before.status).toBe(200);
    const defaults = before.body.data as { role: string; action: string; limitPaise: number | null }[];
    expect(defaults.some((entry) => entry.role === 'office_admin' && entry.action === 'indent_request')).toBe(true);

    const raised = await api()
      .put('/api/v1/office/matrix')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'office_admin', action: 'indent_request', limitPaise: 600_00, active: true });
    expect(raised.status).toBe(200);
    expect((raised.body.data as { limitPaise: number }).limitPaise).toBe(600_00);

    const indent = await api()
      .post('/api/v1/office/registers/indents')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ title: 'Laminator roll', estimatedPaise: 550_00 });
    expect(indent.status).toBe(201);
  });

  it('serves channels and the top-level deviation endpoints', async () => {
    const channels = await api()
      .get('/api/v1/office/channels')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(channels.status).toBe(200);
    expect((channels.body.data as { group: string; channel: string }[]).length).toBeGreaterThan(0);

    const opened = await api()
      .post('/api/v1/office/deviations')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ kind: 'incident', severity: 'high', immediateEscalation: true, detail: 'Compound gate light out after dark' });
    expect(opened.status).toBe(201);
    const deviationId = (opened.body.data as { _id: string })._id;

    const closed = await api()
      .patch(`/api/v1/office/deviations/${deviationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ correctiveAction: 'Electrician scheduled', closed: true });
    expect(closed.status).toBe(200);

    const openOnly = await api()
      .get('/api/v1/office/deviations?openOnly=true')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(
      (openOnly.body.data as { _id: string }[]).some((row) => row._id === deviationId),
    ).toBe(false);
  });
});
