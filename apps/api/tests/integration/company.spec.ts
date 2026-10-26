import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Company } from '../../src/modules/company/company.model.js';
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

describe('company profile (singleton org details)', () => {
  let adminToken = '';
  let financeToken = '';

  beforeAll(async () => {
    await startTestDb();
    await seedUser('+913000000001', Role.Admin);
    await seedUser('+913000000002', Role.Finance);
    adminToken = await login('+913000000001');
    financeToken = await login('+913000000002');
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('defaults to an empty profile before first save', async () => {
    const res = await api().get('/api/v1/company').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      name: '',
      address: '',
      phone: '',
      website: '',
      logo: '',
      gstin: '',
      stateName: '',
      stateCode: '',
      declaration: '',
      bankName: '',
      accountNo: '',
      ifsc: '',
      branch: '',
    });
  });

  it('requires settings:write to save', async () => {
    const res = await api()
      .put('/api/v1/company')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ name: 'Finance Co' });
    expect(res.status).toBe(403);
  });

  it('saves and re-reads all company details', async () => {
    const payload = {
      name: 'Ameen Packaging Works',
      address: '14/2 Kottayam Road, Perintalmanna, Kerala 679322',
      phone: '+919440000001',
      website: 'https://ameenpackaging.example',
      logo: 'https://cdn.ameenpackaging.example/logo.svg',
      gstin: '32AABCA1234A1Z5',
    };
    const put = await api()
      .put('/api/v1/company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject(payload);

    const get = await api().get('/api/v1/company').set('Authorization', `Bearer ${financeToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe(payload.name);
    expect(get.body.data.gstin).toBe('32AABCA1234A1Z5');
  });

  it('upperscases and validates the GSTIN', async () => {
    await Company.deleteMany({}).exec();
    const bad = await api()
      .put('/api/v1/company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ameen', gstin: 'NOT-A-GSTIN' });
    expect(bad.status).toBe(422);

    const lower = await api()
      .put('/api/v1/company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ameen', gstin: '32aabca1234a1z5' });
    expect(lower.status).toBe(200);
    expect(lower.body.data.gstin).toBe('32AABCA1234A1Z5');
  });
});
