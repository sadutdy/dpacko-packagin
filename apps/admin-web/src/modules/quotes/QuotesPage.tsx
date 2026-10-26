import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDelete } from '../../components/Modal.js';
import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { rupees, shortDate, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';

interface QuoteRow {
  _id: string;
  quoteNumber: string;
  customerId: string;
  items: { name: string; skuCode: string; quantity: number }[];
  pricing?: { grandTotalPaise?: number };
  status: string;
  validUntil?: string | null;
  createdAt: string;
}

interface CustomerOption { _id: string; businessName: string }

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

type ModalState = null | { mode: 'delete'; row: QuoteRow };

export function QuotesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState('');

  const { rows, meta, loading, error, reload } = useList<QuoteRow>(
    '/api/v1/orders/quotes',
    { status: status || undefined },
    page,
    limit,
  );
  const { rows: customerOptions } = useList<CustomerOption>('/api/v1/crm/customers', {}, 1, 100);
  const byId = new Map(customerOptions.map((customer) => [customer._id, customer]));

  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function deleteQuote(row: QuoteRow) {
    setBusy(true);
    setModalError(null);
    try {
      await api.del(`/api/v1/orders/quotes/${row._id}`);
      setModal(null);
      reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<QuoteRow>[] = [
    { header: 'Quote', render: (row) => <span className="font-medium text-app-strong">{row.quoteNumber}</span> },
    { header: 'Customer', render: (row) => byId.get(String(row.customerId))?.businessName ?? '—' },
    { header: 'Products', render: (row) => row.items.map((item) => `${item.name} ×${item.quantity}`).join(', ') },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Total', render: (row) => rupees(row.pricing?.grandTotalPaise) },
    { header: 'Valid until', render: (row) => shortDate(row.validUntil) },
    { header: 'Created', render: (row) => shortDate(row.createdAt) },
    {
      header: '',
      render: (row) =>
        row.status === 'converted' ? null : (
          // Row clicks open the document; the actions keep their own clicks.
          <span className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => navigate(`/quotes/${row._id}/edit`)}
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
        <h2 className="text-2xl font-bold">Quotes</h2>
        <button
          type="button"
          onClick={() => navigate('/quotes/new')}
          className="btn-primary"
        >
          + New quote
        </button>
      </div>
      <FilterBar>
        <FilterSelect
          label="Status"
          value={status}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row._id}
          onRowClick={(row) => navigate(`/quotes/${row._id}`)}
          rowLabel={(row) => `Open quote ${row.quoteNumber}`}
        />
      )}
      {!loading && !error && rows.length === 0 && <p className="text-app-muted">No quotes.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />

      {modal?.mode === 'delete' && (
        <ConfirmDelete
          title={`Delete ${modal.row.quoteNumber}`}
          message="The quote is removed permanently. Converted quotes cannot be deleted."
          busy={busy}
          error={modalError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteQuote(modal.row)}
        />
      )}
    </div>
  );
}
