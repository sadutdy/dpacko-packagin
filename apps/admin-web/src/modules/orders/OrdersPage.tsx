import { useState } from 'react';

import { ConfirmDelete, Field, ModalForm, inputClass } from '../../components/Modal.js';
import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterDate, FilterSearch, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { rupees, shortDate, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';

interface OrderRow {
  _id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  items: { skuId: string; name: string; quantity: number }[];
  pricing?: { grandTotalPaise?: number };
  notes?: string;
  payment?: { method?: string; status?: string };
  requestedDeliveryDate?: string | null;
  createdAt: string;
}

interface CustomerOption { _id: string; businessName: string }
interface SkuOption { _id: string; name: string; skuCode: string }

const STATUSES = ['placed', 'payment_pending', 'paid', 'planned', 'in_production', 'qc', 'ready', 'dispatched', 'delivered', 'closed', 'on_hold', 'cancelled'];
const PAYMENT_METHODS = ['cod', 'credit', 'razorpay'];

type ModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; row: OrderRow }
  | { mode: 'delete'; row: OrderRow };

function toDateInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { rows, meta, loading, error, reload } = useList<OrderRow>(
    '/api/v1/orders',
    { search: search || undefined, status: status || undefined, from: from || undefined, to: to || undefined },
    page,
    limit,
  );

  const { rows: customerOptions } = useList<CustomerOption>('/api/v1/crm/customers', {}, 1, 100);
  const { rows: skuOptions } = useList<SkuOption>('/api/v1/catalog/skus', {}, 1, 100);

  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Create form state
  const [customerId, setCustomerId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState('500');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  async function createOrder() {
    setBusy(true);
    setModalError(null);
    try {
      await api.post('/api/v1/orders', {
        customerId,
        items: [{ skuId, quantity: Number(quantity) }],
        paymentMethod,
        notes,
        ...(deliveryDate ? { requestedDeliveryDate: deliveryDate } : {}),
      });
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function updateOrder(row: OrderRow, patch: Record<string, unknown>) {
    setBusy(true);
    setModalError(null);
    try {
      await api.patch(`/api/v1/orders/${row._id}`, patch);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder(row: OrderRow) {
    setBusy(true);
    setModalError(null);
    try {
      await api.del(`/api/v1/orders/${row._id}`);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<OrderRow>[] = [
    { header: 'Order', render: (row) => <span className="font-medium text-app-strong">{row.orderNumber}</span> },
    { header: 'Products', render: (row) => row.items.map((item) => `${item.name} ×${item.quantity}`).join(', ') || '—' },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Payment', render: (row) => titleCase(row.payment?.method) },
    { header: 'Total', render: (row) => rupees(row.pricing?.grandTotalPaise) },
    { header: 'Placed', render: (row) => shortDate(row.createdAt) },
    {
      header: '',
      render: (row) => (
        <span className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setNotes(row.notes ?? ''); setDeliveryDate(toDateInput(row.requestedDeliveryDate)); setModalError(null); setModal({ mode: 'edit', row }); }}
            className="btn-small"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setModalError(null); setModal({ mode: 'delete', row }); }}
            className="btn-small-danger"
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
        <h2 className="text-2xl font-bold">Orders</h2>
        <button
          type="button"
          onClick={() => { setCustomerId(''); setSkuId(''); setQuantity('500'); setPaymentMethod('cod'); setNotes(''); setDeliveryDate(''); setModalError(null); setModal({ mode: 'create' }); }}
          className="btn-primary"
        >
          + New order
        </button>
      </div>
      <FilterBar>
        <FilterSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Order no…" />
        <FilterSelect
          label="Status"
          value={status}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
        <FilterDate label="From" value={from} onChange={(value) => { setFrom(value); setPage(1); }} />
        <FilterDate label="To" value={to} onChange={(value) => { setTo(value); setPage(1); }} />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={rows} rowKey={(row) => row._id} />}
      {!loading && !error && rows.length === 0 && <p className="text-app-muted">No orders.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />

      {modal?.mode === 'create' && (
        <ModalForm title="New order" busy={busy} error={modalError} submitLabel="Create order" onSubmit={createOrder} onCancel={() => setModal(null)}>
          <Field label="Customer">
            <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer…</option>
              {customerOptions.map((customer) => (
                <option key={customer._id} value={customer._id}>{customer.businessName}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Product">
                <select className={inputClass} value={skuId} onChange={(e) => setSkuId(e.target.value)} required>
                  <option value="">Select SKU…</option>
                  {skuOptions.map((sku) => (
                    <option key={sku._id} value={sku._id}>{sku.name} ({sku.skuCode})</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Quantity">
              <input className={inputClass} type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment method">
              <select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>{PaymentMethodLabels[value] ?? titleCase(value)}</option>
                ))}
              </select>
            </Field>
            <Field label="Requested delivery">
              <input className={inputClass} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </ModalForm>
      )}

      {modal?.mode === 'edit' && (
        <ModalForm
          title={`Edit ${modal.row.orderNumber}`}
          busy={busy}
          error={modalError}
          submitLabel="Save changes"
          onSubmit={() => updateOrder(modal.row, {
            notes,
            ...(deliveryDate ? { requestedDeliveryDate: deliveryDate } : {}),
          })}
          onCancel={() => setModal(null)}
        >
          <p className="mb-3 text-xs text-app-muted">Status changes go through the production pipeline; only notes and delivery date can be edited here.</p>
          <Field label="Notes">
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Requested delivery">
            <input className={inputClass} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
        </ModalForm>
      )}

      {modal?.mode === 'delete' && (
        <ConfirmDelete
          title={`Delete ${modal.row.orderNumber}`}
          message="The order is cancelled (not erased) so its history stays intact. Inventoried material is released."
          busy={busy}
          error={modalError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteOrder(modal.row)}
        />
      )}
    </div>
  );
}

const PaymentMethodLabels: Record<string, string> = {
  cod: 'Cash on delivery',
  credit: 'On credit',
  razorpay: 'Razorpay (online)',
};
