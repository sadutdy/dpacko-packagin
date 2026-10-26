import { formatINR, formatNumber } from '@ameen/domain';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Paise as a bare 2-decimal Indian-grouped figure: 14,10,000.00. */
export const amount = (paise: number): string => formatNumber(paise);

/** Paise with the rupee sign: ₹14,80,500.00. */
export const money = (paise: number): string => formatINR(paise);

/** Signed round-off the Tally way: (-)250.00 / 250.00. */
export function signedAmount(paise: number): string {
  return paise < 0 ? `(-)${amount(-paise)}` : amount(paise);
}

/** Integer quantity with Indian grouping: 6,00,000. */
export const qty = (value: number): string => new Intl.NumberFormat('en-IN').format(value);

/** Rate in rupees, 2 decimals without grouping noise for small values: 2.35. */
export const rate = (paise: number): string => formatNumber(paise);

/** Tax rate: 2.5 → "2.50%". */
export const pct = (value: number): string => `${value.toFixed(2)}%`;

/** Tally date: 13-Oct-26. */
export function docDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
}

/** Long date: 13 Oct 2026. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Shows E.164 phones without the +91 prefix, as printed on Indian invoices. */
export function localPhone(phone: string): string {
  return phone.replace(/^\+91/, '');
}
