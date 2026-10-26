import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { api } from '../../lib/api.js';
import { rupees } from '../../lib/format.js';

interface ReportRow {
  materialCode: string;
  name: string;
  unit: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  isLow: boolean;
}

export function ReportsPage() {
  const [today, setToday] = useState<{ ordersPlaced: number; revenueTodayPaise: number }>({ ordersPlaced: 0, revenueTodayPaise: 0 });
  const [revenueByMonth, setRevenueByMonth] = useState<{ year: number; month: number; revenuePaise: number; orders: number }[]>([]);
  const [statuses, setStatuses] = useState<Record<string, number>>({});
  const [lowStock, setLowStock] = useState<ReportRow[]>([]);
  const [receivables, setReceivables] = useState<{ total: number }>({ total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.get<{ today: { ordersPlaced: number; revenueTodayPaise: number }; revenueByMonth: { year: number; month: number; revenuePaise: number; orders: number }[]; orderStatuses: { status: string; count: number }[]; lowStock: ReportRow[] }>('/api/v1/reports/dashboard'),
      api.get<{ total: number }>('/api/v1/payments/receivables'),
    ])
      .then(([dash, rec]) => {
        setToday(dash.today ?? { ordersPlaced: 0, revenueTodayPaise: 0 });
        setRevenueByMonth(Array.isArray(dash.revenueByMonth) ? dash.revenueByMonth : []);
        const map: Record<string, number> = {};
        for (const row of Array.isArray(dash.orderStatuses) ? dash.orderStatuses : []) map[row.status] = row.count;
        setStatuses(map);
        setLowStock(dash.lowStock ?? []);
        setReceivables(rec);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  const columns: Column<ReportRow>[] = [
    { header: 'Material', render: (row) => <span className="font-medium text-app-strong">{row.name}</span> },
    { header: 'Code', render: (row) => row.materialCode },
    { header: 'On hand', render: (row) => `${row.onHand} ${row.unit}` },
    { header: 'Available', render: (row) => row.available },
    { header: 'Reorder point', render: (row) => row.reorderPoint },
    { header: 'Suggested order', render: (row) => row.reorderQuantity },
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Reports</h2>
      {error && <p className="text-app-danger-text">{error}</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Orders today" value={String(today.ordersPlaced)} />
        <Stat label="Revenue today" value={rupees(today.revenueTodayPaise)} />
        <Stat label="Receivables" value={rupees(receivables.total)} accent />
        <Stat label="Low stock materials" value={String(lowStock.length)} accent={lowStock.length > 0} />
      </div>

      <div className="mb-6 rounded-lg bg-app-surface p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-app-text">Order statuses</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statuses).map(([statusText, count]) => (
            <span key={statusText} className="flex items-center gap-1.5 rounded-md bg-app-subtle px-3 py-1.5 text-sm">
              <StatusBadge status={statusText} /> <span className="font-semibold">{count}</span>
            </span>
          ))}
          {Object.keys(statuses).length === 0 && <span className="text-app-faint">No orders.</span>}
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-app-surface p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-app-text">Revenue by month (last 3 months)</h3>
        <div className="flex gap-6">
          {revenueByMonth.slice(0, 3).map((month) => (
            <div key={`${month.year}-${month.month}`} className="rounded-md bg-app-subtle px-4 py-3">
              <div className="text-xs text-app-muted">
                {months[month.month - 1]} {month.year} · {month.orders} orders
              </div>
              <div className="mt-1 text-xl font-bold">{rupees(month.revenuePaise)}</div>
            </div>
          ))}
          {revenueByMonth.length === 0 && <span className="text-app-faint">No data.</span>}
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-app-text">Low stock</h3>
      <DataTable columns={columns} rows={lowStock} rowKey={(row) => row.materialCode} />
      {lowStock.length === 0 && <p className="text-app-muted">Everything above reorder point.</p>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg bg-app-surface p-6 shadow-sm ${accent ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="text-sm text-app-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
