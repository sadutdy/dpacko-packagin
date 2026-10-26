import type { CSSProperties, ReactNode } from 'react';

import { amount, money, pct, qty, rate, signedAmount } from '../format.js';
import type { LayoutProps } from '../types.js';

export type ItemsTableVariant = 'ruled' | 'zebra' | 'dense';

interface Props extends LayoutProps {
  variant: ItemsTableVariant;
  /** Accent colour for the zebra header. */
  accent?: string;
}

const VARIANT_CLASS: Record<ItemsTableVariant, { table: string; th: string; td: string }> = {
  ruled: {
    table: 'border border-black',
    th: 'border-b border-l border-black px-1.5 py-1 align-top font-normal first:border-l-0',
    td: 'border-l border-black px-1.5 align-top first:border-l-0',
  },
  zebra: {
    table: '',
    th: 'px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-white',
    td: 'px-2 py-2 align-top',
  },
  dense: {
    table: 'border-y border-black',
    th: 'border-b border-black px-1 py-1 text-left font-semibold',
    td: 'px-1 py-0.5 align-top',
  },
};

function taxLabel(label: string, ratePct: number, mixed: boolean): string {
  return mixed ? `${label} @ ${pct(ratePct)}` : label;
}

/**
 * Goods table. `ruled` reproduces the Tally proforma grid (taxes, total and
 * advance inside the table); `zebra` lists goods only; `dense` adds tax rows
 * and the total inline for small paper.
 */
