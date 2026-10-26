import { AmountInWords } from '../parts/AmountInWords.js';
import { CopyLabel } from '../parts/CopyLabel.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { TermsBlock } from '../parts/TermsBlock.js';
import { amount, docDate, localPhone, money } from '../format.js';
import type { InvoiceLayoutProps } from '../types.js';

/** Dense A5 tax invoice / counter bill. */
export function CompactInvoiceLayout({ doc, copy }: InvoiceLayoutProps) {
  const { seller, party, invoice } = doc;
  const d = invoice.dispatch;
  const transport = [d.vehicleNo && `Vehicle ${d.vehicleNo}`, d.ewayBillNo && `e-Way ${d.ewayBillNo}`, d.dispatchedThrough].filter(Boolean);
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
        <span className="text-[12px] font-bold uppercase">{doc.quote.title}</span>
        <CopyLabel copy={copy} />
      </div>
      <div className="flex justify-between">
        <span>
          {doc.quote.number} · {docDate(doc.quote.date)}
        </span>
        {invoice.dueDate && <span>Due {docDate(invoice.dueDate)}</span>}
      </div>
      <div className="mb-2 mt-1">
        <span className="font-bold">To: {party.name}</span>
        {party.addressLines.length > 0 && <span>, {party.addressLines.join(', ')}</span>}
        {party.gstin && <span> · GSTIN {party.gstin}</span>}
        {invoice.shipTo && (
          <div>
            Ship to: {invoice.shipTo.name}, {invoice.shipTo.addressLines.join(', ')}
          </div>
        )}
        <div>
          Place of supply {invoice.placeOfSupply.name} ({invoice.placeOfSupply.code}) · Reverse charge {invoice.reverseCharge ? 'Yes' : 'No'}
          {invoice.buyerOrderNo && <> · PO {invoice.buyerOrderNo}</>}
        </div>
        {transport.length > 0 && <div>{transport.join(' · ')}</div>}
      </div>

      <ItemsTable doc={doc} options={{ title: doc.quote.title, advance: null }} variant="dense" />

      <AmountInWords label="In words" words={doc.words.amount} inline className="mt-1.5" />
      <AmountInWords label="Tax" words={`${amount(doc.totals.taxPaise)} (${doc.words.tax})`} inline />

      {invoice.amountPaidPaise > 0 && (
        <div className="mt-2 flex justify-between border-y border-black py-1">
          <span>Received {money(invoice.amountPaidPaise)}</span>
          <span className="font-bold">Balance {money(invoice.balanceDuePaise)}</span>
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
