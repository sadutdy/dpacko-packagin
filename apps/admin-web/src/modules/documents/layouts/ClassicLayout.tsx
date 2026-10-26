import { AmountInWords } from '../parts/AmountInWords.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { PartyBlock } from '../parts/PartyBlock.js';
import { SellerBlock } from '../parts/SellerBlock.js';
import { SignatureBlock } from '../parts/SignatureBlock.js';
import { TaxSummary } from '../parts/TaxSummary.js';
import { TermsBlock } from '../parts/TermsBlock.js';
import { docDate } from '../format.js';
import type { LayoutProps } from '../types.js';

/** Monochrome Tally-style proforma invoice — the reference format. */
export function ClassicLayout({ doc, options }: LayoutProps) {
  return (
    <div className="font-['Arial','Helvetica',sans-serif] text-[12.5px] leading-snug">
      <div className="flex justify-between">
        <div>
          <div>No. {doc.quote.number}</div>
          <div>Ref. No. {doc.quote.refNo}</div>
        </div>
        <div>
          Dated <span className="ml-3 font-bold">{docDate(doc.quote.date)}</span>
        </div>
      </div>

      <SellerBlock seller={doc.seller} className="-mt-4 text-[13px]" />

      <h1 className="my-4 text-center text-[18px] font-bold">{options.title}</h1>

      <PartyBlock party={doc.party} variant="tally" className="mb-2 ml-[26%] text-[13px]" />

      <ItemsTable doc={doc} options={options} variant="ruled" />

      <AmountInWords
        label="Amount Chargeable (in words)"
        words={doc.words.amount}
        aside="E. & O.E"
        className="mt-1 px-1 [&>div:last-child]:mt-1.5 [&>div:last-child]:text-[13px]"
      />

      <TaxSummary doc={doc} className="mt-3" />

      <AmountInWords label="Tax Amount (in words)" words={doc.words.tax} inline className="mt-3 px-1" />

      <TermsBlock doc={doc} className="mt-3 px-1" />

      <SignatureBlock sellerName={doc.seller.name} declaration={doc.seller.declaration} className="mt-4 px-1" />

      <div className="mt-6 text-center underline">This is a Computer Generated Invoice</div>
    </div>
  );
}
