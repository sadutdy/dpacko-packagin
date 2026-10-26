import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';

import { Role } from '@ameen/domain';

import { userRepository } from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/modules/auth/strategies/password.js';
import { Company } from '../../src/modules/company/company.model.js';
import { Customer } from '../../src/modules/crm/crm.model.js';
import { Quote } from '../../src/modules/orders/orders.model.js';
import { app } from '../helpers/app.js';
import { startTestDb, stopTestDb } from '../helpers/testDb.js';

const api = () => request(app);

async function login(phone: string): Promise<string> {
  const res = await api().post('/api/v1/auth/login').send({ phone, password: 'supersecret1' });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

describe('GET /orders/quotes/:id/document', () => {
  let token = '';
  let quoteId = '';
  let customerId = '';

  beforeAll(async () => {
    await startTestDb();
    await userRepository.create({
      phone: '+913100000001',
      name: 'Admin',
      role: Role.Admin,
      status: 'active',
      passwordHash: await hashPassword('supersecret1'),
    });
    token = await login('+913100000001');

    await Company.create({
      _id: 'org',
      name: 'D PACKO PACKAGING SOLUTIONS',
      address: '29/229, MELMURI\nMALAPPURAM',
      phone: '+919846994836',
      gstin: '32FJIPS7458N1ZB',
    });
    const [customer] = await Customer.create([
      {
        customerCode: 'CUS-TT',
        businessName: 'T&T HOSPITALITY LLP',
        phone: '+919000000001',
        gstin: '32AAVFT2837P1ZD',
        addresses: [{ line1: '9/154/S, U.T.R. CH ROAD', area: 'MOONNIYUR', city: 'CHINAKKAL', district: 'MALAPPURAM', state: 'KL', pincode: '676311', isDefault: true }],
      },
    ]);
    const [quote] = await Quote.create([
      {
        quoteNumber: 'QT-TEST-00001',
        customerId: customer!._id,
        status: 'sent',
        items: [
          {
            skuId: new Types.ObjectId(),
            skuCode: 'SP',
            name: 'SP',
            quantity: 600_000,
            unitPricePaise: 235,
            taxRate: 5,
            hsnCode: '4819',
          },
        ],
      },
    ]);
    quoteId = String(quote!._id);
    customerId = String(customer!._id);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('returns the denormalised proforma document', async () => {
    const res = await api().get(`/api/v1/orders/quotes/${quoteId}/document`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const doc = res.body.data;
    expect(doc.quote.number).toBe('QT-TEST-00001');
    expect(doc.seller).toMatchObject({ name: 'D PACKO PACKAGING SOLUTIONS', stateName: 'Kerala', stateCode: '32' });
    expect(doc.seller.addressLines).toEqual(['29/229, MELMURI', 'MALAPPURAM']);
    expect(doc.seller.declaration).toMatch(/actual price of the goods/);
    expect(doc.party).toMatchObject({ name: 'T&T HOSPITALITY LLP', stateCode: '32' });
    expect(doc.supply).toBe('intra');
    expect(doc.lines[0]).toMatchObject({ hsn: '4819', quantity: 600_000, unit: 'NOS', amountPaise: 141_000_000 });
    expect(doc.totals.grandTotalPaise).toBe(148_050_000);
    expect(doc.words.amount).toBe('INR Fourteen Lakh Eighty Thousand Five Hundred Only');
  });

  it('404s for an unknown quote', async () => {
    const res = await api()
      .get(`/api/v1/orders/quotes/${new Types.ObjectId().toString()}/document`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed id', async () => {
    const res = await api().get('/api/v1/orders/quotes/not-an-id/document').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

  describe('quote editor endpoints', () => {
    const payload = () => ({
      customerId,
      refNo: 'PO-77',
      issueDate: '2026-10-13',
      validUntil: '2026-10-27',
      status: 'draft',
      title: 'Quotation',
      layout: 'modern',
      advancePct: 30,
      partyOverride: { name: 'T&T Hotels (Chinakkal)', addressLines: ['Site office', 'Chinakkal'] },
      terms: ['Delivery within 10 days.'],
      notes: 'Print artwork approved.',
      items: [
        { name: 'Printed bag', description: '12x10 inch, 1 colour', hsn: '4819', quantity: 1000, unit: 'PCS', ratePaise: 1250, setupChargePaise: 50000, taxRate: 18 },
      ],
    });
    let createdId = '';

    it('exposes the seller block for previews', async () => {
      const res = await api().get('/api/v1/orders/quotes/seller').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ name: 'D PACKO PACKAGING SOLUTIONS', gstin: '32FJIPS7458N1ZB' });
    });

    it('creates a quote with free-text lines and priced totals', async () => {
      const res = await api().post('/api/v1/orders/quotes').set('Authorization', `Bearer ${token}`).send(payload());
      expect(res.status).toBe(201);
      createdId = String(res.body.data._id);
      expect(res.body.data.quoteNumber).toMatch(/^QT-/);
      // 1000 × 12.50 + 500 setup = 13,000 taxable; 18% = 2,340 → 15,340.
      expect(res.body.data.pricing).toMatchObject({ subtotalPaise: 1_300_000, taxPaise: 234_000, grandTotalPaise: 1_534_000 });
      expect(res.body.data.items[0]).toMatchObject({ skuId: null, unit: 'PCS', hsnCode: '4819' });
    });

    it('reads it back in the editor shape and prints the overrides', async () => {
      const edit = await api().get(`/api/v1/orders/quotes/${createdId}`).set('Authorization', `Bearer ${token}`);
      expect(edit.status).toBe(200);
      expect(edit.body.data).toMatchObject({ refNo: 'PO-77', title: 'Quotation', layout: 'modern', advancePct: 30 });
      expect(edit.body.data.items[0]).toMatchObject({ name: 'Printed bag', ratePaise: 1250, setupChargePaise: 50000 });

      const doc = await api().get(`/api/v1/orders/quotes/${createdId}/document`).set('Authorization', `Bearer ${token}`);
      expect(doc.body.data.quote).toMatchObject({ refNo: 'PO-77', title: 'Quotation', terms: ['Delivery within 10 days.'] });
      expect(doc.body.data.quote.date.slice(0, 10)).toBe('2026-10-13');
      expect(doc.body.data.party).toMatchObject({ name: 'T&T Hotels (Chinakkal)', addressLines: ['Site office', 'Chinakkal'], stateCode: '32' });
    });

    it('replaces the quote on PUT and keeps its number', async () => {
      const before = await Quote.findById(createdId).lean().exec();
      const res = await api()
        .put(`/api/v1/orders/quotes/${createdId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...payload(), status: 'sent', items: [{ name: 'SP', hsn: '4819', quantity: 10, ratePaise: 100, taxRate: 5 }] });
      expect(res.status).toBe(200);
      expect(res.body.data.quoteNumber).toBe(before?.quoteNumber);
      expect(res.body.data.status).toBe('sent');
      expect(res.body.data.pricing.grandTotalPaise).toBe(1_100);
    });

    it('validates the payload and protects converted quotes', async () => {
      const empty = await api().post('/api/v1/orders/quotes').set('Authorization', `Bearer ${token}`).send({ ...payload(), items: [] });
      expect(empty.status).toBe(422);

      await Quote.updateOne({ _id: createdId }, { status: 'converted' }).exec();
      const locked = await api().put(`/api/v1/orders/quotes/${createdId}`).set('Authorization', `Bearer ${token}`).send(payload());
      expect(locked.status).toBe(409);
    });
  });
});
