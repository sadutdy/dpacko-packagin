import type { ReactNode } from 'react';

export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  const { title, onClose, children } = props;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-app-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-app-strong">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-full p-1.5 text-app-faint hover:bg-app-subtle hover:text-app-text"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDelete(props: {
  title: string;
  message: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { title, message, busy, error, onCancel, onConfirm } = props;

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-app-text">{message}</p>
      {error && <p className="mt-3 text-sm text-app-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className="btn-danger">
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

export function ModalForm(props: {
  title: string;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { title, busy, error, submitLabel = 'Save', onCancel, onSubmit, children } = props;

  return (
    <Modal title={title} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {error && <p className="mt-3 text-sm text-app-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Field(props: { label: string; children: ReactNode }) {
  const { label, children } = props;

  return (
    <label className="mb-3 block">
      <span className="section-label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'field';
