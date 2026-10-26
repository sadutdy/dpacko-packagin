import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { advance, QUOTE_TITLES } from '@ameen/domain';

import { NotFound } from '../../components/NotFound.js';
import { Segmented } from '../../components/Segmented.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { ApiRequestError, api } from '../../lib/api.js';
import { LAYOUTS, LAYOUT_IDS, type LayoutId } from '../documents/layouts/index.js';
import { money } from '../documents/format.js';
import { PAGE_MM, Paper } from '../documents/Paper.js';
import { pdfFileName, renderPdf, sharePdf } from '../documents/sharePdf.js';
import type { DocumentTitle, QuoteDocument, ViewOptions } from '../documents/types.js';
import { useLayoutParam } from '../documents/useQuoteLayout.js';

export function QuoteDocumentPage() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<QuoteDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  // View-only tweaks start from the quote's saved presentation; they don't save.
  const [layoutId, setLayoutId] = useLayoutParam(doc?.quote.layout);
  const [titleOverride, setTitle] = useState<DocumentTitle | null>(null);
  const [advanceOverride, setAdvancePct] = useState<number | null>(null);
  const title = titleOverride ?? doc?.quote.title ?? 'Proforma Invoice';
  const advancePct = advanceOverride ?? doc?.quote.advancePct ?? 50;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    setMissing(false);
    api
      .get<QuoteDocument>(`/api/v1/orders/quotes/${id}/document`)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && (err.status === 404 || err.status === 422)) setMissing(true);
        else setError(err instanceof Error ? err.message : 'Could not load the quote');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const options: ViewOptions = useMemo(
    () => ({ title, advance: doc && advancePct > 0 ? advance(doc.totals.grandTotalPaise, advancePct) : null }),
    [title, advancePct, doc],
  );

  useEffect(() => {
    if (doc) document.title = `${doc.quote.number} · ${doc.party.name}`;
    return () => {
      document.title = 'Ameen';
    };
  }, [doc]);

  if (missing) return <NotFound />;
  if (error) return <p className="text-app-danger-text">{error}</p>;
  if (!doc) return <p className="text-app-muted">Loading…</p>;

  const layout = LAYOUTS[layoutId];
  const Layout = layout.Component;
  const page = PAGE_MM[layout.pageSize];
  const summary = `${title} ${doc.quote.number} for ${doc.party.name}: ${money(doc.totals.grandTotalPaise)}${
    options.advance ? `, advance ${money(options.advance.advancePaise)}` : ''
  }.`;

  async function onShare() {
    if (!paperRef.current || !doc) return;
    setBusy(true);
    setShareError(null);
    setNotice(null);
    try {
      const blob = await renderPdf(paperRef.current, layout.pageSize);
      const outcome = await sharePdf(blob, pdfFileName(doc.quote.number, doc.party.name), `${title} ${doc.quote.number}`, summary);
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
          <Link to="/quotes" className="text-sm text-app-muted hover:text-app-text">
            ← Quotes
          </Link>
          <h2 className="text-2xl font-bold text-app-strong">{doc.quote.number}</h2>
          <StatusBadge status={doc.quote.status} />
        </div>
        <div className="flex gap-2">
          {doc.quote.status !== 'converted' && (
            <Link to={`/quotes/${doc.quote.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          )}
          <Link to={`/invoices/new?fromQuote=${doc.quote.id}`} className="btn-secondary">
            Create invoice
          </Link>
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
          options={LAYOUT_IDS.map((value) => ({ value, label: LAYOUTS[value].label, title: LAYOUTS[value].description }))}
          onChange={(value: LayoutId) => setLayoutId(value)}
        />
        <label className="flex items-center gap-2 text-sm text-app-muted">
          Title
          <select
            className="rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm text-app-text"
            value={title}
            onChange={(e) => setTitle(e.target.value as DocumentTitle)}
          >
            {QUOTE_TITLES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-app-muted">
          Advance
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={advancePct}
            onChange={(e) => setAdvancePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="w-20 rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm text-app-text"
            aria-describedby="advance-hint"
          />
          <span id="advance-hint">% (0 hides it)</span>
        </label>
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
              href={`mailto:?subject=${encodeURIComponent(`${title} ${doc.quote.number}`)}&body=${encodeURIComponent(`${summary}\n\nPlease find the PDF attached.`)}`}
            >
              Email
            </a>
          </span>
        </div>
      )}

      <div className="pb-8">
        <Paper size={layout.pageSize} paperRef={paperRef}>
          <Layout doc={doc} options={options} />
        </Paper>
      </div>

      {createPortal(
        <div className="quote-print-portal">
          <style>{`@page { size: ${layout.pageSize}; margin: ${page.margin}mm; }`}</style>
          <div className="quote-paper quote-paper--print" style={{ width: `${page.width - page.margin * 2}mm` }}>
            <Layout doc={doc} options={options} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
