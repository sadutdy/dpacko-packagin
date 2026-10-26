import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { api } from '../../lib/api.js';
import { PageHeading, StatusPill, TabBar, errorText } from './shared.js';

interface DeviationRow {
  _id: string;
  kind: string;
  severity: string;
  category: string;
  detail: string;
  correctiveAction: string;
  openedBy: string | null;
  closedAt: string | null;
  createdAt: string;
}

interface ReminderRow {
  _id: string;
  key: string;
  kind: string;
  cron: string;
  active: boolean;
  channel: string;
  title: string;
}

interface MatrixRow {
  role: string;
  action: string;
  limitPaise: number | null;
  limitQty: number | null;
  active: boolean;
}

const TABS = [
  { key: 'deviations', label: 'Deviations' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'matrix', label: 'Delegation matrix' },
  { key: 'channels', label: 'Channels' },
];

export function ControlsPage() {
  const [tab, setTab] = useState('deviations');
  return (
    <div>
      <PageHeading
        title="Controls"
        subtitle="Deviations, reminder rules, delegation matrix & channels"
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'deviations' && <DeviationsTab />}
      {tab === 'reminders' && <RemindersTab />}
      {tab === 'matrix' && <MatrixTab />}
      {tab === 'channels' && <ChannelsTab />}
    </div>
  );
}

/* deviations ------------------------------------------------------------ */

function DeviationsTab() {
  const [rows, setRows] = useState<DeviationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: 'incident',
    severity: 'low',
    category: '',
    detail: '',
    correctiveAction: '',
  });

  async function load() {
    api
      .body<DeviationRow[]>('/api/v1/office/deviations')
      .then((body) => setRows(Array.isArray(body.data) ? body.data : []))
      .catch((err: unknown) => setError(errorText(err)));
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<DeviationRow>[] = [
    {
      header: 'Kind',
      render: (row) => (
        <span className="font-medium text-app-strong">{row.kind.replaceAll('_', ' ')}</span>
      ),
    },
    { header: 'Severity', render: (row) => <StatusPill value={row.severity} /> },
    { header: 'Category', render: (row) => row.category || '—' },
    {
      header: 'Detail',
      render: (row) => <span className="line-clamp-1 block max-w-sm">{row.detail}</span>,
    },
    {
      header: 'Closed',
      render: (row) => (row.closedAt ? new Date(row.closedAt).toLocaleDateString('en-IN') : '—'),
    },
    {
      header: '',
      render: (row) =>
        row.closedAt ? null : (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await api.patch(`/api/v1/office/deviations/${row._id}`, { closed: true });
              })
            }
            className="btn-small"
          >
            Close
          </button>
        ),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Deviation
      </button>
      <Err3 error={error} />
      <DataTable rows={rows} rowKey={(row) => row._id} columns={columns} />
      {open && (
        <ModalForm
          title="Open deviation"
          busy={busy}
          error={error}
          onCancel={() => setOpen(false)}
          onSubmit={() => {
            void run(async () => {
              await api.post('/api/v1/office/deviations', form);
              setForm({
                kind: 'incident',
                severity: 'low',
                category: '',
                detail: '',
                correctiveAction: '',
              });
            });
            setOpen(false);
          }}
        >
          <Field label="Kind">
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {[
                'missed_deadline',
                'unauthorized',
                'discrepancy',
                'incident',
                'near_miss',
                'suspected_fraud',
                'data_breach',
              ].map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select
              className={inputClass}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {['low', 'medium', 'high', 'critical'].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Detail">
            <input
              className={inputClass}
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              required
            />
          </Field>
          <Field label="Immediate escalation">
            <input
              type="checkbox"
              checked={form.severity === 'high' || form.severity === 'critical'}
              onChange={(e) => setForm({ ...form, severity: e.target.checked ? 'high' : 'low' })}
            />
          </Field>
        </ModalForm>
      )}
    </>
  );
}

function Err3(props: { error?: string | null }) {
  return props.error ? <p className="mt-3 text-sm text-app-danger-text">{props.error}</p> : null;
}

/* reminders --------------------------------------------------------------- */

