import { describe, expect, it } from 'vitest';

import { buildInvoiceDocument, type InvoiceDocumentInput } from './index.js';

const seller = {
  name: 'D PACKO PACKAGING SOLUTIONS',
  addressLines: ['29/229, MELMURI', 'MALAPPURAM'],
  phone: '',
  gstin: '32FJIPS7458N1ZB',
  stateName: '',
  stateCode: '',
  logo: '',
  website: '',
  declaration: '',
  bank: null,
};

const party = {
  name: 'T&T HOSPITALITY LLP',
  addressLines: ['CHINAKKAL, MALAPPURAM, 676311'],
  phone: '',
  gstin: '32AAVFT2837P1ZD',
  stateName: '',
  stateCode: '',
};

function input(overrides: Partial<InvoiceDocumentInput> = {}): InvoiceDocumentInput {
  return {
    quote: { id: 'i1', number: 'INV-2627-00001', date: '2026-10-20T00:00:00.000Z', status: 'unpaid' },
    seller,
    party,
    lines: [{ name: 'SP', hsn: '4819', quantity: 600_000, unit: 'NOS', ratePaise: 235, taxRate: 5 }],
    ...overrides,
  };
}

describe('buildInvoiceDocument', () => {
  it('defaults to a Tax Invoice with no advance and the buyer as place of supply', () => {
    const doc = buildInvoiceDocument(input());
    expect(doc.quote).toMatchObject({ title: 'Tax Invoice', advancePct: 0 });
    expect(doc.invoice.placeOfSupply).toEqual({ name: 'Kerala', code: '32' });
    expect(doc.supply).toBe('intra');
    expect(doc.totals.grandTotalPaise).toBe(148_050_000);
    expect(doc.invoice.balanceDuePaise).toBe(148_050_000);
    expect(doc.invoice.dispatch.ewayBillNo).toBe('');
    expect(doc.invoice.copies).toEqual(['original']);
  });

  it('orders the requested copies original → triplicate', () => {
    expect(buildInvoiceDocument(input({ invoice: { copies: ['triplicate', 'original'] } })).invoice.copies).toEqual(['original', 'triplicate']);
  });

  it('uses the ship-to state for place of supply and IGST', () => {
    const doc = buildInvoiceDocument(
      input({
        invoice: {
          shipTo: { ...party, name: 'T&T Coimbatore depot', gstin: '', stateName: 'Tamil Nadu' },
          dispatch: { vehicleNo: 'KL-10-AB-1234', ewayBillNo: '1234 5678 9012' },
          reverseCharge: false,
          amountPaidPaise: 48_050_000,
        },
      }),
    );
    expect(doc.invoice.shipTo).toMatchObject({ stateName: 'Tamil Nadu', stateCode: '33' });
    expect(doc.invoice.placeOfSupply.code).toBe('33');
    expect(doc.supply).toBe('inter');
    expect(doc.taxes).toEqual([{ label: 'IGST', ratePct: 5, amountPaise: 7_050_000 }]);
    expect(doc.invoice.dispatch).toMatchObject({ vehicleNo: 'KL-10-AB-1234', ewayBillNo: '1234 5678 9012', destination: '' });
    expect(doc.invoice.balanceDuePaise).toBe(100_000_000);
  });

  it('keeps an explicit Bill of Supply title', () => {
    const doc = buildInvoiceDocument(input({ quote: { ...input().quote, title: 'Bill of Supply' } }));
    expect(doc.quote.title).toBe('Bill of Supply');
  });
});
