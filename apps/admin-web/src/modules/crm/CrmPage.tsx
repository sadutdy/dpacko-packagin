import { useState } from 'react';

import { ConfirmDelete, Field, ModalForm, inputClass } from '../../components/Modal.js';
import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSearch, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { rupees, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';

interface CustomerRow {
  _id: string;
  customerCode: string;
  businessName: string;
  contactName: string;
  phone: string;
  segment: string;
  creditLimit: number;
  paymentTermsDays: number;
  creditUsed: number;
  totalOrderValue: number;
  orderCount: number;
}

interface CustomerFormState {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  segment: string;
  creditLimitRupees: string;
  paymentTermsDays: string;
  addressLine1: string;
  addressCity: string;
  addressPincode: string;
}

const SEGMENTS = ['walk_in', 'small', 'mid', 'large', 'enterprise'];
const EMPTY_FORM: CustomerFormState = {
  businessName: '',
  contactName: '',
  phone: '+91',
  email: '',
  segment: 'small',
  creditLimitRupees: '0',
  paymentTermsDays: '0',
  addressLine1: '',
  addressCity: '',
  addressPincode: '',
};

type ModalState = null | { mode: 'create' } | { mode: 'edit'; row: CustomerRow } | { mode: 'delete'; row: CustomerRow };

function rowToForm(row: CustomerRow): CustomerFormState {
  return {
    businessName: row.businessName,
    contactName: row.contactName,
    phone: row.phone,
    email: '',
    segment: row.segment,
    creditLimitRupees: String(row.creditLimit / 100),
    paymentTermsDays: String(row.paymentTermsDays),
    addressLine1: '',
    addressCity: '',
    addressPincode: '',
  };
}

function formToPayload(form: CustomerFormState): Record<string, unknown> {
  const addresses: Record<string, unknown>[] = [];
  if (form.addressLine1 && form.addressCity && form.addressPincode) {
    addresses.push({ line1: form.addressLine1, city: form.addressCity, pincode: form.addressPincode });
  }
  return {
    businessName: form.businessName,
    contactName: form.contactName,
    phone: form.phone,
    ...(form.email ? { email: form.email } : {}),
    segment: form.segment,
    creditLimit: Math.round(Number(form.creditLimitRupees || 0) * 100),
    paymentTermsDays: Number(form.paymentTermsDays || 0),
    ...(addresses.length ? { addresses } : {}),
  };
}

export function CrmPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');

  const { rows, meta, loading, error, reload } = useList<CustomerRow>(
    '/api/v1/crm/customers',
    { search: search || undefined, segment: segment || undefined },
    page,
    limit,
  );

  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const patchForm = (key: keyof CustomerFormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submitCustomer() {
    setBusy(true);
    setModalError(null);
    try {
      const payload = formToPayload(form);
      if (modal?.mode === 'edit') await api.patch(`/api/v1/crm/customers/${modal.row._id}`, payload);
      else await api.post('/api/v1/crm/customers', payload);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer(row: CustomerRow) {
    setBusy(true);
    setModalError(null);
    try {
      await api.del(`/api/v1/crm/customers/${row._id}`);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<CustomerRow>[] = [
    {
      header: 'Customer',
      render: (row) => (
        <span>
          <span className="font-medium text-app-strong">{row.businessName}</span>
          <span className="ml-2 text-xs text-app-faint">{row.customerCode}</span>
        </span>
      ),
    },
    { header: 'Contact', render: (row) => row.contactName || '—' },
    { header: 'Phone', render: (row) => row.phone },
    { header: 'Segment', render: (row) => titleCase(row.segment) },
    { header: 'Orders', render: (row) => row.orderCount ?? 0 },
    { header: 'Lifetime value', render: (row) => rupees(row.totalOrderValue) },
    {
      header: 'Credit used',
      render: (row) =>
        row.creditLimit > 0 ? (
          <span>
            {rupees(row.creditUsed)}
            <span className="text-xs text-app-faint"> / {rupees(row.creditLimit)}</span>
          </span>
        ) : (
          <span className="text-app-faint">—</span>
        ),
    },
    {
      header: '',
      render: (row) => (
        <span className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setForm(rowToForm(row)); setModalError(null); setModal({ mode: 'edit', row }); }}
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
        <h2 className="text-2xl font-bold">Customers</h2>
        <button
          type="button"
          onClick={() => { setForm(EMPTY_FORM); setModalError(null); setModal({ mode: 'create' }); }}
          className="btn-primary"
        >
          + New customer
        </button>
      </div>
      <FilterBar>
        <FilterSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Business name…" />
        <FilterSelect
          label="Segment"
          value={segment}
          options={SEGMENTS.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setSegment(value); setPage(1); }}
        />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={rows} rowKey={(row) => row._id} />}
      {!loading && !error && rows.length === 0 && <p className="text-app-muted">No customers.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <ModalForm
          title={modal.mode === 'edit' ? `Edit ${modal.row.businessName}` : 'New customer'}
          busy={busy}
          error={modalError}
          onSubmit={submitCustomer}
          onCancel={() => setModal(null)}
        >
          <Field label="Business name">
            <input className={inputClass} value={form.businessName} onChange={(e) => patchForm('businessName')(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact person">
              <input className={inputClass} value={form.contactName} onChange={(e) => patchForm('contactName')(e.target.value)} />
            </Field>
            <Field label="Phone (+E.164)">
              <input className={inputClass} value={form.phone} onChange={(e) => patchForm('phone')(e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email} onChange={(e) => patchForm('email')(e.target.value)} />
            </Field>
            <Field label="Segment">
              <select className={inputClass} value={form.segment} onChange={(e) => patchForm('segment')(e.target.value)}>
                {SEGMENTS.map((value) => (
                  <option key={value} value={value}>{titleCase(value)}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credit limit (₹)">
              <input className={inputClass} type="number" min="0" value={form.creditLimitRupees} onChange={(e) => patchForm('creditLimitRupees')(e.target.value)} />
            </Field>
            <Field label="Payment terms (days)">
              <input className={inputClass} type="number" min="0" value={form.paymentTermsDays} onChange={(e) => patchForm('paymentTermsDays')(e.target.value)} />
            </Field>
          </div>
          {modal.mode === 'create' && (
            <>
              <Field label="Address line 1">
                <input className={inputClass} value={form.addressLine1} onChange={(e) => patchForm('addressLine1')(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputClass} value={form.addressCity} onChange={(e) => patchForm('addressCity')(e.target.value)} />
                </Field>
                <Field label="Pincode">
                  <input className={inputClass} value={form.addressPincode} onChange={(e) => patchForm('addressPincode')(e.target.value)} />
                </Field>
              </div>
            </>
          )}
        </ModalForm>
      )}

      {modal?.mode === 'delete' && (
        <ConfirmDelete
          title={`Delete ${modal.row.businessName}`}
          message={`This permanently removes customer ${modal.row.customerCode}. Customers with orders cannot be deleted.`}
          busy={busy}
          error={modalError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteCustomer(modal.row)}
        />
      )}
    </div>
  );
}
