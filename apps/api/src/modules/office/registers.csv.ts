import type { Response } from 'express';

/** Serialises rows of flat records as RFC-4180-ish CSV (no deps needed). */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    const text = String(value);
    return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))];
  return `${lines.join('\n')}\n`;
}

/** Sends rows as CSV when `format=csv`, otherwise as JSON. */
export function sendCsvOrJson(res: Response, rows: Record<string, unknown>[], format: string | undefined, payload: unknown): void {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="register.csv"');
    res.status(200).send(toCsv(rows));
    return;
  }
  res.status(200).json({ data: payload });
}