function RemindersTab() {
  const { rows, error, reload } = useRefreshableReminders();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: '',
    kind: 'checklist_opening',
    cron: '0 7 * * *',
    title: '',
  });

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setFormError(null);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ReminderRow>[] = [
    {
      header: 'Key',
      render: (row) => <span className="font-medium text-app-strong">{row.key}</span>,
    },
    { header: 'Kind', render: (row) => row.kind.replaceAll('_', ' ') },
    { header: 'Cron', render: (row) => <code className="text-xs">{row.cron}</code> },
    { header: 'Channel', render: (row) => row.channel },
    {
      header: 'Active',
      render: (row) => <StatusPill value={row.active ? 'approved' : 'retired'} />,
    },
    {
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await api.patch(`/api/v1/office/reminders/${row.key}`, { active: !row.active });
            })
          }
          className="btn-small"
        >
          {row.active ? 'Disable' : 'Enable'}
        </button>
      ),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Reminder rule
      </button>
      <Err3 error={error ?? formError} />
      <DataTable rows={rows} rowKey={(row) => row.key} columns={columns} />
      {open && (
        <ModalForm
          title="Reminder rule"
          busy={busy}
          error={formError}
          onCancel={() => setOpen(false)}
          onSubmit={() => {
            void run(async () => {
              await api.post('/api/v1/office/reminders', form);
              setForm({ key: '', kind: 'checklist_opening', cron: '0 7 * * *', title: '' });
            });
            setOpen(false);
          }}
        >
          <Field label="Key">
            <input
              className={inputClass}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              required
            />
          </Field>
          <Field label="Kind">
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {[
                'checklist_opening',
                'checklist_closing',
                'route_day',
                'outstanding_followup',
                'maintenance',
                'sop_review',
              ].map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cron (Asia/Kolkata)">
            <input
              className={inputClass}
              value={form.cron}
              onChange={(e) => setForm({ ...form, cron: e.target.value })}
              required
            />
          </Field>
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
        </ModalForm>
      )}
    </>
  );
}

function useRefreshableReminders() {
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api
      .body<ReminderRow[]>('/api/v1/office/reminders')
      .then((body) => setRows(Array.isArray(body.data) ? body.data : []))
      .catch((err: unknown) => setError(errorText(err)));
  }, [tick]);
  return { rows, error, reload: () => setTick((value) => value + 1) };
}

/* delegation matrix ------------------------------------------------------- */

function MatrixTab() {
  const { rows, error, reload } = useMatrix();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    role: 'office_admin',
    action: 'indent_request',
    limitRupees: '',
    unlimited: false,
  });

  async function save() {
    setBusy(true);
    try {
      await api.put('/api/v1/office/matrix', {
        role: form.role,
        action: form.action,
        limitPaise: form.unlimited ? null : Math.round(Number(form.limitRupees || '0') * 100),
        active: true,
      });
      setFormError(null);
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<MatrixRow>[] = [
    {
      header: 'Role',
      render: (row) => <span className="font-medium text-app-strong">{row.role}</span>,
    },
    { header: 'Action', render: (row) => row.action.replaceAll('_', ' ') },
    {
      header: 'Limit',
      render: (row) => (row.limitPaise === null ? 'Unlimited' : formatRupeesShort(row.limitPaise)),
    },
    { header: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Upsert row
      </button>
      <Err3 error={error ?? formError} />
      <DataTable rows={rows} rowKey={(row) => `${row.role}:${row.action}`} columns={columns} />
      {open && (
        <ModalForm
          title="Delegation row"
          busy={busy}
          error={formError}
          onCancel={() => setOpen(false)}
          onSubmit={() => void save()}
        >
          <Field label="Role">
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {['office_admin', 'sales', 'finance', 'production', 'inventory'].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Action">
            <select
              className={inputClass}
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              {[
                'indent_request',
                'production_request',
                'petty_cash_entry',
                'price_approval',
                'invoice_approval',
                'document_removal',
              ].map((action) => (
                <option key={action} value={action}>
                  {action.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Limit (₹)">
            <input
              type="number"
              className={inputClass}
              value={form.limitRupees}
              onChange={(e) => setForm({ ...form, limitRupees: e.target.value })}
              disabled={form.unlimited}
            />
          </Field>
          <Field label="Unlimited">
            <input
              type="checkbox"
              checked={form.unlimited}
              onChange={(e) => setForm({ ...form, unlimited: e.target.checked })}
            />
          </Field>
        </ModalForm>
      )}
    </>
  );
}

function useMatrix() {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api
      .body<MatrixRow[]>('/api/v1/office/matrix')
      .then((body) => setRows(Array.isArray(body.data) ? body.data : []))
      .catch((err: unknown) => setError(errorText(err)));
  }, [tick]);
  return { rows, error, reload: () => setTick((value) => value + 1) };
}

/* channels ---------------------------------------------------------------- */

interface ChannelRow {
  _id: string;
  group: string;
  channel: string;
  enabled: boolean;
}

function ChannelsTab() {
  const { rows, error } = useChannelRows();
  const columns: Column<ChannelRow>[] = [
    {
      header: 'Audience group',
      render: (row) => <span className="font-medium text-app-strong">{row.group}</span>,
    },
    { header: 'Channel', render: (row) => row.channel },
    { header: 'Enabled', render: (row) => (row.enabled ? 'Yes' : 'No') },
  ];
  return (
    <>
      <p className="mb-2 text-xs text-app-muted">
        Desk-step messages fan out across these audience groups × channels (whatsapp/sms awaiting
        providers).
      </p>
      <Err3 error={error} />
      <DataTable rows={rows} rowKey={(row) => row._id} columns={columns} />
    </>
  );
}

function useChannelRows() {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .body<ChannelRow[]>('/api/v1/office/channels')
      .then((body) => setRows(Array.isArray(body.data) ? body.data : []))
      .catch((err: unknown) => setError(errorText(err)));
  }, []);
  return { rows, error };
}

function formatRupeesShort(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
