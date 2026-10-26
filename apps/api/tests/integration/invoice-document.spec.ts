import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Company } from '../../src/modules/company/company.model.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
import { Invoice } from '../../src/modules/payments/payments.model.js';
import { app } from '../helpers/app.js';
import { startTestDb, stopTestDb } from '../helpers/testDb.js';

const api = () => request(app);

describe('invoice editor endpoints', () => {
  let token = '';
  let customerId = '';
  let invoiceId = '';

  const payload = () => ({
    customerId,
    issueDate: '2026-10-20',
    dueDate: '2026-11-04',
    title: 'Tax Invoice',
    layout: 'tally',
    copies: ['original', 'duplicate'],
    buyerOrderNo: 'PO-TT-118',
    buyerOrderDate: '2026-10-14',
    dispatch: { vehicleNo: 'KL-10-AB-1234', ewayBillNo: '321098765432', dispatchedThrough: 'Own vehicle' },
    shipTo: { enabled: true, name: 'T&T Coimbatore depot', addressLines: ['Avinashi Road', 'Coimbatore'], stateName: 'Tamil Nadu' },
    terms: ['Interest @18% p.a. on overdue bills.'],
    items: [{ name: 'SP', hsn: '4819', quantity: 600_000, unit: 'NOS', ratePaise: 235, taxRate: 5 }],
  });

  beforeAll(async () => {
    await startTestDb();
    await userRepository.create({
      phone: '+913200000001',
      name: 'Admin',
      role: Role.Admin,
      status: 'active',
      passwordHash: await hashPassword('supersecret1'),
    });
    const login = await api().post('/api/v1/auth/login').send({ phone: '+913200000001', password: 'supersecret1' });
    token = login.body.data.accessToken as string;
    await Company.create({ _id: 'org', name: 'D PACKO PACKAGING SOLUTIONS', address: 'MALAPPURAM', gstin: '32FJIPS7458N1ZB' });
    const [customer] = await Customer.create([
      {
        customerCode: 'CUS-TT-INV',
        businessName: 'T&T HOSPITALITY LLP',
        phone: '+919000000002',
        gstin: '32AAVFT2837P1ZD',
        addresses: [{ line1: 'CHINAKKAL', district: 'MALAPPURAM', state: 'KL', pincode: '676311', isDefault: true }],
      },
    ]);
    customerId = String(customer!._id);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('exposes the seller block', async () => {
    const res = await api().get('/api/v1/payments/invoices/seller').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.gstin).toBe('32FJIPS7458N1ZB');
  });

  it('creates an invoice without an order and prices IGST for an out-of-state consignee', async () => {
    const res = await api().post('/api/v1/payments/invoices').set('Authorization', `Bearer ${token}`).send(payload());
    expect(res.status).toBe(201);
    invoiceId = String(res.body.data._id);
    expect(res.body.data).toMatchObject({
      orderId: null,
      placeOfSupply: '33',
      igstPaise: 7_050_000,
      cgstPaise: 0,
      grandTotalPaise: 148_050_000,
      status: 'unpaid',
    });
    expect(res.body.data.invoiceNumber).toMatch(/^INV-/);
    expect(res.body.data.items[0]).toMatchObject({ description: 'SP', qty: 600_000, igstPaise: 7_050_000 });
  });

  it('reads back the editor shape and the printable document', async () => {
    const edit = await api().get(`/api/v1/payments/invoices/${invoiceId}/editable`).set('Authorization', `Bearer ${token}`);
    expect(edit.status).toBe(200);
    expect(edit.body.data).toMatchObject({ editable: true, copies: ['original', 'duplicate'], buyerOrderNo: 'PO-TT-118' });
    expect(edit.body.data.shipTo).toMatchObject({ enabled: true, stateName: 'Tamil Nadu' });

    const doc = await api().get(`/api/v1/payments/invoices/${invoiceId}/document`).set('Authorization', `Bearer ${token}`);
    expect(doc.status).toBe(200);
    expect(doc.body.data.quote.title).toBe('Tax Invoice');
    expect(doc.body.data.supply).toBe('inter');
    expect(doc.body.data.invoice).toMatchObject({
      placeOfSupply: { name: 'Tamil Nadu', code: '33' },
      dispatch: { vehicleNo: 'KL-10-AB-1234', ewayBillNo: '321098765432' },
      balanceDuePaise: 148_050_000,
    });
    expect(doc.body.data.invoice.shipTo.name).toBe('T&T Coimbatore depot');
  });

  it('replaces the invoice on PUT and keeps its number', async () => {
    const before = await Invoice.findById(invoiceId).lean().exec();
    const res = await api()
      .put(`/api/v1/payments/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload(), shipTo: { enabled: false } });
    expect(res.status).toBe(200);
    expect(res.body.data.invoiceNumber).toBe(before?.invoiceNumber);
    expect(res.body.data).toMatchObject({ placeOfSupply: '32', cgstPaise: 3_525_000, igstPaise: 0 });
  });

  it('locks invoices once payments are recorded and validates payloads', async () => {
    const bad = await api().post('/api/v1/payments/invoices').set('Authorization', `Bearer ${token}`).send({ ...payload(), items: [] });
    expect(bad.status).toBe(422);

    await Invoice.updateOne({ _id: invoiceId }, { $push: { paymentIds: new Types.ObjectId() } }).exec();
    const locked = await api().put(`/api/v1/payments/invoices/${invoiceId}`).set('Authorization', `Bearer ${token}`).send(payload());
    expect(locked.status).toBe(409);
    const edit = await api().get(`/api/v1/payments/invoices/${invoiceId}/editable`).set('Authorization', `Bearer ${token}`);
    expect(edit.body.data.editable).toBe(false);
  });
});
