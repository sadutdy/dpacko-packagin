import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDelete, Field, ModalForm, inputClass } from '../../components/Modal.js';
import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSearch, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { rupees, shortDate, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';

interface InvoiceRow {
  _id: string;
  invoiceNumber: string;
  orderId: string | null;
  paymentIds?: string[];
  items: { description: string; name?: string; qty: number; taxRate: number }[];
  grandTotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  amountInWords?: string;
  status: string;
  issuedAt?: string | null;
  dueDate?: string | null;
}

interface OrderOption { _id: string; orderNumber: string; status: string }

const STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'credited'];

type ModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; row: InvoiceRow }
  | { mode: 'delete'; row: InvoiceRow };

const EDITOR_STATUSES = ['unpaid', 'overdue', 'cancelled'];

export function InvoicesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { rows, meta, loading, error, reload } = useList<InvoiceRow>('/api/v1/payments/invoices', { status: status || undefined }, page, limit);
  const { rows: orderOptions } = useList<OrderOption>('/api/v1/orders', {}, 1, 200);
  const byId = new Map(orderOptions.map((order) => [order._id, order]));

  // Orders that can still be invoiced: not closed/cancelled and (best-effort)
  // those without an invoice yet. The API is idempotent, so re-picking an
  // invoiced order simply returns the existing invoice.
  const invoiceableOrders = orderOptions.filter((order) => !['delivered', 'closed', 'cancelled'].includes(order.status));

  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState('');
  const [editStatus, setEditStatus] = useState('unpaid');
  const [dueDate, setDueDate] = useState('');

  const visibleRows = search
    ? rows.filter((row) => {
        const order = byId.get(String(row.orderId));
        return (
          row.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          (order?.orderNumber.toLowerCase().includes(search.toLowerCase()) ?? false)
        );
      })
    : rows;

  async function createInvoice() {
    setBusy(true);
    setModalError(null);
    try {
      const invoice = await api.post<{ _id: string }>('/api/v1/payments/invoices', { orderId });
      setModal(null);
      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function updateInvoice(row: InvoiceRow, patch: Record<string, unknown>) {
    setBusy(true);
    setModalError(null);
    try {
      await api.patch(`/api/v1/payments/invoices/${row._id}`, patch);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvoice(row: InvoiceRow) {
    setBusy(true);
    setModalError(null);
    try {
      await api.del(`/api/v1/payments/invoices/${row._id}`);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<InvoiceRow>[] = [
    { header: 'Invoice', render: (row) => <span className="font-medium text-app-strong">{row.invoiceNumber}</span> },
    { header: 'Order', render: (row) => (row.orderId ? byId.get(String(row.orderId))?.orderNumber ?? '—' : 'Direct') },
    { header: 'Items', render: (row) => row.items.map((item) => item.name || item.description).join(', ') },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Total', render: (row) => rupees(row.grandTotalPaise) },
    { header: 'Tax', render: (row) => rupees(row.cgstPaise + row.sgstPaise + row.igstPaise) },
    { header: 'Issued', render: (row) => shortDate(row.issuedAt) },
    { header: 'Due', render: (row) => shortDate(row.dueDate) },
    {
      header: '',
      render: (row) => (
        // Row clicks open the invoice; the actions keep their own clicks.
        <span className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/invoices/${row._id}/edit`)}
            disabled={!EDITOR_STATUSES.includes(row.status) || (row.paymentIds?.length ?? 0) > 0}
            title={EDITOR_STATUSES.includes(row.status) ? 'Edit invoice' : 'Invoices with payments cannot be edited'}
            className="btn-small disabled:cursor-not-allowed disabled:opacity-40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setEditStatus(row.status); setDueDate(row.dueDate ? row.dueDate.slice(0, 10) : ''); setModalError(null); setModal({ mode: 'edit', row }); }}
            className="btn-small"
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => { setModalError(null); setModal({ mode: 'delete', row }); }}
            disabled={row.status === 'paid' || row.status === 'partial'}
            title={row.status === 'paid' || row.status === 'partial' ? 'Paid invoices cannot be deleted' : 'Delete invoice'}
            className="btn-small-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Invoices</h2>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => { setOrderId(''); setModalError(null); setModal({ mode: 'create' }); }}
            className="btn-secondary"
          >
            From order…
          </button>
          <button type="button" onClick={() => navigate('/invoices/new')} className="btn-primary">
            + New invoice
          </button>
        </span>
      </div>
      <FilterBar>
        <FilterSearch value={search} onChange={(value) => setSearch(value)} placeholder="Invoice or order no…" />
        <FilterSelect
          label="Status"
          value={status}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? (
        <p className="text-app-muted">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleRows}
          rowKey={(row) => row._id}
          onRowClick={(row) => navigate(`/invoices/${row._id}`)}
          rowLabel={(row) => `Open invoice ${row.invoiceNumber}`}
        />
      )}
      {!loading && !error && visibleRows.length === 0 && <p className="text-app-muted">No invoices.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />

      {modal?.mode === 'create' && (
        <ModalForm title="Invoice an order" busy={busy} error={modalError} submitLabel="Create invoice" onSubmit={createInvoice} onCancel={() => setModal(null)}>
          <Field label="Order">
            <select className={inputClass} value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
              <option value="">Select order…</option>
              {invoiceableOrders.map((order) => (
                <option key={order._id} value={order._id}>{order.orderNumber} ({titleCase(order.status)})</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-app-muted">An invoice is cut from the order's items and pricing. Invoicing the same order twice returns the existing invoice.</p>
        </ModalForm>
      )}

      {modal?.mode === 'edit' && (
        <ModalForm
          title={`Status · ${modal.row.invoiceNumber}`}
          busy={busy}
          error={modalError}
          submitLabel="Save changes"
          onSubmit={() => updateInvoice(modal.row, {
            status: editStatus,
            ...(dueDate ? { dueDate } : {}),
          })}
          onCancel={() => setModal(null)}
        >
          <Field label="Status">
            <select className={inputClass} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </ModalForm>
      )}

      {modal?.mode === 'delete' && (
        <ConfirmDelete
          title={`Delete ${modal.row.invoiceNumber}`}
          message="The invoice is removed permanently. Paid or partially-paid invoices cannot be deleted."
          busy={busy}
          error={modalError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteInvoice(modal.row)}
        />
      )}
    </div>
  );
}
