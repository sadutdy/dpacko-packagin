import { AmountInWords } from '../parts/AmountInWords.js';
import { ItemsTable } from '../parts/ItemsTable.js';
import { PartyBlock } from '../parts/PartyBlock.js';
import { SellerBlock } from '../parts/SellerBlock.js';
import { SignatureBlock } from '../parts/SignatureBlock.js';
import { TaxSummary } from '../parts/TaxSummary.js';
import { amount, longDate, money, pct, signedAmount } from '../format.js';
import type { LayoutProps } from '../types.js';

const ACCENT = 'var(--app-accent)';

function Meta(props: { label: string; value: string }) {
  return (
    <>
      <dt className="opacity-60">{props.label}</dt>
      <dd className="text-right font-medium">{props.value}</dd>
    </>
  );
}

/** Branded layout: logo, accent title block, cards, totals panel, bank details. */
export function ModernLayout({ doc, options }: LayoutProps) {
  const bank = doc.seller.bank;
  return (
    <div className="font-sans text-[12px] leading-relaxed text-[#1d1d1f]">
      <header className="flex items-start justify-between gap-6">
        <SellerBlock seller={doc.seller} align="left" showLogo className="text-[11.5px] [&>div:first-of-type]:text-[15px]" />
        <div className="min-w-[38%] text-right">
          <div className="text-[26px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
            {options.title}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[11.5px]">
            <Meta label="Number" value={doc.quote.number} />
            <Meta label="Date" value={longDate(doc.quote.date)} />
            {doc.quote.validUntil && <Meta label="Valid until" value={longDate(doc.quote.validUntil)} />}
            <Meta label="Status" value={doc.quote.status.replace(/_/g, ' ')} />
          </dl>
        </div>
      </header>

      <div className="my-5 h-1 rounded-full" style={{ background: ACCENT }} />

      <div className="mb-5 grid grid-cols-2 gap-4">
        <PartyBlock party={doc.party} label="Bill to" className="rounded-lg border border-black/10 p-3" />
        <div className="rounded-lg border border-black/10 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">Supply details</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4">
            <Meta label="Place of supply" value={doc.party.stateName ? `${doc.party.stateName} (${doc.party.stateCode})` : '—'} />
            <Meta label="Supply type" value={doc.supply === 'intra' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'} />
            <Meta label="Seller GSTIN" value={doc.seller.gstin || '—'} />
          </dl>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10">
        <ItemsTable doc={doc} options={options} variant="zebra" accent={ACCENT} />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_14rem] items-start gap-5">
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
            <span>Grand total</span>
            <span>{money(doc.totals.grandTotalPaise)}</span>
          </div>
          {options.advance && (
            <div className="mt-2 rounded-md bg-white p-2 text-[11.5px]">
              <div className="flex justify-between">
                <span>Advance ({options.advance.pct}%)</span>
                <span>{amount(options.advance.exactPaise)}</span>
              </div>
              {options.advance.roundOffPaise !== 0 && (
                <div className="flex justify-between opacity-70">
                  <span>Round off</span>
                  <span>{signedAmount(options.advance.roundOffPaise)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between font-bold">
                <span>Advance due</span>
                <span>{money(options.advance.advancePaise)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-[11px]">
        <div className="rounded-lg border border-black/10 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">Bank details</div>
          {bank ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3">
              <dt className="opacity-60">Bank</dt>
              <dd>{bank.bankName}</dd>
              <dt className="opacity-60">A/c No.</dt>
              <dd>{bank.accountNo}</dd>
              <dt className="opacity-60">IFSC</dt>
              <dd>{bank.ifsc}</dd>
              {bank.branch && (
                <>
                  <dt className="opacity-60">Branch</dt>
                  <dd>{bank.branch}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="opacity-60">Add bank details in Settings → Company.</p>
          )}
        </div>
        <div className="rounded-lg border border-black/10 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">Terms</div>
          <ul className="list-disc pl-4">
            {doc.quote.terms.length > 0 ? (
              doc.quote.terms.map((term, index) => <li key={`${index}-${term}`}>{term}</li>)
            ) : (
              <>
                {doc.quote.validUntil && <li>Prices valid until {longDate(doc.quote.validUntil)}.</li>}
                {options.advance && <li>{options.advance.pct}% advance with the order, balance before dispatch.</li>}
                <li>Taxes as applicable at the time of invoicing.</li>
              </>
            )}
          </ul>
          {doc.quote.notes && <p className="mt-2 whitespace-pre-line opacity-80">{doc.quote.notes}</p>}
        </div>
      </div>

      <SignatureBlock sellerName={doc.seller.name} declaration={doc.seller.declaration} className="mt-6 text-[11px]" />
      <div className="mt-6 text-center text-[10px] opacity-50">This is a computer generated document.</div>
    </div>
  );
}
