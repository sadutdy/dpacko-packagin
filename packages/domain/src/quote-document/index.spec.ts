import { describe, expect, it } from 'vitest';

import { inrWords } from '../money/index.js';
import {
  advance,
  applyPartyOverride,
  buildQuoteDocument,
  partyFromCustomer,
  pricingFromDocument,
  supplyType,
  type QuoteDocumentInput,
} from './index.js';

const seller = {
  name: 'D PACKO PACKAGING SOLUTIONS',
  addressLines: ['29/229, MELMURI', 'MALAPPURAM'],
  phone: '9846994836',
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
  addressLines: ['9/154/S, U.T.R. CH ROAD, MOONNIYUR', 'CHINAKKAL, MALAPPURAM, 676311'],
  phone: '',
  gstin: '32AAVFT2837P1ZD',
  stateName: '',
  stateCode: '',
};

function referenceInput(overrides: Partial<QuoteDocumentInput> = {}): QuoteDocumentInput {
  return {
    quote: { id: 'q1', number: 'QT-2627-00001', date: '2026-10-13T00:00:00.000Z', status: 'sent' },
    seller,
    party,
    lines: [{ name: 'SP', hsn: '4819', quantity: 600_000, unit: 'NOS', ratePaise: 235, taxRate: 5 }],
    ...overrides,
  };
}

describe('buildQuoteDocument — reference proforma invoice', () => {
  const doc = buildQuoteDocument(referenceInput());

  it('derives Kerala (32) for both sides from the GSTINs → intra-state', () => {
    expect(doc.seller.stateName).toBe('Kerala');
    expect(doc.seller.stateCode).toBe('32');
    expect(doc.party.stateCode).toBe('32');
    expect(doc.supply).toBe('intra');
  });

  it('prices 6,00,000 × ₹2.35 at 5% GST', () => {
    expect(doc.lines[0]?.amountPaise).toBe(141_000_000);
    expect(doc.taxes).toEqual([
      { label: 'CGST', ratePct: 2.5, amountPaise: 3_525_000 },
      { label: 'SGST', ratePct: 2.5, amountPaise: 3_525_000 },
    ]);
    expect(doc.totals).toEqual({
      quantity: 600_000,
      unit: 'NOS',
      taxablePaise: 141_000_000,
      taxPaise: 7_050_000,
      roundOffPaise: 0,
      grandTotalPaise: 148_050_000,
    });
  });

  it('summarises tax by HSN', () => {
    expect(doc.hsnSummary).toEqual([
      {
        hsn: '4819',
        taxablePaise: 141_000_000,
        cgst: { ratePct: 2.5, amountPaise: 3_525_000 },
        sgst: { ratePct: 2.5, amountPaise: 3_525_000 },
        igst: null,
        totalTaxPaise: 7_050_000,
      },
    ]);
  });

  it('spells amounts the Tally way', () => {
    expect(doc.words.amount).toBe('INR Fourteen Lakh Eighty Thousand Five Hundred Only');
    expect(doc.words.tax).toBe('INR Seventy Thousand Five Hundred Only');
  });
});

describe('buildQuoteDocument — inter-state and mixed lines', () => {
  it('uses IGST when the party is in another state', () => {
    const doc = buildQuoteDocument(referenceInput({ party: { ...party, gstin: '33AAVFT2837P1ZD' } }));
    expect(doc.supply).toBe('inter');
    expect(doc.taxes).toEqual([{ label: 'IGST', ratePct: 5, amountPaise: 7_050_000 }]);
    expect(doc.hsnSummary[0]?.cgst).toBeNull();
    expect(doc.hsnSummary[0]?.igst).toEqual({ ratePct: 5, amountPaise: 7_050_000 });
  });

  it('falls back to the address state when the party has no GSTIN', () => {
    const doc = buildQuoteDocument(referenceInput({ party: { ...party, gstin: '', stateName: 'TN' } }));
    expect(doc.party.stateName).toBe('Tamil Nadu');
    expect(doc.supply).toBe('inter');
  });

  it('folds setup charges into taxable value, groups by HSN + rate and rounds to the rupee', () => {
    const doc = buildQuoteDocument(
      referenceInput({
        lines: [
          { name: 'Box A', hsn: '4819', quantity: 3, unit: 'NOS', ratePaise: 1_033, setupChargePaise: 2_500, taxRate: 18 },
          { name: 'Box B', hsn: '4819', quantity: 1, unit: 'PCS', ratePaise: 1_000, taxRate: 18 },
          { name: 'Liner', hsn: '4823', quantity: 2, unit: 'NOS', ratePaise: 500, taxRate: 12 },
        ],
      }),
    );
    expect(doc.lines.map((line) => line.amountPaise)).toEqual([5_599, 1_000, 1_000]);
    expect(doc.hsnSummary.map((row) => [row.hsn, row.taxablePaise])).toEqual([['4819', 6_599], ['4823', 1_000]]);
    expect(doc.totals.unit).toBeNull();
    // 7,599 taxable + (504+504+90+90+60+60) tax = 8,907 → rounded to 8,900.
    expect(doc.totals.taxPaise).toBe(1_308);
    expect(doc.totals.roundOffPaise).toBe(-7);
    expect(doc.totals.grandTotalPaise).toBe(8_900);
  });

  it('treats an unknown state as intra-state', () => {
    expect(supplyType('32', '')).toBe('intra');
    expect(supplyType('32', '33')).toBe('inter');
  });
});

