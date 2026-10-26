import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { rupees, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';
import { PageHeading, StatusPill, TabBar, errorText } from './shared.js';

const BASE = '/api/v1/office/registers';

const TABS = [
  { key: 'courier', label: 'Courier' },
  { key: 'stationery', label: 'Stationery' },
  { key: 'indents', label: 'Indents' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'waste', label: 'Waste' },
  { key: 'petty-cash', label: 'Petty cash' },
  { key: 'vendor-tracker', label: 'Vendor tracker' },
  { key: 'documents', label: 'Documents' },
  { key: 'attendance', label: 'Attendance' },
];

function Modal(props: {
  title: string;
  open: boolean;
  busy?: boolean;
  error?: string | null;
  fields: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return props.open ? (
    <ModalForm
      title={props.title}
      busy={props.busy}
      error={props.error}
      onCancel={props.onClose}
      onSubmit={props.onSubmit}
    >
      {props.fields}
    </ModalForm>
  ) : null;
}

function useModalForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const wrap = (run: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await run();
      setOpen(false);
      setError(null);
      setReload((value) => value + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return { open, setOpen, busy, error, reload, wrap };
}

function Err(props: { error?: string | null }) {
  return props.error ? <p className="mt-3 text-sm text-app-danger-text">{props.error}</p> : null;
}

/* ------------------------------- courier ------------------------------- */

interface CourierRow {
  _id: string;
  docketNo: string;
  direction: string;
  routeTo: string;
  toName: string;
  company: string;
  podRef: string;
  receivedBy: string;
  createdAt: string;
}

interface ListBody<T> {
  data: T[];
  meta?: { total: number; page: number; totalPages: number };
}

function useRegisterList<T>(tab: string, extra?: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<ListBody<T>['meta']>();
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api
      .body<T[]>(`${BASE}/${tab}?limit=50${extra ? `&${extra}` : ''}`)
      .then((body) => {
        setRows(Array.isArray(body.data) ? body.data : []);
        setMeta(body.meta);
        setError(null);
      })
      .catch((err: unknown) => setError(errorText(err)));
  }, [tab, extra, tick]);
  return { rows, meta, error, reload: () => setTick((value) => value + 1) };
}

export function RegistersPage() {
  const [tab, setTab] = useState('courier');
  return (
    <div>
      <PageHeading
        title="Registers"
        subtitle="Nine registers under /office/registers with CSV export"
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'courier' && <CourierTab />}
      {tab === 'stationery' && <StationeryTab />}
      {tab === 'indents' && <IndentsTab />}
      {tab === 'maintenance' && <MaintenanceTab />}
      {tab === 'waste' && <WasteTab />}
      {tab === 'petty-cash' && <PettyCashTab />}
      {tab === 'vendor-tracker' && <VendorTab />}
      {tab === 'documents' && <DocumentsTab />}
      {tab === 'attendance' && <AttendanceTab />}
    </div>
  );
}

/* courier tab ------------------------------------------------------------ */

