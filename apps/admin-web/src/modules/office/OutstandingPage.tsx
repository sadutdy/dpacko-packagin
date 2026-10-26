import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { rupees, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { PageHeading, StatusPill, TabBar, errorText } from './shared.js';

interface OutstandingRow {
  customerId: string;
  businessName: string;
  phone: string;
  creditUsedPaise: number;
  lastFollowup: { date: string; promiseDate: string; outcome: string } | null;
  overdue: boolean;
}

interface SmallRow {
  customerId: string;
  businessName: string;
  totalPaise: number;
  entries: { _id: string; amountPaise: number; reason: string; createdOn: string }[];
}

interface RoutePayload {
  view: string;
  rows: OutstandingRow[] | SmallRow[];
}

const VIEWS = [
  { key: 'daily', label: 'Daily' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'small', label: 'Small (carry-forward)' },
];

export function OutstandingPage() {
  const [view, setView] = useState('daily');
  const [payload, setPayload] = useState<RoutePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [followup, setFollowup] = useState<OutstandingRow | null>(null);
  const [small, setSmall] = useState<{ creates: boolean; row: SmallRow | null } | null>(null);
  const [form, setForm] = useState({
    outcome: 'promise_made',
    amountRupees: '',
    promiseDate: nextWeek(),
    detail: '',
  });
  const [smallForm, setSmallForm] = useState({ amountRupees: '', reason: '' });

  useEffect(() => {
    api
      .get<RoutePayload>(`/api/v1/office/outstanding?view=${view}`)
      .then((body) => setPayload(body))
      .catch((err: unknown) => setError(errorText(err)));
  }, [view]);

  async function saveFollowup() {
    if (!followup) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/office/outstanding/${followup.customerId}/followup`, {
        outcome: form.outcome,
        amountPaise: Math.round(Number(form.amountRupees || '0') * 100),
        promiseDate: form.promiseDate || undefined,
      });
      setFollowup(null);
      setForm({ outcome: 'promise_made', amountRupees: '', promiseDate: nextWeek(), detail: '' });
      setPayload(null);
      await api
        .get<RoutePayload>(`/api/v1/office/outstanding?view=${view}`)
        .then((body) => setPayload(body))
        .catch(() => undefined);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveSmall() {
    setBusy(true);
    try {
      await api.post('/api/v1/office/outstanding/small', {
        amountPaise: Math.round(Number(smallForm.amountRupees || '0') * 100),
        reason: smallForm.reason,
      });
      setSmall(null);
      setSmallForm({ amountRupees: '', reason: '' });
      setPayload(null);
      await api
        .get<RoutePayload>(`/api/v1/office/outstanding?view=small`)
        .then((body) => setPayload(body))
        .catch(() => undefined);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const creditColumns: Column<OutstandingRow>[] = [
    {
      header: 'Customer',
      render: (row) => <span className="font-medium text-app-strong">{row.businessName}</span>,
    },
    { header: 'Phone', render: (row) => row.phone },
    { header: 'On credit', render: (row) => rupees(row.creditUsedPaise) },
    {
      header: 'Last follow-up',
      render: (row) =>
        row.lastFollowup ? (
          <span className="text-xs">
            {row.lastFollowup.date} · {titleCase(row.lastFollowup.outcome)} · promises{' '}
            {row.lastFollowup.promiseDate || '—'}
          </span>
        ) : (
          <span className="text-xs text-app-muted">Never</span>
        ),
    },
    { header: 'State', render: (row) => <StatusPill value={row.overdue ? 'high' : 'approved'} /> },
    {
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setFollowup(row)}
          className="btn-small"
        >
          Follow up
        </button>
      ),
    },
  ];

  const smallColumns: Column<SmallRow>[] = [
    {
      header: 'Customer',
      render: (row) => <span className="font-medium text-app-strong">{row.businessName}</span>,
    },
    { header: 'Pending', render: (row) => rupees(row.totalPaise) },
    {
      header: 'Entries',
      render: (row) => (
        <span className="text-xs text-app-muted">
          {row.entries.length} · {titleCase(row.entries[0]?.reason ?? '')}
        </span>
      ),
    },
  ];

  const rows = payload?.rows ?? [];
  const isSmall = view === 'small';

  return (
    <div>
      <PageHeading
        title="Outstanding"
        subtitle={payload ? `${payload.view} view` : ''}
        actions={
          isSmall ? (
            <button
              type="button"
              onClick={() => setSmall({ creates: true, row: null })}
              className="btn-primary"
            >
              + Small entry
            </button>
          ) : undefined
        }
      />

      <TabBar tabs={VIEWS} active={view} onChange={setView} />
      {error && <p className="text-sm text-app-danger-text">{error}</p>}

      <DataTable
        rows={rows as never}
        rowKey={(row: { customerId: string }) => row.customerId}
        columns={(isSmall ? smallColumns : creditColumns) as never}
      />

      {followup && (
        <ModalForm
          title={`Follow up · ${followup.businessName}`}
          busy={busy}
          error={error}
          onCancel={() => setFollowup(null)}
          onSubmit={() => void saveFollowup()}
        >
          <Field label="Outcome">
            <select
              className={inputClass}
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
            >
              <option value="promise_made">Promise made</option>
              <option value="no_contact">No contact</option>
              <option value="message_left">Message left</option>
              <option value="collected">Collected</option>
            </select>
          </Field>
          <Field label="Amount discussed (₹)">
            <input
              type="number"
              className={inputClass}
              value={form.amountRupees}
              onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
            />
          </Field>
          <Field label="Promise date">
            <input
              type="date"
              className={inputClass}
              value={form.promiseDate}
              onChange={(e) => setForm({ ...form, promiseDate: e.target.value })}
            />
          </Field>
        </ModalForm>
      )}

      {small?.creates && (
        <ModalForm
          title="New small-outstanding entry"
          busy={busy}
          error={error}
          onCancel={() => setSmall(null)}
          onSubmit={() => void saveSmall()}
        >
          <Field label="Amount (₹, max 5,000)">
            <input
              type="number"
              className={inputClass}
              value={smallForm.amountRupees}
              onChange={(e) => setSmallForm({ ...smallForm, amountRupees: e.target.value })}
              required
            />
          </Field>
          <Field label="Reason">
            <input
              className={inputClass}
              value={smallForm.reason}
              onChange={(e) => setSmallForm({ ...smallForm, reason: e.target.value })}
              required
            />
          </Field>
          <p className="text-xs text-app-muted">
            Next billable order for this customer picks up pending small outstanding automatically.
          </p>
        </ModalForm>
      )}
    </div>
  );
}

function nextWeek(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}
