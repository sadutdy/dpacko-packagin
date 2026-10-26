import { AmountInWords } from '../parts/AmountInWords.js';
import { BankDetails } from '../parts/BankDetails.js';
import { CopyLabel } from '../parts/CopyLabel.js';
import { invoiceMetaCells } from '../parts/InvoiceMetaGrid.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { PartyBlock } from '../parts/PartyBlock.js';
import { SellerBlock } from '../parts/SellerBlock.js';
import { SignatureBlock } from '../parts/SignatureBlock.js';
import { TaxSummary } from '../parts/TaxSummary.js';
import { amount, longDate, money, pct, signedAmount } from '../format.js';
import type { InvoiceLayoutProps } from '../types.js';

const ACCENT = 'var(--app-accent)';
const CARD = 'rounded-lg border border-black/10 px-3 py-2';
const CARD_LABEL = 'mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60';

/** Branded tax invoice: accent title, cards, dispatch panel, totals with balance. */
export function ModernInvoiceLayout({ doc, copy }: InvoiceLayoutProps) {
  const { invoice } = doc;
  // Only filled dispatch facts make it to the card (beyond number/date/due).
  const dispatch = invoiceMetaCells(doc)
    .slice(2)
    .filter((cell) => cell.label !== 'Due Date' && cell.value)
    .map((cell) => ({ ...cell, label: cell.label === 'Dated' ? 'Order date' : cell.label }));

  return (
    <div className="font-sans text-[12px] leading-relaxed text-[#1d1d1f]">
      <header className="flex items-start justify-between gap-6">
        <SellerBlock seller={doc.seller} align="left" showLogo className="text-[11.5px] [&>div:first-of-type]:text-[15px]" />
        <div className="min-w-[40%] text-right">
          <div className="text-[22px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
            {doc.quote.title}
          </div>
          <CopyLabel copy={copy} className="block opacity-70" />
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[11.5px]">
            <dt className="opacity-60">Invoice No.</dt>
            <dd className="text-right font-medium">{doc.quote.number}</dd>
            <dt className="opacity-60">Date</dt>
            <dd className="text-right font-medium">{longDate(doc.quote.date)}</dd>
            {invoice.dueDate && (
              <>
                <dt className="opacity-60">Due</dt>
                <dd className="text-right font-medium">{longDate(invoice.dueDate)}</dd>
              </>
            )}
            <dt className="opacity-60">Place of supply</dt>
            <dd className="text-right font-medium">
              {invoice.placeOfSupply.name} ({invoice.placeOfSupply.code})
            </dd>
            <dt className="opacity-60">Reverse charge</dt>
            <dd className="text-right font-medium">{invoice.reverseCharge ? 'Yes' : 'No'}</dd>
          </dl>
        </div>
      </header>

      <div className="my-3 h-1 rounded-full" style={{ background: ACCENT }} />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <PartyBlock party={doc.party} label="Bill to" className={CARD} />
        {invoice.shipTo ? (
          <PartyBlock party={invoice.shipTo} label="Ship to" className={CARD} />
        ) : (
          <div className={CARD}>
            <div className={CARD_LABEL}>Supply</div>
            <div>{doc.supply === 'intra' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}</div>
            <div className="opacity-70">Seller GSTIN {doc.seller.gstin || '—'}</div>
          </div>
        )}
      </div>

      {dispatch.length > 0 && (
        <div className={`${CARD} mb-3`}>
          <div className={CARD_LABEL}>Order &amp; dispatch</div>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
            {dispatch.map((cell) => (
              <div key={cell.label} className={cell.wide ? 'col-span-3' : ''}>
                <dt className="opacity-60">{cell.label}</dt>
                <dd className="font-medium">{cell.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-black/10">
        <ItemsTable doc={doc} options={{ title: doc.quote.title, advance: null }} variant="zebra" accent={ACCENT} />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_14rem] items-start gap-4">
        <div className="space-y-3">
          <AmountInWords label="Amount in words" words={doc.words.amount} aside="E. & O.E" />
          <TaxSummary doc={doc} variant="minimal" className="text-[10px]" />
        </div>
        <div className="rounded-lg bg-black/[0.04] p-3">
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt>Taxable value</dt>
            <dd className="text-right">{amount(doc.totals.taxablePaise)}</dd>
            {doc.taxes.map((tax) => (
              <div key={`${tax.label}-${tax.ratePct}`} className="contents">
                <dt>
                  {tax.label} @ {pct(tax.ratePct)}
                </dt>
                <dd className="text-right">{amount(tax.amountPaise)}</dd>
              </div>
            ))}
            {doc.totals.roundOffPaise !== 0 && (
              <>
                <dt>Round off</dt>
                <dd className="text-right">{signedAmount(doc.totals.roundOffPaise)}</dd>
              </>
            )}
          </dl>
          <div className="mt-2 flex justify-between border-t border-black/15 pt-2 text-[15px] font-bold" style={{ color: ACCENT }}>
            <span>Total</span>
            <span>{money(doc.totals.grandTotalPaise)}</span>
          </div>
          {invoice.amountPaidPaise > 0 && (
            <div className="mt-2 rounded-md bg-white p-2 text-[11.5px]">
              <div className="flex justify-between">
                <span>Received</span>
                <span>{money(invoice.amountPaidPaise)}</span>
              </div>
              <div className="mt-1 flex justify-between font-bold">
                <span>Balance due</span>
                <span>{money(invoice.balanceDuePaise)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
        <div className={CARD}>
          <div className={CARD_LABEL}>Bank details</div>
          {doc.seller.bank ? <BankDetails seller={doc.seller} heading="" /> : <p className="opacity-60">Add bank details in Settings → Company.</p>}
        </div>
        <div className={CARD}>
          <div className={CARD_LABEL}>Terms</div>
          {doc.quote.terms.length > 0 ? (
            <ul className="list-disc pl-4">
              {doc.quote.terms.map((term, index) => <li key={`${index}-${term}`}>{term}</li>)}
            </ul>
          ) : (
            <p className="opacity-60">{invoice.dueDate ? `Payment due by ${longDate(invoice.dueDate)}.` : 'Payment on receipt.'}</p>
          )}
          {doc.quote.notes && <p className="mt-2 whitespace-pre-line opacity-80">{doc.quote.notes}</p>}
        </div>
      </div>

      <SignatureBlock sellerName={doc.seller.name} declaration={doc.seller.declaration} className="mt-4 text-[11px]" />
      <div className="mt-3 text-center text-[10px] opacity-50">This is a computer generated invoice.</div>
    </div>
  );
}
