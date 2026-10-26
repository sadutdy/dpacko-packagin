import { useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterDate, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { rupees, shortDate, titleCase } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';

interface DeliveryRow {
  _id: string;
  deliveryNumber: string;
  status: string;
  orderId?: unknown;
  address?: { line1?: string; city?: string };
  driverId?: unknown;
  plannedAt?: string | null;
  deliveredAt?: string | null;
}

interface OrderRow {
  _id: string;
  orderNumber: string;
  pricing?: { grandTotalPaise?: number };
  payment?: { method?: string };
}

const STATUSES = ['unassigned', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'rescheduled', 'returned'];

export function DeliveryPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');

  // Light-weight order lookup for orderNumber/COD amounts on the current page.
  const { rows: searchRows } = useList<OrderRow>('/api/v1/orders', { status: 'delivered' }, 1, 200);
  const byId = new Map(searchRows.map((order) => [order._id, order]));

  const { rows, meta, loading, error } = useList<DeliveryRow>(
    '/api/v1/delivery/deliveries',
    { status: status || undefined, date: date || undefined },
    page,
    limit,
  );

  const columns: Column<DeliveryRow>[] = [
    { header: 'Delivery', render: (row) => <span className="font-medium text-app-strong">{row.deliveryNumber}</span> },
    { header: 'Order', render: (row) => byId.get(String(row.orderId))?.orderNumber ?? '—' },
    {
      header: 'COD amount',
      render: (row) => {
        const order = byId.get(String(row.orderId));
        return order?.payment?.method === 'cod' ? rupees(order.pricing?.grandTotalPaise) : '—';
      },
    },
    { header: 'Destination', render: (row) => [row.address?.line1, row.address?.city].filter(Boolean).join(', ') || '—' },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Planned', render: (row) => shortDate(row.plannedAt) },
    { header: 'Delivered', render: (row) => shortDate(row.deliveredAt) },
  ];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Delivery</h2>
      <FilterBar>
        <FilterSelect
          label="Status"
          value={status}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
        <FilterDate label="On date" value={date} onChange={(value) => { setDate(value); setPage(1); }} />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={rows} rowKey={(row) => row._id} />}
      {!loading && !error && rows.length === 0 && <p className="text-app-muted">No deliveries.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />
    </div>
  );
}
