import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { advance, type DocumentSeller } from '@ameen/domain';

import { NotFound } from '../../../components/NotFound.js';
import { ApiRequestError, api } from '../../../lib/api.js';
import { useList } from '../../../lib/useList.js';
import { RestoredBanner, WizardShell } from '../../documents/editor/WizardShell.js';
import { clearStoredDraft, readStoredDraft, writeStoredDraft } from '../../documents/editor/storage.js';
import { useAutoRates } from '../../documents/editor/useAutoRates.js';
import { LAYOUTS, isLayoutId } from '../../documents/layouts/index.js';
import { Paper } from '../../documents/Paper.js';
import { lastUsedLayout, rememberLayout } from '../../documents/useQuoteLayout.js';
import {
  draftFromQuote,
  draftToDocument,
  draftToPayload,
  emptyDraft,
  validateStep,
  type CustomerOption,
  type EditableQuote,
  type QuoteDraft,
  type SkuOption,
} from './draft.js';
import { STEPS } from './steps/index.js';
import type { DraftUpdate, EditorContext } from './types.js';

/** Unsaved new-quote draft, kept per browser so a reload doesn't lose work. */
const DRAFT_KEY = 'ameen-quote-draft';

interface StoredDraft {
  draft: QuoteDraft;
  customer: CustomerOption | null;
}

/**
 * Full-page quote editor used for both new and existing quotes: a step
 * wizard on the left and the live document, in the chosen layout, on the right.
 */
export function QuoteEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
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

  // Load the seller profile, then the quote (edit) or a fresh / restored draft (new).
  useEffect(() => {
    let cancelled = false;
    api
      .get<DocumentSeller>('/api/v1/orders/quotes/seller')
      .then((data) => !cancelled && setSeller(data))
      .catch((err: unknown) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Could not load the company profile'));

    if (!id) {
      const stored = readStoredDraft<StoredDraft>(DRAFT_KEY, (value) => Array.isArray(value.draft?.lines));
      if (stored) {
        setDraft(stored.draft);
        setCustomer(stored.customer);
        setRestored(true);
      } else {
        setDraft(emptyDraft(lastUsedLayout()));
      }
      return () => {
        cancelled = true;
      };
    }

    api
      .get<EditableQuote>(`/api/v1/orders/quotes/${id}`)
      .then(async (quote) => {
        if (cancelled) return;
        setQuoteNumber(quote.quoteNumber);
        setLocked(quote.status === 'converted');
        setDraft(draftFromQuote(quote, isLayoutId));
        setStepIndex(STEPS.findIndex((step) => step.id === 'items'));
        const found = await api.get<CustomerOption>(`/api/v1/crm/customers/${quote.customerId}`).catch(() => null);
        if (!cancelled) setCustomer(found);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && (err.status === 404 || err.status === 422)) setMissing(true);
        else setLoadError(err instanceof Error ? err.message : 'Could not load the quote');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    document.title = editing ? `Edit ${quoteNumber ?? 'quote'}` : 'New quote';
    return () => {
      document.title = 'Ameen';
    };
  }, [editing, quoteNumber]);

  const update = useCallback((change: DraftUpdate) => {
    setDraft((current) => (current ? (typeof change === 'function' ? change(current) : { ...current, ...change }) : current));
    setDirty(true);
  }, []);

  // Keep an unsaved new quote across reloads.
  useEffect(() => {
    if (!editing && dirty && draft) writeStoredDraft(DRAFT_KEY, { draft, customer } satisfies StoredDraft);
  }, [editing, dirty, draft, customer]);

  useAutoRates(draft, setDraft);

  const doc = useMemo(
    () => (draft && seller ? draftToDocument(draft, seller, customer, { id: id ?? 'new', number: quoteNumber ?? 'QT-NEW' }) : null),
    [draft, seller, customer, id, quoteNumber],
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
        ? await api.put<{ _id: string }>(`/api/v1/orders/quotes/${id}`, payload)
        : await api.post<{ _id: string }>('/api/v1/orders/quotes', payload);
      rememberLayout(draft.layout);
      if (!id) clearStoredDraft(DRAFT_KEY);
      setDirty(false);
      navigate(`/quotes/${saved._id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the quote');
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
        <h2 className="text-lg font-semibold text-app-strong">{quoteNumber} is converted</h2>
        <p className="mt-1 text-sm text-app-muted">Converted quotes are part of an order and can no longer be edited.</p>
        <Link to={`/quotes/${id}`} className="btn-secondary mt-4">
          View quote
        </Link>
      </div>
    );
  }

  const step = STEPS[stepIndex] ?? STEPS[0]!;
  const StepComponent = step.Component;
  const layout = LAYOUTS[draft.layout];
  const Layout = layout.Component;
  const ctx: EditorContext = {
    customer,
    setCustomer,
    seller,
    doc,
    documentNumber: quoteNumber,
    skus,
    resetRate: (key) => update((d) => ({ ...d, lines: d.lines.map((line) => (line.key === key ? { ...line, autoRate: true } : line)) })),
    goTo: (stepId) => goTo(STEPS.findIndex((entry) => entry.id === stepId)),
  };

  return (
    <WizardShell
      title={editing ? `Edit ${quoteNumber ?? ''}` : 'New quote'}
      backTo={id ? `/quotes/${id}` : '/quotes'}
      backLabel={id ? 'Quote' : 'Quotes'}
      dirty={dirty}
      saving={saving}
      saveLabel={editing ? 'Save changes' : 'Save quote'}
      onSave={() => void save()}
      banner={
        restored && (
          <RestoredBanner
            noun="quote"
            onReset={() => {
              clearStoredDraft(DRAFT_KEY);
              setDraft(emptyDraft(lastUsedLayout()));
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
            <Layout
              doc={doc}
              options={{ title: draft.title, advance: draft.advancePct > 0 ? advance(doc.totals.grandTotalPaise, draft.advancePct) : null }}
            />
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
