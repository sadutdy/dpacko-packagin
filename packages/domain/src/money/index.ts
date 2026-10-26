/**
 * Money is stored and computed as integer paise. Never floats.
 * 1 rupee = 100 paise. All helpers here are pure and side-effect free.
 */

/** Rounds a float amount of rupees to the nearest integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Converts integer paise to a rupee float. For display only — never store this. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function add(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies an amount by a quantity. The result is rounded half-up to the nearest
 * paise so that repeated multiplications never accumulate float drift.
 */
export function multiply(amount: number, quantity: number): number {
  return Math.round(amount * quantity);
}

/**
 * Returns `percentPct` percent of `amount`, rounded half-up.
 * `percentOf(1000, 18)` === 180
 */
export function percentOf(amount: number, percentPct: number): number {
  return Math.round((amount * percentPct) / 100);
}

/**
 * Splits `total` across `weights` using the largest-remainder method.
 * The returned parts always sum exactly to `total` — no lost or invented paise.
 * This is what guarantees line totals sum to the invoice grand total.
 */
export function allocatePaise(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    throw new Error('allocatePaise requires at least one positive weight');
  }

  const exact = weights.map((weight) => (total * weight) / weightSum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);

  // Hand the leftover paise to the largest fractional parts, largest first.
  // Ties break on index so the result is deterministic for equal weights.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const parts = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    remainder -= 1;
  }

  return parts;
}

/**
 * Splits `total` into equal parts, distributing the remainder paise across the
 * earliest parts so the sum is exact.
 */
export function splitEqually(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('splitEqually requires a positive integer count');
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

const INR_GROUPED = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer paise as an Indian-grouped currency string, e.g. "₹1,23,456.78". */
export function formatINR(paise: number): string {
  return INR_GROUPED.format(paiseToRupees(paise));
}

/** Formats integer paise as a bare Indian-grouped number, e.g. "1,23,456.78". */
export function formatNumber(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(value: number): string {
  if (value < 20) return ONES[value] ?? '';
  const tens = TENS[Math.floor(value / 10)] ?? '';
  const ones = ONES[value % 10] ?? '';
  return ones ? `${tens} ${ones}` : tens;
}

/**
 * Converts an amount below 1000 into words. Used by the GST invoice renderer,
 * which only needs the "only" suffix when there are no fractional paise.
 */
function underThousandWords(value: number): string {
  if (value === 0) return '';
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) parts.push(twoDigitWords(rest));
  return parts.join(' ');
}

/**
 * Renders an integer paise amount in Indian words, e.g.
 * `amountInWords(12345678)` === "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only".
 * Uses the lakh/crore grouping, not the western million/billion.
 */
export function amountInWords(paise: number): string {
  const negative = paise < 0;
  const absolute = Math.abs(Math.trunc(paise));

  const rupees = Math.floor(absolute / 100);
  const paisePart = absolute % 100;

  const parts: string[] = [];

  if (rupees === 0 && paisePart === 0) {
    parts.push('Rupees Zero');
  } else {
    // Indian grouping: crore, lakh, thousand, hundred.
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const hundred = rupees % 1000;

    if (crore > 0) parts.push(`${underThousandWords(crore)} Crore`);
    if (lakh > 0) parts.push(`${underThousandWords(lakh)} Lakh`);
    if (thousand > 0) parts.push(`${underThousandWords(thousand)} Thousand`);
    const remainder = underThousandWords(hundred);
    if (remainder) parts.push(remainder);

    if (rupees > 0) parts.unshift('Rupees');
  }

  if (paisePart > 0) {
    // The Indian invoice convention joins the paise clause with "and".
    const paiseWords = `${underThousandWords(paisePart)} Paise`;
    parts.push(parts.length > 0 ? `and ${paiseWords}` : paiseWords);
  }

  const words = `${parts.join(' ')} Only`;
  return negative ? `Minus ${words}` : words;
}

/**
 * Tally-style amount in words, e.g. `inrWords(148050000)` ===
 * "INR Fourteen Lakh Eighty Thousand Five Hundred Only".
 */
export function inrWords(paise: number): string {
  const words = amountInWords(paise);
  const negative = words.startsWith('Minus ');
  const body = negative ? words.slice('Minus '.length) : words;
  const withCurrency = body.startsWith('Rupees ') ? `INR ${body.slice('Rupees '.length)}` : `INR ${body}`;
  return negative ? `Minus ${withCurrency}` : withCurrency;
}

/**
 * Applies a discount to a base amount, clamped so the result never goes negative.
 * `discountPct` is a percentage (18 means 18%).
 */
export function applyDiscount(basePaise: number, discountPct: number): number {
  if (discountPct <= 0) return basePaise;
  if (discountPct >= 100) return 0;
  return basePaise - percentOf(basePaise, discountPct);
}