describe('advance', () => {
  it('rounds the 50% advance to the nearest ₹1,000', () => {
    expect(advance(148_050_000, 50)).toEqual({
      pct: 50,
      exactPaise: 74_025_000,
      roundOffPaise: -25_000,
      advancePaise: 74_000_000,
    });
  });

  it('clamps the percentage and supports exact amounts', () => {
    expect(advance(10_000, 150).advancePaise).toBe(0);
    expect(advance(1_000_000, 150).pct).toBe(100);
    expect(advance(12_345, 50, 1).advancePaise).toBe(6_173);
  });
});

describe('inrWords', () => {
  it('replaces the Rupees prefix with INR', () => {
    expect(inrWords(148_050_000)).toBe('INR Fourteen Lakh Eighty Thousand Five Hundred Only');
    expect(inrWords(50)).toBe('INR Fifty Paise Only');
    expect(inrWords(0)).toBe('INR Zero Only');
    expect(inrWords(-100)).toBe('Minus INR One Only');
  });
});

describe('editor helpers', () => {
  const customer = {
    businessName: 'T&T HOSPITALITY LLP',
    phone: '+919000000001',
    gstin: '32AAVFT2837P1ZD',
    addresses: [
      { line1: 'Old shop', state: 'TN' },
      { line1: '9/154/S', line2: 'U.T.R. CH ROAD', area: 'MOONNIYUR', city: 'CHINAKKAL', pincode: '676311', state: 'KL', isDefault: true },
    ],
  };

  it('builds the party from the default address', () => {
    expect(partyFromCustomer(customer)).toEqual({
      name: 'T&T HOSPITALITY LLP',
      addressLines: ['9/154/S, U.T.R. CH ROAD', 'MOONNIYUR, CHINAKKAL', '676311'],
      phone: '+919000000001',
      gstin: '32AAVFT2837P1ZD',
      stateName: 'KL',
      stateCode: '',
    });
  });

  it('applies non-empty overrides and keeps the rest', () => {
    const party = { ...partyFromCustomer(customer), stateCode: '32' };
    const next = applyPartyOverride(party, { name: 'T&T Hotels', addressLines: ['  ', ''], gstin: '33aavft2837p1zd' });
    expect(next.name).toBe('T&T Hotels');
    expect(next.addressLines).toEqual(party.addressLines);
    expect(next.gstin).toBe('33AAVFT2837P1ZD');
    expect(next.stateCode).toBe('');
    expect(applyPartyOverride(party, null)).toBe(party);
  });

  it('lets an explicit state override beat the GSTIN prefix', () => {
    const doc = buildQuoteDocument(
      referenceInput({ party: applyPartyOverride({ ...party, stateCode: '32' }, { stateName: 'Tamil Nadu' }) }),
    );
    expect(doc.party).toMatchObject({ stateName: 'Tamil Nadu', stateCode: '33' });
    expect(doc.supply).toBe('inter');
  });

  it('defaults presentation settings and summarises pricing', () => {
    const doc = buildQuoteDocument(referenceInput());
    expect(doc.quote).toMatchObject({ title: 'Proforma Invoice', layout: 'classic', advancePct: 50, terms: [], notes: '' });
    expect(buildQuoteDocument(referenceInput({ quote: { ...referenceInput().quote, title: 'Quotation', advancePct: 0 } })).quote)
      .toMatchObject({ title: 'Quotation', advancePct: 0 });
    expect(pricingFromDocument(doc)).toEqual({
      subtotalPaise: 141_000_000,
      discountPaise: 0,
      setupChargePaise: 0,
      taxPaise: 7_050_000,
      cgstPaise: 3_525_000,
      sgstPaise: 3_525_000,
      igstPaise: 0,
      roundOffPaise: 0,
      grandTotalPaise: 148_050_000,
      currency: 'INR',
    });
  });
});
