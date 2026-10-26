import { useEffect, useState } from 'react';

import { api } from '../../lib/api.js';
import { useAuth } from '../../app/auth/AuthContext.js';
import { rupees } from '../../lib/format.js';

interface DashboardData {
  today: { ordersPlaced: number; revenueTodayPaise: number };
  workInProgress?: number;
  lowStockCount?: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReadReports = Boolean(user?.permissions.includes('reports:read'));

  useEffect(() => {
    if (!canReadReports) return;
    api
      .get<DashboardData>('/api/v1/reports/dashboard')
      .then((data) => setStats(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [canReadReports]);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Dashboard</h2>
      <p className="mb-6 text-app-muted">Welcome back, {user?.name}.</p>
      {error && <p className="text-app-danger-text">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Orders today" value={stats ? String(stats.today.ordersPlaced) : '—'} />
        <Stat label="Revenue today" value={stats ? rupees(stats.today.revenueTodayPaise) : '—'} />
        <Stat
          label={stats?.lowStockCount ? 'Low stock (needs reorder)' : 'Low stock'}
          accent={Boolean(stats?.lowStockCount)}
          value={stats ? String(stats.lowStockCount ?? 0) : '—'}
        />
      </div>
      {!canReadReports && <p className="mt-4 text-app-faint">Reports are available to finance and admin roles.</p>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg bg-app-surface p-6 shadow-sm ${accent ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="text-sm text-app-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
