import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { ModalForm, Field, inputClass } from '../../components/Modal.js';
import { api } from '../../lib/api.js';
import { useList } from '../../lib/useList.js';
import { PageHeading, errorText, dayToday } from './shared.js';

interface CallLogRow {
  _id: string;
  customerId: string | { businessName?: string; _id?: string } | null;
  customerName?: string;
  date: string;
  channel: string;
  outcome: string;
}

interface RouteCard {
  id: string;
  area: string;
  kind: string;
  customers: {
    customerId: string;
    customerCode: string;
    businessName: string;
    phone: string;
  }[];
}

interface RoutesTodayBody {
  date: string;
  weekday: number;
  routes: RouteCard[];
}

interface WeekdayRoute {
  _id: string;
  weekday: number;
  area: string;
  kind: string;
  active: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-app-surface p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-app-strong">{title}</div>
      {children}
    </div>
  );
}

export function RoutesPage() {
  const [day, setDay] = useState<string>(dayToday());
  const [cards, setCards] = useState<RouteCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeModal, setRouteModal] = useState(false);
  const [callModal, setCallModal] = useState<{ customerId: string; name: string } | null>(null);
  const [routeForm, setRouteForm] = useState({ weekday: '2', area: '', kind: 'retail' });
  const [callForm, setCallForm] = useState({
    channel: 'call',
    outcome: 'promise_made',
    nextActionDate: prevents(),
    note: '',
  });
  const [busy, setBusy] = useState(false);

  const routes = useList<WeekdayRoute>('/api/v1/office/routes', {}, 1, 50);
  const logs = useList<CallLogRow>('/api/v1/office/followups/call-logs', {}, 1, 15);

  useEffect(() => {
    api
      .body<RoutesTodayBody>(`/api/v1/office/routes/today?date=${day}`)
      .then((body) => setCards(body.data?.routes ?? []))
      .catch((err: unknown) => setError(errorText(err)));
  }, [day, routes.rows]);

  async function saveRoute() {
    setBusy(true);
    try {
      await api.post('/api/v1/office/routes', {
        weekday: Number(routeForm.weekday),
        area: routeForm.area,
        kind: routeForm.kind,
      });
      setRouteModal(false);
      setRouteForm({ weekday: '2', area: '', kind: 'retail' });
      routes.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function logCall() {
    if (!callModal) return;
    setBusy(true);
    try {
      await api.post('/api/v1/office/followups/call-logs', {
        customerId: callModal.customerId,
        date: dayToday(),
        channel: callForm.channel,
        outcome: callForm.outcome,
        nextActionDate: callForm.nextActionDate || undefined,
        note: callForm.note,
      });
      setCallModal(null);
      logs.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        title="Follow-up & Routes"
        subtitle="Visit routes on this weekday plus the running call log"
        actions={
          <div className="flex gap-2">
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="rounded border border-app-border bg-app-surface px-3 py-2 text-sm"
              aria-label="Route day"
            />
            <button
              type="button"
              onClick={() => setRouteModal(true)}
              className="btn-primary"
            >
              + Route
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-app-danger-text">{error}</p>}

      <p className="mb-2 text-sm text-app-muted">
        {WEEKDAY_LABELS[new Date(`${day}T12:00:00+05:30`).getDay()]} ·{' '}
        {routes.rows.filter((r) => r.active).length} active routes this weekday
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(cards ?? []).map((card) => (
          <Card
            key={card.id}
            title={`${card.area} · ${WEEKDAY_LABELS[new Date(`${day}T12:00:00+05:30`).getDay()] ?? ''} (${card.kind})`}
          >
            {card.customers.length === 0 && (
              <p className="text-sm text-app-muted">No customers on this route.</p>
            )}
            <ul className="space-y-2">
              {card.customers.map((customer) => (
                <li
                  key={customer.customerId}
                  className="flex items-center justify-between gap-2 rounded border border-app-border p-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-app-strong">
                      {customer.businessName}
                    </div>
                    <div className="text-xs text-app-muted">{customer.phone}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCallModal({ customerId: customer.customerId, name: customer.businessName })
                    }
                    className="shrink-0 btn-small"
                  >
                    Log
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <h3 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
        Weekly route template
      </h3>
      <div className="overflow-hidden rounded-lg bg-app-surface shadow-sm">
        <table className="min-w-full divide-y divide-app-border">
          <thead className="bg-app-subtle">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Weekday</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Area</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Kind</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-app-text">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border-soft">
            {routes.rows.map((row) => (
              <tr key={row._id}>
                <td className="px-4 py-2 text-sm">{WEEKDAY_LABELS[row.weekday]}</td>
                <td className="px-4 py-2 text-sm">{row.area}</td>
                <td className="px-4 py-2 text-sm capitalize">{row.kind}</td>
                <td className="px-4 py-2 text-sm">{row.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {routes.rows.length === 0 && !routes.loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-app-muted">
                  No routes created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
        Recent call log
      </h3>
      <div className="space-y-1">
        {logs.rows.slice(0, 10).map((row) => (
          <div
            key={row._id}
            className="flex items-center justify-between rounded bg-app-surface px-3 py-2 text-sm"
          >
            <span>
              {row.customerName ||
                (typeof row.customerId === 'object' && row.customerId !== null
                  ? (row.customerId.businessName ?? '')
                  : row.customerId) ||
                '—'}
            </span>
            <span className="text-xs text-app-muted">
              {row.date} · {row.channel} · {row.outcome.replaceAll('_', ' ')}
            </span>
          </div>
        ))}
        {logs.rows.length === 0 && !logs.loading && (
          <p className="text-sm text-app-muted">No call logs yet.</p>
        )}
      </div>

      {routeModal && (
        <ModalForm
          title="New route schedule"
          onCancel={() => setRouteModal(false)}
          onSubmit={() => void saveRoute()}
          busy={busy}
          error={error}
        >
          <Field label="Weekday">
            <select
              className={inputClass}
              value={routeForm.weekday}
              onChange={(e) => setRouteForm({ ...routeForm, weekday: e.target.value })}
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area">
            <input
              className={inputClass}
              value={routeForm.area}
              onChange={(e) => setRouteForm({ ...routeForm, area: e.target.value })}
              required
            />
          </Field>
          <Field label="Kind">
            <select
              className={inputClass}
              value={routeForm.kind}
              onChange={(e) => setRouteForm({ ...routeForm, kind: e.target.value })}
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </Field>
        </ModalForm>
      )}

      {callModal && (
        <ModalForm
          title={`Log call · ${callModal.name}`}
          onCancel={() => setCallModal(null)}
          onSubmit={() => void logCall()}
          busy={busy}
          error={error}
        >
          <Field label="Channel">
            <select
              className={inputClass}
              value={callForm.channel}
              onChange={(e) => setCallForm({ ...callForm, channel: e.target.value })}
            >
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="voice">Voice note</option>
              <option value="visit">Visit</option>
            </select>
          </Field>
          <Field label="Outcome">
            <select
              className={inputClass}
              value={callForm.outcome}
              onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })}
            >
              <option value="promise_made">Promise made</option>
              <option value="no_contact">No contact</option>
              <option value="message_left">Message left</option>
              <option value="collected">Collected</option>
            </select>
          </Field>
          <Field label="Next action date">
            <input
              type="date"
              className={inputClass}
              value={callForm.nextActionDate}
              onChange={(e) => setCallForm({ ...callForm, nextActionDate: e.target.value })}
            />
          </Field>
        </ModalForm>
      )}
    </div>
  );
}

function prevents(): string {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return tomorrow.toISOString().slice(0, 10);
}
