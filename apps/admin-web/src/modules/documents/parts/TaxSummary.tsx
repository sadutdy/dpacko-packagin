import { Fragment } from 'react';
import type { QuoteDocument } from '@ameen/domain';

import { amount, pct } from '../format.js';

/** HSN-wise tax summary. Intra-state shows CGST + SGST/UTGST, inter-state IGST. */
export function TaxSummary(props: { doc: QuoteDocument; variant?: 'ruled' | 'minimal'; className?: string }) {
  const { doc, variant = 'ruled', className = '' } = props;
  const intra = doc.supply === 'intra';
  const cell = variant === 'ruled' ? 'border border-black px-1.5' : 'border-b border-black/15 px-2 py-1';
  const head = variant === 'ruled' ? `${cell} font-normal text-center` : `${cell} text-[10px] font-semibold uppercase tracking-wider text-left opacity-70`;
  const totals = doc.hsnSummary.reduce(
    (sum, row) => ({
      taxable: sum.taxable + row.taxablePaise,
      cgst: sum.cgst + (row.cgst?.amountPaise ?? 0),
      sgst: sum.sgst + (row.sgst?.amountPaise ?? 0),
      igst: sum.igst + (row.igst?.amountPaise ?? 0),
      tax: sum.tax + row.totalTaxPaise,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 },
  );
  const taxColumns = intra ? ['CGST', 'SGST/UTGST'] : ['IGST'];

  return (
    <table className={`w-full border-collapse ${className}`}>
      <thead>
        <tr>
          <th rowSpan={2} className={head}>HSN/SAC</th>
          <th rowSpan={2} className={head}>Taxable<br />Value</th>
          {taxColumns.map((label) => (
            <th key={label} colSpan={2} className={head}>{label}</th>
          ))}
          <th rowSpan={2} className={head}>Total<br />Tax Amount</th>
        </tr>
        <tr>
          {taxColumns.map((label) => (
            <Fragment key={label}>
              <th className={head}>Rate</th>
              <th className={head}>Amount</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {doc.hsnSummary.map((row) => {
          const parts = intra ? [row.cgst, row.sgst] : [row.igst];
          return (
            <tr key={`${row.hsn}-${parts[0]?.ratePct ?? 0}`}>
              <td className={cell}>{row.hsn}</td>
              <td className={`${cell} text-right`}>{amount(row.taxablePaise)}</td>
              {parts.map((part, index) => (
                <Fragment key={`r${index}`}>
                  <td className={`${cell} text-center`}>{part ? pct(part.ratePct) : ''}</td>
                  <td className={`${cell} text-right`}>{part ? amount(part.amountPaise) : ''}</td>
                </Fragment>
              ))}
              <td className={`${cell} text-right`}>{amount(row.totalTaxPaise)}</td>
            </tr>
          );
        })}
        <tr className="font-bold">
          <td className={`${cell} text-right`}>Total</td>
          <td className={`${cell} text-right`}>{amount(totals.taxable)}</td>
          {(intra ? [totals.cgst, totals.sgst] : [totals.igst]).map((value, index) => (
            <Fragment key={`t${index}`}>
              <td className={cell} />
              <td className={`${cell} text-right`}>{amount(value)}</td>
            </Fragment>
          ))}
          <td className={`${cell} text-right`}>{amount(totals.tax)}</td>
        </tr>
      </tbody>
    </table>
  );
}
