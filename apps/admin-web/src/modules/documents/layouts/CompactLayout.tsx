import { AmountInWords } from '../parts/AmountInWords.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { TermsBlock } from '../parts/TermsBlock.js';
import { docDate, localPhone, money, signedAmount, amount } from '../format.js';
import type { LayoutProps } from '../types.js';

/** Dense A5 variant: one table, inline totals, signature line. */
export function CompactLayout({ doc, options }: LayoutProps) {
  const { seller, party } = doc;
  return (
    <div className="font-['Arial','Helvetica',sans-serif] text-[10px] leading-tight">
      <div className="text-center">
        <div className="text-[13px] font-bold uppercase">{seller.name}</div>
        <div>{seller.addressLines.join(', ')}</div>
        <div>
          {[seller.phone && `Ph ${localPhone(seller.phone)}`, seller.gstin && `GSTIN ${seller.gstin}`, seller.stateName && `${seller.stateName} (${seller.stateCode})`]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase">{options.title}</span>
        <span>
          {doc.quote.number} · {docDate(doc.quote.date)}
        </span>
      </div>
      <div className="mb-2 mt-1">
        <span className="font-bold">To: {party.name}</span>
        {party.addressLines.length > 0 && <span>, {party.addressLines.join(', ')}</span>}
        {party.gstin && <span> · GSTIN {party.gstin}</span>}
      </div>

      <ItemsTable doc={doc} options={options} variant="dense" />

      <AmountInWords label="In words" words={doc.words.amount} inline className="mt-1.5" />
      <AmountInWords label="Tax" words={`${amount(doc.totals.taxPaise)} (${doc.words.tax})`} inline />

      {options.advance && (
        <div className="mt-2 flex justify-between border-y border-black py-1">
          <span>
            Advance {options.advance.pct}% of {money(doc.totals.grandTotalPaise)}
            {options.advance.roundOffPaise !== 0 && <> (round off {signedAmount(options.advance.roundOffPaise)})</>}
          </span>
          <span className="font-bold">{money(options.advance.advancePaise)}</span>
        </div>
      )}

      <TermsBlock doc={doc} heading="Terms" className="mt-2" />

      <div className="mt-8 flex items-end justify-between">
        <span className="italic">E. &amp; O.E</span>
        <div className="w-40 border-t border-black pt-0.5 text-center">
          Authorised Signatory
          <div className="font-bold uppercase">{seller.name}</div>
        </div>
      </div>
    </div>
  );
}