function CourierTab() {
  const list = useRegisterList<CourierRow>('courier');
  const form = useModalForm();
  const [doc, setDoc] = useState({ docketNo: '', direction: 'sent', routeTo: '', toName: '' });

  const columns: Column<CourierRow>[] = [
    {
      header: 'Docket',
      render: (row) => <span className="font-medium text-app-strong">{row.docketNo}</span>,
    },
    { header: 'Direction', render: (row) => titleCase(row.direction) },
    { header: 'Route to', render: (row) => row.routeTo || row.toName || row.company || '—' },
    { header: 'POD', render: (row) => row.podRef || '—' },
    { header: 'Received by', render: (row) => row.receivedBy || '—' },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => form.setOpen(true)}
        className="btn-primary mb-3"
      >
        + Courier entry
      </button>
      <Err error={list.error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Courier entry"
        open={form.open}
        busy={form.busy}
        error={form.error}
        onClose={() => form.setOpen(false)}
        onSubmit={form.wrap(async () => {
          await api.post(`${BASE}/courier`, doc);
          setDoc({ docketNo: '', direction: 'sent', routeTo: '', toName: '' });
          list.reload();
        })}
        fields={
          <>
            <Field label="Docket no">
              <input
                className={inputClass}
                value={doc.docketNo}
                onChange={(e) => setDoc({ ...doc, docketNo: e.target.value })}
                required
              />
            </Field>
            <Field label="Direction">
              <select
                className={inputClass}
                value={doc.direction}
                onChange={(e) => setDoc({ ...doc, direction: e.target.value })}
              >
                <option value="sent">Sent</option>
                <option value="received">Received</option>
              </select>
            </Field>
            <Field label="Route to / party">
              <input
                className={inputClass}
                value={doc.routeTo}
                onChange={(e) => setDoc({ ...doc, routeTo: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}

/* stationery tab --------------------------------------------------------- */

interface StationeryRow {
  _id: string;
  name: string;
  unit: string;
  qty: number;
  reorderLevel: number;
  avgCostPaise: number;
}

function StationeryTab() {
  const list = useRegisterList<StationeryRow>('stationery');
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState({ name: '', unit: 'pcs', qty: 0, reorderLevel: 0 });
  const [move, setMove] = useState<{ row: StationeryRow; direction: string } | null>(null);
  const [moveQty, setMoveQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<StationeryRow>[] = [
    {
      header: 'Item',
      render: (row) => <span className="font-medium text-app-strong">{row.name}</span>,
    },
    { header: 'Qty', render: (row) => `${row.qty} ${row.unit}` },
    { header: 'Reorder level', render: (row) => String(row.reorderLevel) },
    { header: 'Avg cost', render: (row) => rupees(row.avgCostPaise) },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          {(['in', 'out', 'reorder'] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => {
                setMove({ row, direction });
                setMoveQty(1);
              }}
              className="btn-small capitalize"
            >
              {direction}
            </button>
          ))}
        </div>
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
        + Item
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Stationery item"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/stationery`, {
              ...item,
              qty: Number(item.qty),
              reorderLevel: Number(item.reorderLevel),
            });
            setItem({ name: '', unit: 'pcs', qty: 0, reorderLevel: 0 });
          })
        }
        fields={
          <>
            <Field label="Name">
              <input
                className={inputClass}
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Unit">
              <input
                className={inputClass}
                value={item.unit}
                onChange={(e) => setItem({ ...item, unit: e.target.value })}
              />
            </Field>
            <Field label="Opening qty">
              <input
                type="number"
                className={inputClass}
                value={item.qty}
                onChange={(e) => setItem({ ...item, qty: Number(e.target.value) })}
              />
            </Field>
            <Field label="Reorder level">
              <input
                type="number"
                className={inputClass}
                value={item.reorderLevel}
                onChange={(e) => setItem({ ...item, reorderLevel: Number(e.target.value) })}
              />
            </Field>
          </>
        }
      />
      <Modal
        title={move ? `${titleCase(move.direction)} · ${move.row.name}` : ''}
        open={move !== null}
        busy={busy}
        error={error}
        onClose={() => setMove(null)}
        onSubmit={() =>
          void run(async () => {
            if (move)
              await api.post(`${BASE}/stationery/move`, {
                itemId: move.row._id,
                direction: move.direction,
                qty: Number(moveQty),
              });
            setMove(null);
          })
        }
        fields={
          <Field label="Qty">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={moveQty}
              onChange={(e) => setMoveQty(Number(e.target.value))}
              required
            />
          </Field>
        }
      />
    </>
  );
}

/* indents tab ------------------------------------------------------------ */

interface IndentRow {
  _id: string;
  refNo: string;
  title: string;
  qty: number;
  estimatedPaise: number;
  status: string;
  decisionNote: string;
}