export function ItemsTable({ doc, options, variant, accent }: Props) {
  const cls = VARIANT_CLASS[variant];
  const ruled = variant === 'ruled';
  const showPer = ruled;
  const mixedRates = new Set(doc.taxes.map((tax) => tax.ratePct)).size > 1;
  const totalUnit = doc.totals.unit ? ` ${doc.totals.unit}` : '';
  const headerStyle: CSSProperties | undefined = variant === 'zebra' ? { background: accent } : undefined;

  // Empty cells keep the ruled grid's vertical lines continuous.
  const row = (cells: { desc: ReactNode; qty?: ReactNode; amount?: ReactNode; className?: string; sl?: ReactNode }, key: string) => (
    <tr key={key} className={cells.className}>
      <td className={`${cls.td} text-right`}>{cells.sl}</td>
      <td className={cls.td}>{cells.desc}</td>
      <td className={cls.td} />
      <td className={`${cls.td} text-right`}>{cells.qty}</td>
      <td className={cls.td} />
      {showPer && <td className={cls.td} />}
      <td className={`${cls.td} whitespace-nowrap text-right`}>{cells.amount}</td>
    </tr>
  );

  return (
    <table className={`w-full border-collapse ${cls.table}`}>
      <colgroup>
        <col style={{ width: ruled ? '5%' : '6%' }} />
        <col />
        <col style={{ width: '11%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '11%' }} />
        {showPer && <col style={{ width: '7%' }} />}
        <col style={{ width: '17%' }} />
      </colgroup>
      <thead style={headerStyle}>
        <tr className={ruled ? 'text-center' : ''}>
          <th className={`${cls.th} ${ruled ? 'text-left' : 'text-right'}`}>{ruled ? <>Sl<br />No.</> : '#'}</th>
          <th className={`${cls.th} ${ruled ? 'text-center' : 'text-left'}`}>{ruled ? 'Description of Goods' : 'Item'}</th>
          <th className={`${cls.th} ${ruled ? 'text-center' : 'text-left'}`}>HSN/SAC</th>
          <th className={`${cls.th} ${ruled ? 'text-center' : 'text-right'}`}>Quantity</th>
          <th className={`${cls.th} ${ruled ? 'text-center' : 'text-right'}`}>Rate</th>
          {showPer && <th className={cls.th}>per</th>}
          <th className={`${cls.th} ${ruled ? 'text-center' : 'text-right'}`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {doc.lines.map((line, index) => (
          <tr
            key={line.sl}
            className={variant === 'zebra' ? (index % 2 ? 'bg-black/[0.035]' : '') : ''}
          >
            <td className={`${cls.td} text-right ${ruled ? 'pt-2' : ''}`}>{line.sl}</td>
            <td className={`${cls.td} ${ruled ? 'pt-2' : ''}`}>
              <div className="font-bold">{line.name}</div>
              {line.description && <div className="text-[0.85em] opacity-70">{line.description}</div>}
              {line.setupChargePaise > 0 && (
                <div className="text-[0.85em] opacity-70">incl. setup {amount(line.setupChargePaise)}</div>
              )}
            </td>
            <td className={`${cls.td} ${ruled ? 'pt-2' : ''}`}>{line.hsn}</td>
            <td className={`${cls.td} whitespace-nowrap text-right ${ruled ? 'pt-2 font-bold' : ''}`}>
              {qty(line.quantity)} {ruled ? line.unit : <span className="opacity-60">{line.unit}</span>}
            </td>
            <td className={`${cls.td} text-right ${ruled ? 'pt-2' : ''}`}>{rate(line.ratePaise)}</td>
            {showPer && <td className={`${cls.td} pt-2`}>{line.unit}</td>}
            <td className={`${cls.td} text-right ${ruled ? 'pt-2 font-bold' : ''}`}>{amount(line.amountPaise)}</td>
          </tr>
        ))}

        {variant !== 'zebra' && (
          <>
            {ruled && row({ desc: null, className: 'h-6' }, 'gap-1')}
            {doc.taxes.map((tax) =>
              row(
                {
                  desc: <div className="text-right font-bold italic">{taxLabel(tax.label, tax.ratePct, mixedRates)}</div>,
                  amount: <span className="font-bold">{amount(tax.amountPaise)}</span>,
                },
                `${tax.label}-${tax.ratePct}`,
              ),
            )}
            {doc.totals.roundOffPaise !== 0 &&
              row(
                {
                  desc: <div className="text-right font-bold italic">ROUND OFF</div>,
                  amount: <span className="font-bold">{signedAmount(doc.totals.roundOffPaise)}</span>,
                },
                'roundoff',
              )}
            {ruled && row({ desc: null, className: 'h-16' }, 'gap-2')}
            <tr className={ruled ? 'border-t border-black' : 'border-t border-black'}>
              <td className={cls.td} />
              <td className={`${cls.td} py-1 text-right`}>Total</td>
              <td className={cls.td} />
              <td className={`${cls.td} whitespace-nowrap py-1 text-right font-bold`}>{qty(doc.totals.quantity)}{totalUnit}</td>
              <td className={cls.td} />
              {showPer && <td className={cls.td} />}
              <td className={`${cls.td} whitespace-nowrap py-1 text-right font-bold ${ruled ? 'text-[1.25em]' : ''}`}>{money(doc.totals.grandTotalPaise)}</td>
            </tr>
          </>
        )}

        {ruled && options.advance && (
          <>
            {row(
              {
                desc: <div className="pt-6 text-right font-bold italic">ADVANCE AMOUNT({options.advance.pct}%)</div>,
                amount: <div className="pt-6 font-bold">{amount(options.advance.exactPaise)}</div>,
                className: 'border-t border-black',
              },
              'adv',
            )}
            {options.advance.roundOffPaise !== 0 &&
              row(
                {
                  desc: <div className="text-right font-bold italic">ROUND OFF</div>,
                  amount: <span className="font-bold">{signedAmount(options.advance.roundOffPaise)}</span>,
                },
                'adv-round',
              )}
            {row({ desc: null, className: 'h-20' }, 'gap-3')}
            <tr className="border-t border-black">
              <td className={cls.td} />
              <td className={`${cls.td} py-1 text-right`}>ADVANCE</td>
              <td className={cls.td} />
              <td className={cls.td} />
              <td className={cls.td} />
              <td className={cls.td} />
              <td className={`${cls.td} whitespace-nowrap py-1 text-right text-[1.25em] font-bold`}>{money(options.advance.advancePaise)}</td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
