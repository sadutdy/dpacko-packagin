import { useEffect, useState } from 'react';

import { DataTable, type Column } from '../../components/DataTable.js';
import { FilterBar, FilterSelect, PaginationBar } from '../../components/Pagination.js';
import { api } from '../../lib/api.js';
import { rupees } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';

interface Material {
  _id: string;
  materialCode: string;
  name: string;
  unit: string;
  reorderPoint: number;
}

interface StockRow {
  _id: string;
  materialId: string;
  location: string;
  onHand: number;
  reserved: number;
  available: number;
  averageCostPaise: number;
}

export function InventoryPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [materialId, setMaterialId] = useState('');
  const [location, setLocation] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);

  // Stock rows are fetched in one shot (small dataset) then filtered and
  // paged client-side — the endpoint has no page/limit yet.
  const { rows: allRows, loading, error: listError } = useList<StockRow>('/api/v1/inventory/stock', {}, 1, 200);
  const [pageRows, setPageRows] = useState<StockRow[]>([]);

  useEffect(() => {
    api
      .list<Material>('/api/v1/inventory/materials?limit=100')
      .then((data) => setMaterials(data))
      .catch(() => setMaterials([]));
  }, []);

  useEffect(() => {
    const filtered = allRows.filter((row) =>
      (!materialId || String(row.materialId) === materialId) && (!location || row.location === location),
    );
    setPageRows(filtered.slice((page - 1) * limit, page * limit));
  }, [allRows, materialId, location, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [materialId, location]);

  const byId = new Map(materials.map((material) => [material._id, material]));
  const locations = [...new Set(['STORE-1', 'STORE-2', ...allRows.map((row) => row.location)])];
  const totalCount = allRows.filter((row) =>
    (!materialId || String(row.materialId) === materialId) && (!location || row.location === location),
  ).length;
  const clientMeta = page === 1 && allRows.length <= limit
    ? undefined
    : {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      };

  const columns: Column<StockRow>[] = [
    {
      header: 'Material',
      render: (row) => {
        const material = byId.get(String(row.materialId));
        return (
          <span>
            <span className="font-medium text-app-strong">{material?.name ?? '—'}</span>
            <span className="ml-2 text-xs text-app-faint">{material?.materialCode}</span>
          </span>
        );
      },
    },
    { header: 'Location', render: (row) => row.location },
    { header: 'On hand', render: (row) => `${row.onHand} ${byId.get(String(row.materialId))?.unit ?? ''}` },
    { header: 'Reserved', render: (row) => row.reserved },
    { header: 'Available', render: (row) => row.available },
    { header: 'Avg cost', render: (row) => rupees(row.averageCostPaise) },
    {
      header: 'Reorder',
      render: (row) => {
        const material = byId.get(String(row.materialId));
        if (!material) return <span className="text-app-faint">OK</span>;
        return row.onHand <= material.reorderPoint ? (
          <span className="pill pill-problem">Low</span>
        ) : (
          <span className="text-app-faint">OK</span>
        );
      },
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Inventory</h2>
      <FilterBar>
        <FilterSelect
          label="Material"
          value={materialId}
          options={materials.map((material) => ({ value: material._id, label: `${material.name}` }))}
          onChange={setMaterialId}
        />
        <FilterSelect
          label="Location"
          value={location}
          options={locations.map((value) => ({ value, label: value }))}
          onChange={setLocation}
        />
      </FilterBar>
      {listError && <p className="text-app-danger-text">{listError}</p>}
      {loading ? <p className="text-app-muted">Loading…</p> : <DataTable columns={columns} rows={pageRows} rowKey={(row) => row._id} />}
      {!loading && !listError && pageRows.length === 0 && <p className="text-app-muted">No stock.</p>}
      <PaginationBar meta={clientMeta} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />
    </div>
  );
}
