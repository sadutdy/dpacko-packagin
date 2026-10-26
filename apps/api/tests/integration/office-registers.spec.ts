import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import {
  DELEGATION_DEFAULTS,
  AttendanceInput,
  CourierEntry,
  DelegationMatrix,
  DocumentAcknowledgement,
  DocumentsMaster,
  PettyCashEntry,
  StationeryIndent,
  StationeryItem,
  StationeryMove,
  MaintenanceLog,
  VendorDeliveryTracker,
  WasteLog,
  Deviation,
} from '../../src/modules/office/office.model.js';
import { Vendor } from '../../src/modules/purchasing/purchasing.model.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
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

describe('office registers 1–9 (Module 6)', () => {
  let officeToken = '';
  let adminToken = '';
  let officeId = '';
  let customerId = '';

  beforeAll(async () => {
    await startTestDb();
    officeId = String(await seedUser('+913000000010', Role.OfficeAdmin));
    await seedUser('+913000000011', Role.Admin);
    await DelegationMatrix.insertMany(
      DELEGATION_DEFAULTS.map((row) => ({ ...row, updatedBy: null })),
    );
    officeToken = await login('+913000000010');
    adminToken = await login('+913000000011');
    const [customer] = await Customer.create([
      {
        customerCode: `CUS-RG-${Math.floor(Math.random() * 1_000_000)}`,
        businessName: 'Perintalmanna Traders',
        phone: `+9144${Math.floor(Math.random() * 1_000_000_000)}`,
        segment: 'small',
        isBlacklisted: false,
      },
    ]);
    customerId = String(customer._id);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await Promise.all([
      CourierEntry.deleteMany({}).exec(),
      StationeryItem.deleteMany({}).exec(),
      StationeryMove.deleteMany({}).exec(),
      StationeryIndent.deleteMany({}).exec(),
      MaintenanceLog.deleteMany({}).exec(),
      WasteLog.deleteMany({}).exec(),
      PettyCashEntry.deleteMany({}).exec(),
      VendorDeliveryTracker.deleteMany({}).exec(),
      Vendor.deleteMany({}).exec(),
      DocumentsMaster.deleteMany({}).exec(),
      DocumentAcknowledgement.deleteMany({}).exec(),
      AttendanceInput.deleteMany({}).exec(),
      Deviation.deleteMany({}).exec(),
    ]);
    void customerId;
  });

  it('keeps a courier register with POD updates and CSV export', async () => {
    const created = await api()
      .post('/api/v1/office/registers/courier')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ docketNo: 'DT-1001', direction: 'sent', routeTo: 'Mrudula Printers', customerId });
    expect(created.status).toBe(201);
    const id = created.body.data._id as string;

    const patched = await api()
      .patch(`/api/v1/office/registers/courier/${id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ podRef: 'POD-77', receivedBy: 'Front desk' });
    expect(patched.status).toBe(200);
    expect((patched.body.data as { podRef: string }).podRef).toBe('POD-77');

    const res = await api()
      .get('/api/v1/office/registers/courier?format=csv')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('DT-1001');
  });

  it('moves stationery stock and refuses issues beyond availability', async () => {
    const item = await api()
      .post('/api/v1/office/registers/stationery')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ name: 'A4 paper ream', unit: 'pcs', qty: 100 });
    expect(item.status).toBe(201);
    const itemId = (item.body.data as { _id: string })._id;

    const tooMuch = await api()
      .post('/api/v1/office/registers/stationery/move')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ itemId, direction: 'out', qty: 150 });
    expect(tooMuch.status).toBe(409);

    const out = await api()
      .post('/api/v1/office/registers/stationery/move')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ itemId, direction: 'out', qty: 40, note: 'Poster job' });
    expect(out.status).toBe(201);

    const list = await api()
      .get('/api/v1/office/registers/stationery')
      .set('Authorization', `Bearer ${officeToken}`);
    const row = (list.body.data.rows as { _id: string; qty: number }[]).find((r) => r._id === itemId);
    expect(row?.qty).toBe(60);

    const reorder = await api()
      .post('/api/v1/office/registers/stationery/move')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ itemId, direction: 'reorder', qty: 80 });
    expect(reorder.status).toBe(201);
    const after = await api()
      .get('/api/v1/office/registers/stationery')
      .set('Authorization', `Bearer ${officeToken}`);
    const afterRow = (after.body.data.rows as { _id: string; qty: number }[]).find((r) => r._id === itemId);
    expect(afterRow?.qty).toBe(60);
  });

  it('runs indents through submit→approve→commit under the delegation cap', async () => {
    const over = await api()
      .post('/api/v1/office/registers/indents')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ title: 'New lamp shades', estimatedPaise: 2_600_000 });
    expect(over.status).toBe(409);

    const created = await api()
      .post('/api/v1/office/registers/indents')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ title: 'Binding clips', estimatedPaise: 250_00, qty: 5 });
    expect(created.status).toBe(201);
    const indent = created.body.data as { _id: string; refNo: string; status: string };
    expect(indent.status).toBe('submitted');
    expect(indent.refNo).toMatch(/^INT-/);

    const approvedByOffice = await api()
      .patch(`/api/v1/office/registers/indents/${indent._id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ action: 'approve' });
    expect(approvedByOffice.status).toBe(200);

    const committed = await api()
      .patch(`/api/v1/office/registers/indents/${indent._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'commit' });
    expect(committed.status).toBe(200);
    expect((committed.body.data as { status: string }).status).toBe('committed');

    const stuck = await api()
      .patch(`/api/v1/office/registers/indents/${indent._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(stuck.status).toBe(409);
  });

  it('enforces the petty-cash limit and flags splitting with a deviation', async () => {
    const overLimit = await api()
      .post('/api/v1/office/registers/petty-cash')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ purpose: 'Court fee stamp', amountPaise: 550_000, requester: 'Front desk' });
    expect(overLimit.status).toBe(409);

    const first = await api()
      .post('/api/v1/office/registers/petty-cash')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ purpose: 'Courier charge', amountPaise: 300_000, requester: 'Front desk' });
    expect(first.status).toBe(201);
    expect((first.body.data as { splittingSuspect: boolean }).splittingSuspect).toBe(false);

    const second = await api()
      .post('/api/v1/office/registers/petty-cash')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ purpose: 'Stationery top-up', amountPaise: 400_000, requester: 'Front desk' });
    expect(second.status).toBe(201);
    expect((second.body.data as { status: string }).status).toBe('flagged');

    const flagged = await api()
      .get('/api/v1/office/registers/petty-cash?status=flagged')
      .set('Authorization', `Bearer ${officeToken}`);
    const row = (flagged.body.data.rows as { purpose: string }[]).find((r) => r.purpose === 'Stationery top-up');
    expect(row?.purpose).toBe('Stationery top-up');

    const reconciled = await api()
      .patch(`/api/v1/office/registers/petty-cash/${(second.body.data as { _id: string })._id}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'reconciled', reconciliation: { note: 'Approved by head' } });
    expect((reconciled.body.data as { status: string }).status).toBe('reconciled');

    const deviations = await api()
      .get('/api/v1/office/registers/deviations')
      .set('Authorization', `Bearer ${officeToken}`);
    expect(
      (deviations.body.data as { category: string }[]).some((deviation) => deviation.category === 'petty_cash'),
    ).toBe(true);
  });

  it('logs maintenance and waste with defaults in place', async () => {
    const maintenance = await api()
      .post('/api/v1/office/registers/maintenance')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ location: 'Front gate', issue: 'Light not working', cadence: 'monthly' });
    expect(maintenance.status).toBe(201);
    expect((maintenance.body.data as { status: string }).status).toBe('open');

    const waste = await api()
      .post('/api/v1/office/registers/waste')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ type: 'paper', qty: 12.5 });
    expect(waste.status).toBe(201);
    expect((waste.body.data as { handler: string }).handler).toBe('Haritha Karma Sena');
  });

  it('tracks vendor deliveries and the documents master with guarded status changes', async () => {
    const [vendor] = await Vendor.create([
      { vendorCode: `VEN-RG-${Math.floor(Math.random() * 100_000)}`, name: 'Sheet Source' },
    ]);
    const tracker = await api()
      .post('/api/v1/office/registers/vendor-tracker')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ vendorId: String(vendor._id), poNumber: 'PO-51', pendingDocuments: ['GST invoice'] });
    expect(tracker.status).toBe(201);
    const trackerId = (tracker.body.data as { _id: string })._id;
    const late = await api()
      .patch(`/api/v1/office/registers/vendor-tracker/${trackerId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'late' });
    expect((late.body.data as { status: string }).status).toBe('late');

    const doc = await api()
      .post('/api/v1/office/registers/documents')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ docNo: 'ADM-FRM-9', fileName: 'visitor register', docType: 'other' });
    expect(doc.status).toBe(201);
    const docId = (doc.body.data as { _id: string })._id;

    const officeRetire = await api()
      .patch(`/api/v1/office/registers/documents/${docId}`)
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ status: 'obsolete' });
    expect(officeRetire.status).toBe(403);

    const adminRetire = await api()
      .patch(`/api/v1/office/registers/documents/${docId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'obsolete' });
    expect((adminRetire.body.data as { status: string }).status).toBe('obsolete');

    const ackOne = await api()
      .post('/api/v1/office/registers/documents/acknowledge')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ docId });
    expect(ackOne.status).toBe(201);
    const ackTwo = await api()
      .post('/api/v1/office/registers/documents/acknowledge')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ docId });
    expect((ackTwo.body.data as { _id: string })._id).toBe((ackOne.body.data as { _id: string })._id);

    const ackList = await api()
      .get(`/api/v1/office/registers/documents/acks?docId=${docId}`)
      .set('Authorization', `Bearer ${officeToken}`);
    expect((ackList.body.data as unknown[]).length).toBe(1);
  });

  it('keeps attendance inputs restricted to employee permissions', async () => {
    const saved = await api()
      .post('/api/v1/office/registers/attendance')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ userId: officeId, status: 'present', inTime: '09:05', outTime: '18:10' });
    expect(saved.status).toBe(200);
    expect((saved.body.data as { status: string }).status).toBe('present');

    const list = await api()
      .get('/api/v1/office/registers/attendance')
      .set('Authorization', `Bearer ${officeToken}`);
    expect((list.body.data as unknown[]).length).toBe(1);

    const missing = await api()
      .post('/api/v1/office/registers/attendance')
      .set('Authorization', `Bearer ${officeToken}`)
      .send({ userId: '6f1f1f1f1f1f1f1f1f1f1f1f', status: 'leave' });
    expect(missing.status).toBe(404);
  });
});
