import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { app } from '../helpers/app.js';
import { clearDatabase, startTestDb, stopTestDb } from '../helpers/testDb.js';

const api = () => request(app);

describe('auth integration', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('registers a customer, returns tokens, and serves /me', async () => {
    const otpRes = await api()
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+919876543210', purpose: 'register' });
    expect(otpRes.status).toBe(200);
    const devCode = otpRes.body.data.devCode as string;
    expect(devCode).toHaveLength(6);

    const registerRes = await api().post('/api/v1/auth/register').send({
      phone: '+919876543210',
      code: devCode,
      businessName: 'Sunrise Bakery',
      name: 'Arun',
    });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.user.role).toBe(Role.Customer);
    const accessToken = registerRes.body.data.accessToken as string;
    expect(accessToken).toBeTruthy();
    expect(registerRes.headers['set-cookie']?.[0]).toContain('ameen_refresh');

    const meRes = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.phone).toBe('+919876543210');
  });

  it('rejects an invalid OTP', async () => {
    await api().post('/api/v1/auth/otp/request').send({ phone: '+919876543211' });
    const res = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '+919876543211', code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('logs in with a password and rotates refresh tokens', async () => {
    await userRepository.create({
      phone: '+919000000001',
      name: 'Admin',
      role: Role.Admin,
      status: 'active',
      passwordHash: await hashPassword('supersecret1'),
    });

    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ phone: '+919000000001', password: 'supersecret1' });
    expect(loginRes.status).toBe(200);
    const refreshToken = loginRes.body.data.refreshToken as string;
    expect(refreshToken).toBeUndefined(); // refresh token is in the cookie

    const cookie = loginRes.headers['set-cookie'][0]!.split(';')[0]!;
    const refreshRes = await api().post('/api/v1/auth/refresh').set('Cookie', cookie).send({});
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
  });

  it('locks a customer out of staff-only routes', async () => {
    await userRepository.create({
      phone: '+919000000002',
      name: 'Customer',
      role: Role.Customer,
      status: 'active',
      passwordHash: await hashPassword('supersecret1'),
    });

    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ phone: '+919000000002', password: 'supersecret1' });
    const accessToken = loginRes.body.data.accessToken as string;

    const res = await api()
      .get('/api/v1/users/roles')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an admin list roles and permissions', async () => {
    await userRepository.create({
      phone: '+919000000003',
      name: 'Admin',
      role: Role.Admin,
      status: 'active',
      passwordHash: await hashPassword('supersecret1'),
    });

    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ phone: '+919000000003', password: 'supersecret1' });
    const accessToken = loginRes.body.data.accessToken as string;

    const res = await api()
      .get('/api/v1/users/roles')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('permissions');
  });

  it('returns 401 without a token', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('reports dependency health', async () => {
    const res = await api().get('/health');
    // Redis is not running in the test process, so the probe may report degraded.
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.dependencies).toHaveProperty('mongo');
    expect(res.body.data.dependencies).toHaveProperty('redis');
  });
});
