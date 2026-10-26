import type { ReactNode } from 'react';

/** Label + control + inline error/hint, matching the app's form styling. */
export function FormField(props: { label: string; error?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${props.className ?? ''}`}>
      <span className="section-label mb-1 block">{props.label}</span>
      {props.children}
      {props.error ? (
        <span className="mt-1 block text-xs text-app-danger-text">{props.error}</span>
      ) : (
        props.hint && <span className="mt-1 block text-xs text-app-faint">{props.hint}</span>
      )}
    </label>
  );
}

/** Small pill button for quick picks (dates, presets). */
export function Chip(props: { onClick: () => void; children: ReactNode; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        props.active
          ? 'border-app-accent bg-app-accent text-white'
          : 'border-app-border bg-app-surface text-app-text hover:bg-app-subtle'
      }`}
    >
      {props.children}
    </button>
  );
}
