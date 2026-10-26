import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { COPY_KINDS, COPY_LABELS, type CopyKind, type InvoiceDocument } from '@ameen/domain';

import { NotFound } from '../../components/NotFound.js';
import { Segmented } from '../../components/Segmented.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { ApiRequestError, api } from '../../lib/api.js';
import { money } from '../documents/format.js';
import { INVOICE_LAYOUTS, INVOICE_LAYOUT_IDS, isInvoiceLayoutId, type InvoiceLayoutId } from '../documents/invoice-layouts/index.js';
import { PAGE_MM, Paper } from '../documents/Paper.js';
import { pdfFileName, renderPdf, sharePdf } from '../documents/sharePdf.js';
import { useLayoutParamFor } from '../documents/useQuoteLayout.js';

const EDITABLE_STATUSES = ['unpaid', 'overdue', 'cancelled'];
const SHORT_COPY: Record<CopyKind, string> = { original: 'Original', duplicate: 'Duplicate', triplicate: 'Triplicate' };

export function InvoiceDocumentPage() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [layoutId, setLayoutId] = useLayoutParamFor<InvoiceLayoutId>(doc?.quote.layout, isInvoiceLayoutId, 'tally');
  // View-only copy selection starts from the invoice's saved copies.
  const [copiesOverride, setCopies] = useState<CopyKind[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    setMissing(false);
    api
      .get<InvoiceDocument>(`/api/v1/payments/invoices/${id}/document`)
      .then((data) => !cancelled && setDoc(data))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && (err.status === 404 || err.status === 422)) setMissing(true);
        else setError(err instanceof Error ? err.message : 'Could not load the invoice');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (doc) document.title = `${doc.quote.number} · ${doc.party.name}`;
    return () => {
      document.title = 'Ameen';
    };
  }, [doc]);

  if (missing) return <NotFound />;
  if (error) return <p className="text-app-danger-text">{error}</p>;
  if (!doc) return <p className="text-app-muted">Loading…</p>;

  const copies = copiesOverride ?? doc.invoice.copies;
  const layout = INVOICE_LAYOUTS[layoutId];
  const Layout = layout.Component;
  const page = PAGE_MM[layout.pageSize];
  const editable = EDITABLE_STATUSES.includes(doc.quote.status) && doc.invoice.amountPaidPaise === 0;
  const summary = `${doc.quote.title} ${doc.quote.number} for ${doc.party.name}: ${money(doc.totals.grandTotalPaise)}${
    doc.invoice.dueDate ? `, due ${new Date(doc.invoice.dueDate).toLocaleDateString('en-IN')}` : ''
  }.`;

  function toggleCopy(copy: CopyKind) {
    const next = copies.includes(copy) ? copies.filter((entry) => entry !== copy) : [...copies, copy];
    // At least one copy always prints; keep Original → Triplicate order.
    if (next.length > 0) setCopies(COPY_KINDS.filter((kind) => next.includes(kind)));
  }

  async function onShare() {
    const sheets = sheetsRef.current ? Array.from(sheetsRef.current.querySelectorAll<HTMLElement>('.quote-paper')) : [];
    if (!doc || sheets.length === 0) return;
    setBusy(true);
    setShareError(null);
    setNotice(null);
    try {
      const blob = await renderPdf(sheets, layout.pageSize);
      const outcome = await sharePdf(blob, pdfFileName(doc.quote.number, doc.party.name, 'Invoice'), `${doc.quote.title} ${doc.quote.number}`, summary);
      if (outcome === 'downloaded') setNotice('PDF downloaded. Attach it to WhatsApp or email, or copy the message below.');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not create the PDF');
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(summary);
      setNotice('Message copied.');
    } catch {
      setShareError('Clipboard is not available. Select and copy the text manually.');
    }
  }

  return (
    <div className="quote-document-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="text-sm text-app-muted hover:text-app-text">
            ← Invoices
          </Link>
          <h2 className="text-2xl font-bold text-app-strong">{doc.quote.number}</h2>
          <StatusBadge status={doc.quote.status} />
          {doc.invoice.amountPaidPaise > 0 && (
            <span className="text-sm text-app-muted">Balance {money(doc.invoice.balanceDuePaise)}</span>
          )}
        </div>
        <div className="flex gap-2">
          {editable && (
            <Link to={`/invoices/${doc.quote.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          )}
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="btn-primary" onClick={onShare} disabled={busy}>
            {busy ? 'Preparing PDF…' : 'Share PDF'}
          </button>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
        <Segmented
          label="Layout"
          value={layoutId}
          options={INVOICE_LAYOUT_IDS.map((value) => ({ value, label: INVOICE_LAYOUTS[value].label, title: INVOICE_LAYOUTS[value].description }))}
          onChange={setLayoutId}
        />
        <fieldset className="flex items-center gap-3 text-sm text-app-muted">
          <legend className="sr-only">Copies</legend>
          Copies
          {COPY_KINDS.map((copy) => (
            <label key={copy} className="flex items-center gap-1.5 text-app-text" title={COPY_LABELS[copy]}>
              <input type="checkbox" checked={copies.includes(copy)} onChange={() => toggleCopy(copy)} />
              {SHORT_COPY[copy]}
            </label>
          ))}
        </fieldset>
        <span className="text-xs text-app-faint">{layout.description}</span>
      </div>

      {(notice || shareError) && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          {shareError ? <span className="text-app-danger-text">{shareError}</span> : <span className="text-app-text">{notice}</span>}
          <span className="flex gap-2">
            <button type="button" className="btn-small" onClick={copyMessage}>
              Copy WhatsApp text
            </button>
            <a
              className="btn-small"
              href={`mailto:?subject=${encodeURIComponent(`${doc.quote.title} ${doc.quote.number}`)}&body=${encodeURIComponent(`${summary}\n\nPlease find the invoice attached.`)}`}
            >
              Email
            </a>
          </span>
        </div>
      )}

      <div ref={sheetsRef} className="space-y-6 pb-8">
        {copies.map((copy) => (
          <Paper key={copy} size={layout.pageSize}>
            <Layout doc={doc} copy={copy} />
          </Paper>
        ))}
      </div>

      {createPortal(
        <div className="quote-print-portal">
          <style>{`@page { size: ${layout.pageSize}; margin: ${page.margin}mm; }`}</style>
          {copies.map((copy) => (
            <div key={copy} className="quote-paper quote-paper--print" style={{ width: `${page.width - page.margin * 2}mm` }}>
              <Layout doc={doc} copy={copy} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
