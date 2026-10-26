import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DocumentSeller } from '@ameen/domain';

import { NotFound } from '../../../components/NotFound.js';
import { ApiRequestError, api } from '../../../lib/api.js';
import { useList } from '../../../lib/useList.js';
import type { CustomerOption, SkuOption } from '../../documents/editor/core.js';
import { RestoredBanner, WizardShell } from '../../documents/editor/WizardShell.js';
import { clearStoredDraft, readStoredDraft, writeStoredDraft } from '../../documents/editor/storage.js';
import { useAutoRates } from '../../documents/editor/useAutoRates.js';
import { INVOICE_LAYOUTS } from '../../documents/invoice-layouts/index.js';
import { Paper } from '../../documents/Paper.js';
import {
  draftFromInvoice,
  draftFromQuoteSource,
  draftToDocument,
  draftToPayload,
  emptyInvoiceDraft,
  lastUsedInvoiceLayout,
  rememberInvoiceLayout,
  validateStep,
  type EditableInvoice,
  type InvoiceDraft,
  type QuoteSource,
} from './draft.js';
import { INVOICE_STEPS as STEPS } from './steps/index.js';
import type { DraftUpdate, EditorContext } from './types.js';

/** Unsaved new-invoice draft, kept per browser so a reload doesn't lose work. */
const DRAFT_KEY = 'ameen-invoice-draft';

interface StoredDraft {
  draft: InvoiceDraft;
  customer: CustomerOption | null;
}

/**
 * Full-page invoice editor for new and existing invoices. `?fromQuote=<id>`
 * starts a new invoice from a quote (buyer, overrides, lines, terms).
 */
