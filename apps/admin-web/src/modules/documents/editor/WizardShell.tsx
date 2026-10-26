import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Segmented } from '../../../components/Segmented.js';

export interface WizardStep {
  id: string;
  label: string;
  hint: string;
}

interface Props {
  title: string;
  backTo: string;
  backLabel: string;
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
  onSave: () => void;
  banner?: ReactNode;
  steps: WizardStep[];
  stepIndex: number;
  stepValid: (index: number) => boolean;
  onStep: (index: number) => void;
  onNext: () => void;
  error?: string | null;
  /** The current step's form. */
  children: ReactNode;
  previewLabel: ReactNode;
  preview: ReactNode;
}

/**
 * Full-page document editor frame: header with save, step pills, the step
 * form on the left and a live preview on the right (toggle below xl).
 * Owns ⌘S / Ctrl+S and the unsaved-changes guard.
 */
export function WizardShell(props: Props) {
  const { steps, stepIndex, stepValid, onStep, dirty, onSave, saving } = props;
  const [view, setView] = useState<'form' | 'preview'>('form');
  const step = steps[stepIndex] ?? steps[0];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave]);

  const go = (index: number) => {
    setView('form');
    onStep(index);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={props.backTo} className="text-sm text-app-muted hover:text-app-text">
            ← {props.backLabel}
          </Link>
          <h2 className="text-2xl font-bold text-app-strong">{props.title}</h2>
          {dirty && <span className="text-xs text-app-faint">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="xl:hidden">
            <Segmented
              label="Show"
              value={view}
              options={[
                { value: 'form', label: 'Form' },
                { value: 'preview', label: 'Preview' },
              ]}
              onChange={setView}
            />
          </span>
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving} title="⌘S">
            {saving ? 'Saving…' : props.saveLabel}
          </button>
        </div>
      </div>

      {props.banner}

      <ol className="mb-4 flex flex-wrap gap-2" aria-label="Steps">
        {steps.map((entry, index) => {
          const current = index === stepIndex;
          // Forward jumps only past valid steps; going back is always allowed.
          const reachable = index <= stepIndex || steps.slice(0, index).every((_, prior) => stepValid(prior));
          const done = index < stepIndex && stepValid(index);
          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                onClick={() => go(index)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-40 ${
                  current ? 'border-app-accent bg-app-surface text-app-strong' : 'border-app-border text-app-muted hover:bg-app-subtle'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    current || done ? 'bg-app-accent text-white' : 'bg-app-subtle text-app-muted'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                {entry.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <section className={`card p-5 ${view === 'preview' ? 'hidden xl:block' : ''}`} aria-labelledby="step-title">
          <h3 id="step-title" className="text-lg font-semibold text-app-strong">{step?.label}</h3>
          <p className="mb-4 text-sm text-app-muted">{step?.hint}</p>

          {props.children}

          {props.error && <p className="mt-4 text-sm text-app-danger-text">{props.error}</p>}

          <div className="mt-6 flex items-center justify-between border-t border-app-border-soft pt-4">
            <button type="button" className="btn-secondary" disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>
              Back
            </button>
            {isLast ? (
              <button type="button" className="btn-primary" disabled={saving} onClick={onSave}>
                {saving ? 'Saving…' : props.saveLabel}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={props.onNext}>
                Next: {steps[stepIndex + 1]?.label}
              </button>
            )}
          </div>
        </section>

        <aside className={`xl:sticky xl:top-0 ${view === 'form' ? 'hidden xl:block' : ''}`} aria-label="Live preview">
          <div className="mb-2 text-xs text-app-faint">{props.previewLabel}</div>
          {props.preview}
        </aside>
      </div>
    </div>
  );
}

/** "Restored your unsaved … · Start over" banner for new-document drafts. */
export function RestoredBanner(props: { noun: string; onReset: () => void }) {
  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <span className="text-app-text">Restored your unsaved {props.noun} from this browser.</span>
      <button type="button" className="btn-small" onClick={props.onReset}>
        Start over
      </button>
    </div>
  );
}
