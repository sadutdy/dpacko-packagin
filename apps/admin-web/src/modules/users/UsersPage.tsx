import { useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSearch, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { titleCase } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';

interface PublicUser {
  id?: string;
  _id?: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  createdAt?: string;
}

const ROLES = ['admin', 'production', 'inventory', 'dispatcher', 'driver', 'finance'];
const STATUSES = ['active', 'invited', 'suspended', 'archived'];

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const { rows, meta, loading, error } = useList<PublicUser>(
    '/api/v1/users',
    { search: search || undefined, role: role || undefined, status: status || undefined },
    page,
    limit,
  );

  const columns: Column<PublicUser>[] = [
    { header: 'Name', render: (row) => <span className="font-medium text-app-strong">{row.name}</span> },
    { header: 'Phone', render: (row) => row.phone },
    { header: 'Role', render: (row) => <span className="capitalize">{row.role}</span> },
    { header: 'Status', render: (row) => <span className="capitalize">{row.status}</span> },
    { header: 'Joined', render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '—') },
  ];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Users</h2>
      <FilterBar>
        <FilterSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Name or phone…" />
        <FilterSelect
          label="Role"
          value={role}
          options={ROLES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setRole(value); setPage(1); }}
        />
        <FilterSelect
          label="Status"
          value={status}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
      </FilterBar>
      {error && <p className="text-app-danger-text">{error}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={rows} rowKey={(row) => row.id ?? row._id ?? row.phone} />}
      {!loading && !error && rows.length === 0 && <p className="text-app-muted">No users.</p>}
      <PaginationBar meta={meta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />
    </div>
  );
}
