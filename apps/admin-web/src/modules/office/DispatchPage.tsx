import { useEffect, useState } from 'react';

import { shortDate, titleCase } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { PageHeading, StatusPill, dayToday, errorText } from './shared.js';

interface DueOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: string;
  requestedDeliveryDate: string | null;
  delivery: { routeLabel?: string; plannedAt?: string | null; status?: string } | null;
}

interface DeliveryEvent {
  orderId: string;
  status?: string;
  deliveredAt?: string | null;
  plannedAt?: string | null;
}

interface Board {
  date: string;
  dueToday: DueOrder[];
  delayed: DueOrder[];
  dispatched: DeliveryEvent[];
}

const COLUMN = 'rounded-lg bg-app-surface p-3 shadow-sm space-y-2';

function OrderLine(props: { order: DueOrder }) {
  const { order } = props;
  return (
    <div className="rounded border border-app-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-app-strong">{order.orderNumber}</span>
        <StatusPill value={order.status} />
      </div>
      {order.requestedDeliveryDate && (
        <div className="text-xs text-app-faint">
          Requested {shortDate(order.requestedDeliveryDate)}
        </div>
      )}
      {order.delivery?.plannedAt && (
        <div className="text-xs text-app-faint">Planned {shortDate(order.delivery.plannedAt)}</div>
      )}
    </div>
  );
}

function EventLine(props: { event: DeliveryEvent }) {
  return (
    <div className="rounded border border-app-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-app-strong">
          {props.event.orderId.slice(-6).toUpperCase()}
        </span>
        <StatusPill value={props.event.status ?? 'delivered'} />
      </div>
      <div className="text-xs text-app-faint">Out {shortDate(props.event.plannedAt ?? null)}</div>
    </div>
  );
}

export function DispatchPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [date, setDate] = useState(dayToday());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .body<Board>(`/api/v1/office/dispatch-board?date=${date}`)
      .then((body) => setBoard(body.data ?? null))
      .catch((err: unknown) => setError(errorText(err)));
  }, [date]);

  return (
    <div>
      <PageHeading
        title="Dispatch Board"
        subtitle="What leaves the gate today, what slipped, what already rolled"
        actions={
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field"
            aria-label="Board date"
          />
        }
      />

      {error && <p className="text-sm text-app-danger-text">{error}</p>}
      {!board && !error && <p className="text-sm text-app-muted">Loading…</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
            Due today ({board?.dueToday.length ?? 0})
          </h3>
          <div className={COLUMN}>
            {(board?.dueToday ?? []).map((order) => (
              <OrderLine key={order.orderId} order={order} />
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
            Delayed ({board?.delayed.length ?? 0})
          </h3>
          <div className={COLUMN}>
            {(board?.delayed ?? []).map((order) => (
              <OrderLine key={order.orderId} order={order} />
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-app-muted">
            Out today ({board?.dispatched.length ?? 0})
          </h3>
          <div className={COLUMN}>
            {(board?.dispatched ?? []).map((event, index) => (
              <EventLine key={`${event.orderId}-${index}`} event={event} />
            ))}
          </div>
        </section>
      </div>

      <p className="mt-4 text-xs text-app-muted">{titleCase(board?.date ?? '')}</p>
    </div>
  );
}
