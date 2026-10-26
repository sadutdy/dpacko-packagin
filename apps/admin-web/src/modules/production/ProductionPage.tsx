import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { api } from '../../lib/api.js';
import { titleCase } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';

interface JobRow {
  _id: string;
  jobNumber: string;
  orderNumber: string;
  stage: string;
  items: { skuCode: string; quantity: number; completedQty: number }[];
  priority?: number;
  scheduledDate?: string | null;
}

interface StageCount {
  stage: string;
  count: number;
}

const STAGES = ['queued', 'received', 'cutting', 'creasing', 'assembly', 'printing', 'qc', 'labelling', 'packing', 'ready'];

export function ProductionPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [stage, setStage] = useState('');
  const [counts, setCounts] = useState<StageCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { rows, meta, loading, error: listError } = useList<JobRow>(
    '/api/v1/production/jobs',
    { stage: stage || undefined },
    page,
    limit,
  );

  useEffect(() => {
    api
      .list<StageCount>('/api/v1/production/jobs/counts')
      .then((data) => setCounts(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  const columns: Column<JobRow>[] = [
    { header: 'Job', render: (row) => <span className="font-medium text-app-strong">{row.jobNumber}</span> },
    { header: 'Order', render: (row) => row.orderNumber },
    { header: 'Products', render: (row) => row.items.map((item) => `${item.skuCode} ×${item.quantity}`).join(', ') },
    { header: 'Stage', render: (row) => <StatusBadge status={row.stage} /> },
    { header: 'Scheduled', render: (row) => (row.scheduledDate ? new Date(row.scheduledDate).toLocaleDateString('en-IN') : '—') },
  ];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Production</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map((count) => (
          <button
            key={count.stage}
            type="button"
            onClick={() => { setStage(stage === count.stage ? '' : count.stage); setPage(1); }}
            className={`rounded-md px-3 py-2 text-sm shadow-sm ${stage === count.stage ? 'bg-app-nav text-white' : 'bg-app-surface hover:bg-app-subtle'}`}
          >
            <span className="font-semibold">{count.count}</span> <span className={stage === count.stage ? '' : 'text-app-muted'}>{titleCase(count.stage)}</span>
          </button>
        ))}
      </div>
      <FilterBar>
        <FilterSelect
          label="Stage"
          value={stage}
          options={STAGES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStage(value); setPage(1); }}
        />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {listError && <p className="text-app-danger-text">{listError}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={rows} rowKey={(row) => row._id} />}
      {!loading && rows.length === 0 && <p className="text-app-muted">No jobs.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />
    </div>
  );
}
