import { useCallback, useEffect, useState } from 'react';

import { DataTable } from '../../components/DataTable.js';
import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { statusPillClass } from '../../components/StatusBadge.js';
import { api } from '../../lib/api.js';
import { titleCase } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';
import { PageHeading, dayToday, errorText } from './shared.js';

interface SummaryPayload {
  date: string;
  checklist: {
    opening: ChecklistState;
    closing: ChecklistState;
  };
  tasks: { dueToday: number; urgent: number; openInbox: number; mineOpen: number };
  visitors: { total: number; open: number; rows: VisitorRow[] };
}

interface ChecklistState {
  items: { answer: { done: boolean } | null }[];
}

interface VisitorRow {
  _id: string;
  personName: string;
  organization: string;
  contact: string;
  timeIn: string | null;
  timeOut: string | null;
}

interface TaskRow {
  _id: string;
  title: string;
  kind: string;
  priority: string;
  status: string;
  dueDate: string | null;
}

const CARD = 'rounded-lg bg-app-surface p-4 shadow-sm';

function Card(props: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={CARD}>
      <div className="text-xs font-medium uppercase tracking-wide text-app-muted">
        {props.label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${props.tone ?? 'text-app-strong'}`}>
        {props.value}
      </div>
    </div>
  );
}

export function MyDayPage() {
  const date = dayToday();
  const [summary, setSummary] = useState<SummaryPayload | undefined>(undefined);
  const [page] = useState(1);
  const list = useList<TaskRow>('/api/v1/office/tasks', { view: 'open' }, page, 15);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [form, setForm] = useState({
    personName: '',
    organization: '',
    contact: '+91',
    purpose: '',
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSummary = useCallback(() => {
    api
      .get<SummaryPayload>(`/api/v1/office/summary?date=${date}`)
      .then((body) => setSummary(body))
      .catch(() => undefined);
  }, [date]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, list.rows]);

  async function completeTask(row: TaskRow) {
    try {
      await api.patch(`/api/v1/office/tasks/${row._id}`, { status: 'done' });
      list.reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  }

  async function addVisitor() {
    setBusy(true);
    try {
      await api.post('/api/v1/office/visitors', { kind: 'visitor', date, ...form });
      setVisitorOpen(false);
      setForm({ personName: '', organization: '', contact: '+91', purpose: '' });
      loadSummary();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        title="My Day"
        subtitle={`Business date ${date}`}
        actions={
          <button
            type="button"
            onClick={() => setVisitorOpen(true)}
            className="btn-primary"
          >
            + Visitor
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card label="Due today" value={summary?.tasks.dueToday ?? '…'} />
        <Card label="Urgent open" value={summary?.tasks.urgent ?? '…'} tone="text-app-danger-text" />
        <Card label="Open inbox" value={summary?.tasks.openInbox ?? '…'} />
        <Card label="Mine open" value={summary?.tasks.mineOpen ?? '…'} />
        <Card
          label="Visitors"
          value={summary ? `${summary.visitors.open}/${summary.visitors.total}` : '…'}
        />
        <Card
          label="Checklist"
          value={
            summary
              ? `↑ ${countDone(summary.checklist.opening)} · ↓ ${countDone(summary.checklist.closing)}`
              : '…'
          }
        />
      </div>

      {formError && <p className="mt-3 text-sm text-app-danger-text">{formError}</p>}

      <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
        Open tasks
      </h3>
      <div className="space-y-2">
        {list.rows.map((row) => (
          <div
            key={row._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-app-surface p-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-app-strong">{row.title}</div>
              <div className="mt-0.5 text-xs text-app-muted">
                {titleCase2(row.kind)} · {row.dueDate ? row.dueDate : 'No due date'}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`pill ${statusPillClass(row.priority)}`}>{titleCase(row.priority)}</span>
              <span className={`pill ${statusPillClass(row.status)}`}>{titleCase(row.status)}</span>
              {row.status !== 'done' && (
                <button
                  type="button"
                  onClick={() => void completeTask(row)}
                  className="btn-small"
                >
                  Mark done
                </button>
              )}
            </div>
          </div>
        ))}
        {list.rows.length === 0 && !list.loading && (
          <p className="text-sm text-app-muted">No open tasks.</p>
        )}
      </div>

      <h3 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
        Visitors today
      </h3>
      <DataTable
        rows={summary?.visitors.rows ?? []}
        rowKey={(row) => row._id}
        columns={[
          { header: 'Person', render: (row) => row.personName },
          { header: 'Organisation', render: (row) => row.organization || '—' },
          { header: 'Contact', render: (row) => row.contact || '—' },
          { header: 'Checked out', render: (row) => (row.timeOut ? 'Yes' : 'No') },
        ]}
      />

      {visitorOpen && (
        <ModalForm
          title="Register visitor"
          busy={busy}
          error={formError}
          onCancel={() => setVisitorOpen(false)}
          onSubmit={() => void addVisitor()}
        >
          <Field label="Person">
            <input
              className={inputClass}
              value={form.personName}
              onChange={(e) => setForm({ ...form, personName: e.target.value })}
              required
            />
          </Field>
          <Field label="Organisation">
            <input
              className={inputClass}
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </Field>
          <Field label="Contact">
            <input
              className={inputClass}
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </Field>
          <Field label="Purpose">
            <input
              className={inputClass}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </Field>
        </ModalForm>
      )}
    </div>
  );
}

function titleCase2(value: string): string {
  return value ? titleCase(value.replaceAll('_', ' ')) : '';
}

function countDone(state: ChecklistState): string {
  const done = state.items.filter((item) => item.answer?.done).length;
  return `${done}/${state.items.length}`;
}
