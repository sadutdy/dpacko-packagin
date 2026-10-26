import { useState } from 'react';
import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { rupees, shortDate, titleCase } from '../../lib/format.js';
import { useList } from '../../lib/useList.js';
import { api } from '../../lib/api.js';
import { PageHeading, StatusPill, errorText } from './shared.js';

interface DeskEvent {
  step: string;
  note?: string;
}

interface DeskRow {
  order: {
    _id: string;
    orderNumber: string;
    status: string;
    pricing: { grandTotalPaise: number } | null;
    createdAt: string;
    customerId: { businessName?: string; _id?: string } | string | null;
  };
  progress: { step: string; done: boolean }[];
  nextStep: string | null;
  events?: DeskEvent[];
}

export function DeskPage() {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [modal, setModal] = useState<{ row: DeskRow; action: 'step' | 'print' } | null>(null);
  const [stepForm, setStepForm] = useState('');
  const [copies, setCopies] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useList<DeskRow>(
    '/api/v1/office/desk',
    { date: dateFilter, pending: dateFilter ? undefined : 'true' },
    1,
    25,
  );

  async function submit() {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.action === 'step') {
        if (!stepForm) throw new Error('Choose the next desk step');
        const note = modal.row.progress
          .filter((entry) => entry.done)
          .map((entry) => entry.step)
          .join(', ');
        await api.post(`/api/v1/office/desk/${modal.row.order._id}/steps`, {
          step: stepForm,
          note,
        });
      } else {
        await api.post(`/api/v1/office/desk/${modal.row.order._id}/print-bill`, { copies });
      }
      setModal(null);
      setStepForm('');
      list.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        title="Order Desk"
        subtitle="Shepherd orders through the desk ladder one rung at a time"
        actions={
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="field"
            aria-label="Filter by order date"
          />
        }
      />

      {list.error && <p className="text-sm text-app-danger-text">{list.error}</p>}

      <div className="overflow-hidden rounded-lg bg-app-surface shadow-sm">
        <table className="min-w-full divide-y divide-app-border">
          <thead className="bg-app-subtle">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Order</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Customer</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Status</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Value</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Ladder</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Next step</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border-soft">
            {list.rows.map((row) => {
              const customerName =
                typeof row.order.customerId === 'object' && row.order.customerId !== null
                  ? (row.order.customerId.businessName ?? '')
                  : '';
              return (
                <tr key={String(row.order._id)}>
                  <td className="px-4 py-2 text-sm font-medium text-app-strong">
                    {row.order.orderNumber}
                  </td>
                  <td className="px-4 py-2 text-sm">{customerName || '—'}</td>
                  <td className="px-4 py-2">
                    <StatusPill value={row.order.status} />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {rupees(row.order.pricing?.grandTotalPaise ?? 0)}
                  </td>
                  <td className="px-4 py-2 text-sm text-app-muted">
                    {row.progress.filter((entry) => entry.done).length}/{row.progress.length} ·{' '}
                    {shortDate(row.order.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {row.nextStep ? titleCase(row.nextStep) : 'Complete'}
                  </td>
                  <td className="flex flex-wrap gap-1 px-4 py-2">
                    {row.nextStep && (
                      <button
                        type="button"
                        onClick={() => setModal({ row, action: 'step' })}
                        className="btn-small"
                      >
                        + {titleCase(row.nextStep)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModal({ row, action: 'print' })}
                      className="btn-small"
                    >
                      Print bill
                    </button>
                  </td>
                </tr>
              );
            })}
            {list.rows.length === 0 && !list.loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-app-muted">
                  No orders on the desk for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.action === 'step' && (
        <ModalForm
          title={`Advance ${modal.row.order.orderNumber}`}
          busy={busy}
          error={error}
          onCancel={() => setModal(null)}
          onSubmit={() => void submit()}
        >
          <Field label="Desk step">
            <select
              className={inputClass}
              value={stepForm}
              onChange={(e) => setStepForm(e.target.value)}
              required
            >
              <option value="">Select…</option>
              <option value={modal.row.nextStep ?? ''}>
                {titleCase(modal.row.nextStep ?? '')}
              </option>
            </select>
          </Field>
        </ModalForm>
      )}

      {modal?.action === 'print' && (
        <ModalForm
          title={`Print bill · ${modal.row.order.orderNumber}`}
          busy={busy}
          error={error}
          submitLabel="Print"
          onCancel={() => setModal(null)}
          onSubmit={() => void submit()}
        >
          <Field label="Copies">
            <input
              type="number"
              min={1}
              max={5}
              className={inputClass}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value))}
            />
          </Field>
        </ModalForm>
      )}
    </div>
  );
}
