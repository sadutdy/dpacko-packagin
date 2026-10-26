import { AmountInWords } from '../parts/AmountInWords.js';
import { BankDetails } from '../parts/BankDetails.js';
import { CopyLabel } from '../parts/CopyLabel.js';
import { InvoiceMetaGrid } from '../parts/InvoiceMetaGrid.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { PartyBox } from '../parts/PartyBox.js';
import { TaxSummary } from '../parts/TaxSummary.js';
import { TermsBlock } from '../parts/TermsBlock.js';
import { localPhone, money } from '../format.js';
import type { InvoiceLayoutProps } from '../types.js';

/** Monochrome Tally-style GST tax invoice: boxed header, ruled grid, bank + signature. */
export function TallyInvoiceLayout({ doc, copy }: InvoiceLayoutProps) {
  const { seller, party, invoice } = doc;
  return (
    <div className="font-['Arial','Helvetica',sans-serif] text-[11.5px] leading-snug">
      <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-end">
        <span />
        <h1 className="text-[16px] font-bold">{doc.quote.title}</h1>
        <CopyLabel copy={copy} className="text-right" />
      </div>

      <div className="grid grid-cols-2 border border-black">
        <div className="border-r border-black">
          <div className="border-b border-black px-1.5 py-1">
            <div className="font-bold uppercase">{seller.name || 'Company name not set'}</div>
            {seller.addressLines.map((line) => <div key={line}>{line}</div>)}
            {seller.phone && <div>Contact : {localPhone(seller.phone)}</div>}
            {seller.gstin && <div>GSTIN/UIN : {seller.gstin}</div>}
            {seller.stateName && (
              <div>
                State Name : {seller.stateName}, Code : {seller.stateCode}
              </div>
            )}
          </div>
          {invoice.shipTo && <PartyBox heading="Consignee (Ship to)" party={invoice.shipTo} className="border-b border-black px-1.5 py-1" />}
          <PartyBox heading="Buyer (Bill to)" party={party} className="px-1.5 py-1" />
        </div>
        <InvoiceMetaGrid doc={doc} />
      </div>

      <div className="-mt-px">
        <ItemsTable doc={doc} options={{ title: doc.quote.title, advance: null }} variant="ruled" />
      </div>

      <AmountInWords
        label="Amount Chargeable (in words)"
        words={doc.words.amount}
        aside="E. & O.E"
        className="mt-1 px-1 [&>div:last-child]:mt-1 [&>div:last-child]:text-[12.5px]"
      />

      <TaxSummary doc={doc} className="mt-2" />

      <div className="mt-2 flex justify-between gap-4 px-1">
        <AmountInWords label="Tax Amount (in words)" words={doc.words.tax} inline />
        <span>
          Place of Supply : <span className="font-bold">{invoice.placeOfSupply.name} ({invoice.placeOfSupply.code})</span>
        </span>
      </div>
      <div className="px-1">
        Whether tax is payable on reverse charge : <span className="font-bold">{invoice.reverseCharge ? 'Yes' : 'No'}</span>
      </div>
      {invoice.amountPaidPaise > 0 && (
        <div className="px-1">
          Amount received : <span className="font-bold">{money(invoice.amountPaidPaise)}</span> · Balance due :{' '}
          <span className="font-bold">{money(invoice.balanceDuePaise)}</span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-4 px-1">
        <div>
          <TermsBlock doc={doc} />
          <div className="mt-1 underline">Declaration</div>
          <p>{seller.declaration}</p>
        </div>
        <div className="flex flex-col gap-2">
          <BankDetails seller={seller} />
          <div className="flex min-h-[5.5em] flex-col items-end justify-between border border-black p-1.5 text-right">
            <div className="font-bold">
              for <span className="uppercase">{seller.name}</span>
            </div>
            <div>Authorised Signatory</div>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center">This is a Computer Generated Invoice</div>
    </div>
  );
}
