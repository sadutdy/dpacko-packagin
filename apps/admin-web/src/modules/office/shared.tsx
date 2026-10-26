import type { ReactNode } from 'react';

import { statusPillClass } from '../../components/StatusBadge.js';

/** Section heading used consistently across the office pages. */
export function PageHeading(props: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { title, subtitle, actions } = props;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-app-strong">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-app-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export interface Tab {
  key: string;
  label: string;
}

export function TabBar(props: { tabs: Tab[]; active: string; onChange: (key: string) => void }) {
  const { tabs, active, onChange } = props;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === tab.key
              ? 'bg-app-accent text-white'
              : 'bg-app-subtle text-app-text hover:bg-app-border'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Tone-coded status pill with a readable fallback. */
export function StatusPill(props: { value?: string | null }) {
  const { value } = props;
  if (!value) return <span className="text-app-faint">—</span>;
  return <span className={`pill ${statusPillClass(value)}`}>{value.replaceAll('_', ' ')}</span>;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

export function dayToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Table cell for object id-ish values — truncates; ids remain copyable. */
export function CellTd(props: { children: ReactNode }) {
  return <span className="block max-w-[16rem] truncate">{props.children}</span>;
}