export function InvoiceEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromQuote = params.get('fromQuote');
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [seller, setSeller] = useState<DocumentSeller | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);
  const [locked, setLocked] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { rows: skus } = useList<SkuOption>('/api/v1/catalog/skus', {}, 1, 100);

  useEffect(() => {
    let cancelled = false;
    const loadCustomer = async (customerId: string) => {
      const found = await api.get<CustomerOption>(`/api/v1/crm/customers/${customerId}`).catch(() => null);
      if (!cancelled) setCustomer(found);
    };
    const fail = (err: unknown, what: string) => {
      if (cancelled) return;
      if (err instanceof ApiRequestError && (err.status === 404 || err.status === 422)) setMissing(true);
      else setLoadError(err instanceof Error ? err.message : `Could not load the ${what}`);
    };

    api
      .get<DocumentSeller>('/api/v1/payments/invoices/seller')
      .then((data) => !cancelled && setSeller(data))
      .catch((err: unknown) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Could not load the company profile'));

    if (id) {
      api
        .get<EditableInvoice>(`/api/v1/payments/invoices/${id}/editable`)
        .then(async (invoice) => {
          if (cancelled) return;
          setInvoiceNumber(invoice.invoiceNumber);
          setLocked(!invoice.editable);
          setDraft(draftFromInvoice(invoice));
          setStepIndex(STEPS.findIndex((step) => step.id === 'items'));
          await loadCustomer(invoice.customerId);
        })
        .catch((err: unknown) => fail(err, 'invoice'));
    } else if (fromQuote) {
      api
        .get<QuoteSource>(`/api/v1/orders/quotes/${fromQuote}`)
        .then(async (quote) => {
          if (cancelled) return;
          setDraft(draftFromQuoteSource(quote, lastUsedInvoiceLayout()));
          setSourceLabel(quote.quoteNumber);
          setDirty(true);
          setStepIndex(STEPS.findIndex((step) => step.id === 'details'));
          await loadCustomer(quote.customerId);
        })
        .catch((err: unknown) => fail(err, 'quote'));
    } else {
      const stored = readStoredDraft<StoredDraft>(DRAFT_KEY, (value) => Array.isArray(value.draft?.lines));
      if (stored) {
        setDraft(stored.draft);
        setCustomer(stored.customer);
        setRestored(true);
      } else {
        setDraft(emptyInvoiceDraft(lastUsedInvoiceLayout()));
      }
    }
    return () => {
      cancelled = true;
    };
  }, [id, fromQuote]);

  useEffect(() => {
    document.title = editing ? `Edit ${invoiceNumber ?? 'invoice'}` : 'New invoice';
    return () => {
      document.title = 'Ameen';
    };
  }, [editing, invoiceNumber]);

  const update = useCallback((change: DraftUpdate) => {
    setDraft((current) => (current ? (typeof change === 'function' ? change(current) : { ...current, ...change }) : current));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!editing && dirty && draft) writeStoredDraft(DRAFT_KEY, { draft, customer } satisfies StoredDraft);
  }, [editing, dirty, draft, customer]);

  useAutoRates(draft, setDraft);

  const doc = useMemo(
    () => (draft && seller ? draftToDocument(draft, seller, customer, { id: id ?? 'new', number: invoiceNumber ?? 'INV-NEW' }) : null),
    [draft, seller, customer, id, invoiceNumber],
  );

  const stepErrors = useMemo(() => (draft ? STEPS.map((step) => validateStep(step.id, draft)) : []), [draft]);
  const stepValid = (index: number) => Object.keys(stepErrors[index] ?? {}).length === 0;
  const firstInvalid = stepErrors.findIndex((errors) => Object.keys(errors).length > 0);
  const goTo = (target: number) => setStepIndex(Math.max(0, Math.min(STEPS.length - 1, target)));

  const save = useCallback(async () => {
    if (!draft || saving) return;
    if (firstInvalid >= 0) {
      setAttempted(new Set(STEPS.map((step) => step.id)));
      setStepIndex(firstInvalid);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = draftToPayload(draft);
      const saved = id
        ? await api.put<{ _id: string }>(`/api/v1/payments/invoices/${id}`, payload)
        : await api.post<{ _id: string }>('/api/v1/payments/invoices', payload);
      rememberInvoiceLayout(draft.layout);
      if (!id) clearStoredDraft(DRAFT_KEY);
      setDirty(false);
      navigate(`/invoices/${saved._id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the invoice');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, firstInvalid, id, navigate]);

  if (missing) return <NotFound />;
  if (loadError) return <p className="text-app-danger-text">{loadError}</p>;
  if (!draft) return <p className="text-app-muted">Loading…</p>;
  if (locked) {
    return (
      <div className="card max-w-lg p-6">
        <h2 className="text-lg font-semibold text-app-strong">{invoiceNumber} can't be edited</h2>
        <p className="mt-1 text-sm text-app-muted">
          Payments are recorded against this invoice (or it is paid / credited). Raise a credit note to correct it.
        </p>
        <Link to={`/invoices/${id}`} className="btn-secondary mt-4">
          View invoice
        </Link>
      </div>
    );
  }

  const step = STEPS[stepIndex] ?? STEPS[0]!;
  const StepComponent = step.Component;
  const layout = INVOICE_LAYOUTS[draft.layout];
  const Layout = layout.Component;
  const ctx: EditorContext = {
    customer,
    setCustomer,
    seller,
    doc,
    documentNumber: invoiceNumber,
    skus,
    resetRate: (key) => update((d) => ({ ...d, lines: d.lines.map((line) => (line.key === key ? { ...line, autoRate: true } : line)) })),
    goTo: (stepId) => goTo(STEPS.findIndex((entry) => entry.id === stepId)),
  };

  return (
    <WizardShell
      title={editing ? `Edit ${invoiceNumber ?? ''}` : sourceLabel ? `Invoice from ${sourceLabel}` : 'New invoice'}
      backTo={id ? `/invoices/${id}` : fromQuote ? `/quotes/${fromQuote}` : '/invoices'}
      backLabel={id ? 'Invoice' : fromQuote ? 'Quote' : 'Invoices'}
      dirty={dirty}
      saving={saving}
      saveLabel={editing ? 'Save changes' : 'Save invoice'}
      onSave={() => void save()}
      banner={
        restored && (
          <RestoredBanner
            noun="invoice"
            onReset={() => {
              clearStoredDraft(DRAFT_KEY);
              setDraft(emptyInvoiceDraft(lastUsedInvoiceLayout()));
              setCustomer(null);
              setRestored(false);
              setDirty(false);
              setAttempted(new Set());
              goTo(0);
            }}
          />
        )
      }
      steps={STEPS}
      stepIndex={stepIndex}
      stepValid={stepValid}
      onStep={goTo}
      onNext={() => {
        if (stepValid(stepIndex)) goTo(stepIndex + 1);
        else setAttempted((current) => new Set(current).add(step.id));
      }}
      error={saveError}
      previewLabel={`Live preview · ${layout.label} · ${layout.pageSize} · ${draft.title}`}
      preview={
        doc ? (
          <Paper size={layout.pageSize}>
            <Layout doc={doc} copy={draft.copies[0] ?? 'original'} />
          </Paper>
        ) : (
          <p className="text-sm text-app-muted">Loading company profile…</p>
        )
      }
    >
      <StepComponent draft={draft} update={update} errors={attempted.has(step.id) ? stepErrors[stepIndex] ?? {} : {}} ctx={ctx} />
    </WizardShell>
  );
}