function IndentsTab() {
  const list = useRegisterList<IndentRow>('indents');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    itemDetail: '',
    qty: 1,
    estimatedRupees: '1000',
    purpose: '',
  });

  const columns: Column<IndentRow>[] = [
    {
      header: 'Ref',
      render: (row) => <span className="font-medium text-app-strong">{row.refNo}</span>,
    },
    { header: 'Title', render: (row) => row.title },
    { header: 'Qty', render: (row) => String(row.qty) },
    { header: 'Estimate', render: (row) => rupees(row.estimatedPaise) },
    { header: 'Status', render: (row) => <StatusPill value={row.status} /> },
    {
      header: 'Decisions',
      render: (row) =>
        row.status === 'submitted' || row.status === 'approved' ? (
          <div className="flex gap-1">
            {row.status === 'submitted' && (
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await api.patch(`${BASE}/indents/${row._id}`, { action: 'approve' });
                  })
                }
                className="btn-small"
              >
                Approve
              </button>
            )}
            {row.status === 'approved' && (
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await api.patch(`${BASE}/indents/${row._id}`, { action: 'commit' });
                  })
                }
                className="btn-small"
              >
                Commit
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  await api.patch(`${BASE}/indents/${row._id}`, {
                    action: 'reject',
                    note: 'Rejected from register UI',
                  });
                })
              }
              className="btn-small-danger"
            >
              Reject
            </button>
          </div>
        ) : (
          <span className="text-xs text-app-faint">
            {row.decisionNote || titleCase(row.status)}
          </span>
        ),
    },
  ];

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Indent
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="New indent"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          void run(async () => {
            await api.post(`${BASE}/indents`, {
              title: form.title,
              itemDetail: form.itemDetail,
              qty: Number(form.qty),
              estimatedPaise: Math.round(Number(form.estimatedRupees) * 100),
              purpose: form.purpose,
            });
            setForm({ title: '', itemDetail: '', qty: 1, estimatedRupees: '1000', purpose: '' });
          });
        }}
        fields={
          <>
            <Field label="Title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Field>
            <Field label="Item detail">
              <input
                className={inputClass}
                value={form.itemDetail}
                onChange={(e) => setForm({ ...form, itemDetail: e.target.value })}
              />
            </Field>
            <Field label="Qty">
              <input
                type="number"
                className={inputClass}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              />
            </Field>
            <Field label="Estimate (₹)">
              <input
                type="number"
                className={inputClass}
                value={form.estimatedRupees}
                onChange={(e) => setForm({ ...form, estimatedRupees: e.target.value })}
              />
            </Field>
            <Field label="Purpose">
              <input
                className={inputClass}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}

/* maintenance tab -------------------------------------------------------- */

interface MaintenanceRow {
  _id: string;
  location: string;
  issue: string;
  priority: string;
  assignedTeam: string;
  status: string;
  cadence: string;
}

function MaintenanceTab() {
  const list = useRegisterList<MaintenanceRow>('maintenance');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    location: '',
    issue: '',
    priority: 'medium',
    cadence: 'none',
    nextDueDate: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<MaintenanceRow>[] = [
    {
      header: 'Location',
      render: (row) => <span className="font-medium text-app-strong">{row.location}</span>,
    },
    { header: 'Issue', render: (row) => row.issue },
    { header: 'Priority', render: (row) => <StatusPill value={row.priority} /> },
    { header: 'Team', render: (row) => row.assignedTeam || '—' },
    { header: 'Status', render: (row) => <StatusPill value={row.status} /> },
    {
      header: '',
      render: (row) =>
        row.status !== 'resolved' ? (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await api.patch(`${BASE}/maintenance/${row._id}`, { status: 'resolved' });
              })
            }
            className="btn-small"
          >
            Resolve
          </button>
        ) : (
          <span className="text-xs text-app-faint">Done</span>
        ),
    },
  ];

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Maintenance
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Maintenance log"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/maintenance`, form);
            setForm({
              location: '',
              issue: '',
              priority: 'medium',
              cadence: 'none',
              nextDueDate: '',
            });
          })
        }
        fields={
          <>
            <Field label="Location">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
            </Field>
            <Field label="Issue">
              <input
                className={inputClass}
                value={form.issue}
                onChange={(e) => setForm({ ...form, issue: e.target.value })}
                required
              />
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Cadence">
              <select
                className={inputClass}
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value })}
              >
                <option value="none">One-off</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
          </>
        }
      />
    </>
  );
}

/* waste tab -------------------------------------------------------------- */

interface WasteRow {
  _id: string;
  type: string;
  qty: number;
  unit: string;
  handler: string;
  at: string;
}

