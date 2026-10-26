import type { PageMeta } from '../lib/api.js';

const LIMITS = [10, 25, 50];

export function PaginationBar(props: {
  meta?: PageMeta;
  page: number;
  limit: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}) {
  const { meta, page, limit, onPage, onLimit } = props;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-app-muted">
        {meta ? `${meta.page} / ${meta.totalPages} · ${meta.total} total` : page}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={limit}
          onChange={(e) => {
            onLimit(Number(e.target.value));
            onPage(1);
          }}
          className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-app-text"
          aria-label="Rows per page"
        >
          {LIMITS.map((value) => (
            <option key={value} value={value}>
              {value} / page
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="btn-secondary px-3"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={meta ? !meta.hasNext : true}
          onClick={() => onPage(page + 1)}
          className="btn-secondary px-3"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Standard filter row: resets to page 1 whenever a filter changes. */
export function FilterBar(props: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{props.children}</div>;
}

export function FilterSelect(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-app-muted">
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm capitalize text-app-text"
        aria-label={props.label}
      >
        <option value="">All</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterSearch(props: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
      <input
        type="search"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? 'Search…'}
        aria-label={props.placeholder ?? 'Search'}
        className="w-56 rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-sm text-app-text"
      />
  );
}

export function FilterDate(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-app-muted">
      {props.label}
        <input
          type="date"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm text-app-text"
        />
    </label>
  );
}
