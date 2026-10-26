import type { KeyboardEvent, ReactNode } from 'react';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>(props: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes rows clickable and keyboard-focusable (Enter opens). */
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
}) {
  const { columns, rows, rowKey, onRowClick, rowLabel } = props;

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-app-border">
        <thead className="bg-app-subtle">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-muted">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border-soft">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              {...(onRowClick && {
                tabIndex: 0,
                'aria-label': rowLabel?.(row),
                className: 'cursor-pointer transition-colors hover:bg-app-subtle focus-visible:bg-app-subtle',
                onClick: () => onRowClick(row),
                onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                  // Only the row itself: Enter on an inner button must not open it.
                  if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick(row);
                },
              })}
            >
              {columns.map((column) => (
                <td key={column.header} className="px-4 py-2 text-sm text-app-text">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