function WasteTab() {
  const list = useRegisterList<WasteRow>('waste');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'paper', qty: 1, unit: 'kg', handler: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<WasteRow>[] = [
    {
      header: 'Type',
      render: (row) => <span className="font-medium text-app-strong">{titleCase(row.type)}</span>,
    },
    { header: 'Qty', render: (row) => `${row.qty} ${row.unit}` },
    { header: 'Handler', render: (row) => row.handler },
    { header: 'When', render: (row) => new Date(row.at).toLocaleDateString('en-IN') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Waste entry
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Waste disposal"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/waste`, form);
            setForm({ type: 'paper', qty: 1, unit: 'kg', handler: '' });
          })
        }
        fields={
          <>
            <Field label="Type">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="paper">Paper</option>
                <option value="scrap">Scrap</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
            <Field label="Qty">
              <input
                type="number"
                step="0.1"
                className={inputClass}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              />
            </Field>
            <Field label="Handler (leave blank for Haritha Karma Sena)">
              <input
                className={inputClass}
                value={form.handler}
                onChange={(e) => setForm({ ...form, handler: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}

/* petty cash tab --------------------------------------------------------- */

interface PettyRow {
  _id: string;
  date: string;
  purpose: string;
  requester: string;
  amountPaise: number;
  status: string;
  splittingSuspect: boolean;
}

function PettyCashTab() {
  const list = useRegisterList<PettyRow>('petty-cash');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    purpose: '',
    requester: '',
    receiptNo: '',
    amountRupees: '100',
    costCentre: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PettyRow>[] = [
    { header: 'Date', render: (row) => row.date },
    {
      header: 'Purpose',
      render: (row) => <span className="font-medium text-app-strong">{row.purpose}</span>,
    },
    { header: 'Requester', render: (row) => row.requester || '—' },
    { header: 'Amount', render: (row) => rupees(row.amountPaise) },
    {
      header: 'Status',
      render: (row) =>
        row.splittingSuspect ? (
          <span className="pill pill-problem">
            flagged (splitting)
          </span>
        ) : (
          <StatusPill value={row.status} />
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
        + Petty cash
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Petty cash entry"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/petty-cash`, {
              purpose: form.purpose,
              requester: form.requester,
              receiptNo: form.receiptNo,
              costCentre: form.costCentre,
              amountPaise: Math.round(Number(form.amountRupees) * 100),
            });
            setForm({
              purpose: '',
              requester: '',
              receiptNo: '',
              amountRupees: '100',
              costCentre: '',
            });
          })
        }
        fields={
          <>
            <Field label="Purpose">
              <input
                className={inputClass}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                required
              />
            </Field>
            <Field label="Requester (rolling 7-day split check)">
              <input
                className={inputClass}
                value={form.requester}
                onChange={(e) => setForm({ ...form, requester: e.target.value })}
              />
            </Field>
            <Field label="Amount (₹)">
              <input
                type="number"
                className={inputClass}
                value={form.amountRupees}
                onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
                required
              />
            </Field>
            <Field label="Receipt no">
              <input
                className={inputClass}
                value={form.receiptNo}
                onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}

/* vendor tracker tab ----------------------------------------------------- */

interface VendorRow {
  _id: string;
  poNumber: string;
  status: string;
  promisedDate: string | null;
  pendingDocuments: string[];
  overdueEscalated: boolean;
}

function VendorTab() {
  const list = useRegisterList<VendorRow>('vendor-tracker');
  const [openA, setOpenA] = useState(false);
  const [vendors, setVendors] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState({ vendorId: '', poNumber: '', promisedDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list2 = useList<{ _id: string; name: string }>('/api/v1/purchasing/vendors', {}, 1, 100);

  useEffect(() => {
    setVendors(list2.rows);
  }, [list2.rows]);

  const columns: Column<VendorRow>[] = [
    {
      header: 'PO',
      render: (row) => <span className="font-medium text-app-strong">{row.poNumber || '—'}</span>,
    },
    {
      header: 'Promised',
      render: (row) =>
        row.promisedDate ? new Date(row.promisedDate).toLocaleDateString('en-IN') : '—',
    },
    { header: 'Docs pending', render: (row) => row.pendingDocuments?.join(', ') || '—' },
    {
      header: 'Status',
      render: (row) =>
        row.overdueEscalated ? (
          <span className="pill pill-problem">
            {row.status} · escalated
          </span>
        ) : (
          <StatusPill value={row.status} />
        ),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenA(true)}
        className="btn-primary mb-3"
      >
        + Tracker row
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Vendor delivery tracker"
        open={openA}
        busy={busy}
        error={error}
        onClose={() => setOpenA(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/vendor-tracker`, {
              vendorId: form.vendorId,
              poNumber: form.poNumber,
              promisedDate: form.promisedDate || undefined,
            });
            setForm({ vendorId: '', poNumber: '', promisedDate: '' });
          })
        }
        fields={
          <>
            <Field label="Vendor">
              <select
                className={inputClass}
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                required
              >
                <option value="">Select vendor…</option>
                {vendors.map((vendor) => (
                  <option key={vendor._id} value={vendor._id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PO number">
              <input
                className={inputClass}
                value={form.poNumber}
                onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
              />
            </Field>
            <Field label="Promised date">
              <input
                type="date"
                className={inputClass}
                value={form.promisedDate}
                onChange={(e) => setForm({ ...form, promisedDate: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
}

/* documents tab ---------------------------------------------------------- */

interface DocumentRow {
  _id: string;
  docNo: string;
  fileName: string;
  docType: string;
  revision: number;
  status: string;
  retentionUpto: string;
}

function DocumentsTab() {
  const list = useRegisterList<DocumentRow>('documents');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    docNo: '',
    fileName: '',
    docType: 'other',
    accessRoles: '',
    retentionUpto: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<DocumentRow>[] = [
    {
      header: 'Doc no',
      render: (row) => <span className="font-medium text-app-strong">{row.docNo}</span>,
    },
    { header: 'File', render: (row) => row.fileName },
    { header: 'Type', render: (row) => titleCase(row.docType) },
    { header: 'Rev', render: (row) => `00${row.revision ?? 1}`.slice(-2) },
    { header: 'Status', render: (row) => <StatusPill value={row.status} /> },
    {
      header: '',
      render: (row) =>
        row.status === 'current' ? (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await api.post(`${BASE}/documents/acknowledge`, { docId: row._id });
              })
            }
            className="btn-small"
          >
            Acknowledge
          </button>
        ) : (
          <span className="text-xs text-app-faint">Read-only</span>
        ),
    },
  ];

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Document
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Approved document"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/documents`, {
              docNo: form.docNo,
              fileName: form.fileName,
              docType: form.docType,
              accessRoles: form.accessRoles
                .split(',')
                .map((role) => role.trim())
                .filter(Boolean),
              retentionUpto: form.retentionUpto || undefined,
            });
            setForm({
              docNo: '',
              fileName: '',
              docType: 'other',
              accessRoles: '',
              retentionUpto: '',
            });
          })
        }
        fields={
          <>
            <Field label="Doc no">
              <input
                className={inputClass}
                value={form.docNo}
                onChange={(e) => setForm({ ...form, docNo: e.target.value })}
                required
              />
            </Field>
            <Field label="File name">
              <input
                className={inputClass}
                value={form.fileName}
                onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <select
                className={inputClass}
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value })}
              >
                <option value="other">Other</option>
                <option value="gst_sale">GST sale</option>
                <option value="gst_purchase">GST purchase</option>
              </select>
            </Field>
            <Field label="Access roles (comma separated)">
              <input
                className={inputClass}
                value={form.accessRoles}
                onChange={(e) => setForm({ ...form, accessRoles: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}

/* attendance tab --------------------------------------------------------- */

interface AttendanceRow {
  _id: string;
  userId: { name?: string; _id?: string } | string;
  date: string;
  status: string;
  inTime: string;
  outTime: string;
}

export function AttendanceTab() {
  const list = useRegisterList<AttendanceRow>('attendance');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    status: 'present',
    inTime: '09:00',
    outTime: '18:00',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staff = useList<{ _id: string; name: string; role: string }>('/api/v1/users', {}, 1, 100);

  const columns: Column<AttendanceRow>[] = [
    {
      header: 'Staff',
      render: (row) =>
        typeof row.userId === 'object' && row.userId !== null
          ? (row.userId.name ?? String(row.userId._id))
          : row.userId,
    },
    { header: 'Date', render: (row) => row.date },
    { header: 'Status', render: (row) => <StatusPill value={row.status} /> },
    { header: 'In', render: (row) => row.inTime || '—' },
    { header: 'Out', render: (row) => row.outTime || '—' },
  ];

  async function run(runner: () => Promise<void>) {
    setBusy(true);
    try {
      await runner();
      setError(null);
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary mb-3"
      >
        + Attendance
      </button>
      <Err error={list.error ?? error} />
      <DataTable rows={list.rows} rowKey={(row) => row._id} columns={columns} />
      <Modal
        title="Attendance"
        open={open}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={() =>
          void run(async () => {
            await api.post(`${BASE}/attendance`, form);
            setForm({ userId: '', status: 'present', inTime: '09:00', outTime: '18:00' });
          })
        }
        fields={
          <>
            <Field label="Staff">
              <select
                className={inputClass}
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {staff.rows.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
                <option value="half_day">Half day</option>
              </select>
            </Field>
            <Field label="In time">
              <input
                className={inputClass}
                value={form.inTime}
                onChange={(e) => setForm({ ...form, inTime: e.target.value })}
              />
            </Field>
            <Field label="Out time">
              <input
                className={inputClass}
                value={form.outTime}
                onChange={(e) => setForm({ ...form, outTime: e.target.value })}
              />
            </Field>
          </>
        }
      />
    </>
  );
}
