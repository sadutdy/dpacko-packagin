/**
 * GST state/UT codes (the first two digits of a GSTIN). Names follow the
 * spelling Tally prints on invoices; `abbr` is the short form stored on
 * customer addresses (e.g. `TN`, `KL`).
 */
export interface GstState {
  code: string;
  name: string;
  abbr: string;
}

export const GST_STATES: readonly GstState[] = [
  { code: '01', name: 'Jammu & Kashmir', abbr: 'JK' },
  { code: '02', name: 'Himachal Pradesh', abbr: 'HP' },
  { code: '03', name: 'Punjab', abbr: 'PB' },
  { code: '04', name: 'Chandigarh', abbr: 'CH' },
  { code: '05', name: 'Uttarakhand', abbr: 'UK' },
  { code: '06', name: 'Haryana', abbr: 'HR' },
  { code: '07', name: 'Delhi', abbr: 'DL' },
  { code: '08', name: 'Rajasthan', abbr: 'RJ' },
  { code: '09', name: 'Uttar Pradesh', abbr: 'UP' },
  { code: '10', name: 'Bihar', abbr: 'BR' },
  { code: '11', name: 'Sikkim', abbr: 'SK' },
  { code: '12', name: 'Arunachal Pradesh', abbr: 'AR' },
  { code: '13', name: 'Nagaland', abbr: 'NL' },
  { code: '14', name: 'Manipur', abbr: 'MN' },
  { code: '15', name: 'Mizoram', abbr: 'MZ' },
  { code: '16', name: 'Tripura', abbr: 'TR' },
  { code: '17', name: 'Meghalaya', abbr: 'ML' },
  { code: '18', name: 'Assam', abbr: 'AS' },
  { code: '19', name: 'West Bengal', abbr: 'WB' },
  { code: '20', name: 'Jharkhand', abbr: 'JH' },
  { code: '21', name: 'Odisha', abbr: 'OD' },
  { code: '22', name: 'Chhattisgarh', abbr: 'CG' },
  { code: '23', name: 'Madhya Pradesh', abbr: 'MP' },
  { code: '24', name: 'Gujarat', abbr: 'GJ' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu', abbr: 'DH' },
  { code: '27', name: 'Maharashtra', abbr: 'MH' },
  { code: '29', name: 'Karnataka', abbr: 'KA' },
  { code: '30', name: 'Goa', abbr: 'GA' },
  { code: '31', name: 'Lakshadweep', abbr: 'LD' },
  { code: '32', name: 'Kerala', abbr: 'KL' },
  { code: '33', name: 'Tamil Nadu', abbr: 'TN' },
  { code: '34', name: 'Puducherry', abbr: 'PY' },
  { code: '35', name: 'Andaman & Nicobar Islands', abbr: 'AN' },
  { code: '36', name: 'Telangana', abbr: 'TS' },
  { code: '37', name: 'Andhra Pradesh', abbr: 'AP' },
  { code: '38', name: 'Ladakh', abbr: 'LA' },
  { code: '97', name: 'Other Territory', abbr: 'OT' },
];

/** Looks a state up by GST code, abbreviation or name (case-insensitive). */
export function findGstState(value: string | null | undefined): GstState | undefined {
  const needle = (value ?? '').trim().toLowerCase();
  if (!needle) return undefined;
  return GST_STATES.find(
    (state) => state.code === needle || state.abbr.toLowerCase() === needle || state.name.toLowerCase() === needle,
  );
}

/** The state encoded in a GSTIN's first two digits, if valid. */
export function stateFromGstin(gstin: string | null | undefined): GstState | undefined {
  const prefix = (gstin ?? '').trim().slice(0, 2);
  return /^\d{2}$/.test(prefix) ? findGstState(prefix) : undefined;
}
