import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { nextCounter } from '../counters/counter.model.js';
import { User } from '../auth/auth.model.js';
import { DELIVERY_STATUSES, deliveryRepository, type DeliveryDoc, type DeliveryRouteDoc, type DriverDoc, type VehicleDoc } from './delivery.repository.js';

const ISO_PERIOD = '25-26';

function toObject(doc: DriverDoc | VehicleDoc | DeliveryDoc | DeliveryRouteDoc) {
  return doc.toObject({ versionKey: false });
}

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  unassigned: ['assigned'],
  assigned: ['picked_up', 'failed', 'rescheduled'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  failed: ['rescheduled', 'returned'],
  delivered: [],
  rescheduled: ['assigned', 'unassigned'],
  returned: [],
};

function assertDeliveryTransition(from: string, to: string) {
  const allowed = DELIVERY_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw AppError.conflict(`Cannot move a delivery from '${from}' to '${to}'`, {
      allowedTransitions: allowed,
    });
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLatHalf = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sinLatHalf));
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const deliveryService = {
  async listDrivers() {
    const drivers = await deliveryRepository.listDrivers({ isActive: true });
    return drivers.map(toObject);
  },

  async createDriver(input: Record<string, unknown>) {
    const code = `DRV-${String(await nextCounter('driver', 'all')).padStart(4, '0')}`;
    return toObject(await deliveryRepository.createDriver({ ...input, driverCode: code }));
  },

  async updateDriverLocation(driverId: string, input: { lat: number; lng: number; heading?: number }) {
    const driver = await deliveryRepository.updateDriver(driverId, {
      currentLocation: {
        lat: input.lat,
        lng: input.lng,
        at: new Date(),
        heading: input.heading ?? null,
      },
    });
    if (!driver) throw AppError.notFound('Driver not found');
    return toObject(driver);
  },

  async listVehicles() {
    const vehicles = await deliveryRepository.listVehicles({ isActive: true });
    return vehicles.map(toObject);
  },

  async createVehicle(input: Record<string, unknown>) {
    const code = `VEH-${String(await nextCounter('vehicle', 'all')).padStart(3, '0')}`;
    return toObject(await deliveryRepository.createVehicle({ ...input, vehicleCode: code }));
  },

  async listDeliveries(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.driverId) filter.driverId = query.driverId;
    if (query.date && query.date instanceof Date) {
      const from = new Date(query.date);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      filter.plannedAt = { $gte: from, $lt: to };
    }
    const [deliveries, total] = await Promise.all([
      deliveryRepository.listDeliveries(filter, params.skip, params.limit, params.sort as string | undefined),
      deliveryRepository.countDeliveries(filter),
    ]);
    return { deliveries: deliveries.map(toObject), meta: buildPageMeta(total, params) };
  },

  /** The driver app view: deliveries assigned to the logged-in driver. */
  async myDeliveries(userId: string, query: Record<string, unknown>) {
    const user = await User.findById(userId).lean<{ driverId?: string | null }>().exec();
    if (!user?.driverId) throw AppError.forbidden('This account is not linked to a driver profile');
    return this.listDeliveries({ ...query, driverId: user.driverId });
  },

  async getDelivery(id: string) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    return toObject(delivery);
  },

  /** Creates the delivery record for a ready-to-dispatch order. */
  async createForOrder(
    input: {
      orderId: string;
      customerId: string;
      address: unknown;
      distanceKm?: number;
    },
    actorId: string,
  ) {
    const existing = await deliveryRepository.findDeliveryByOrder(input.orderId);
    if (existing) throw AppError.conflict('This order already has a delivery');
    const deliveryNumber = `DLV-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('delivery', ISO_PERIOD)).padStart(5, '0')}`;
    const delivery = await deliveryRepository.createDelivery({
      deliveryNumber,
      orderId: input.orderId,
      customerId: input.customerId,
      address: input.address ?? {},
      status: 'unassigned',
      distanceKm: input.distanceKm ?? 0,
      proofOfDeliveryOtp: generateOtp(),
      pickup: { by: actorId },
    });
    return toObject(delivery);
  },

  async assign(id: string, input: { driverId: string; vehicleId: string; plannedAt?: Date }) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    assertDeliveryTransition(delivery.status, 'assigned');
    const driver = await deliveryRepository.findDriverById(input.driverId);
    if (!driver) throw AppError.notFound('Driver not found');
    const vehicle = await deliveryRepository.findVehicleById(input.vehicleId);
    if (!vehicle) throw AppError.notFound('Vehicle not found');
    const updated = await deliveryRepository.updateDelivery(id, {
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      status: 'assigned',
      plannedAt: input.plannedAt ?? new Date(),
    });
    if (!updated) throw AppError.notFound('Delivery not found');
    return toObject(updated);
  },

  async pickup(id: string, actorId: string) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    assertDeliveryTransition(delivery.status, 'picked_up');
    const updated = await deliveryRepository.updateDelivery(id, {
      status: 'picked_up',
      pickup: { at: new Date(), by: actorId, lat: null, lng: null },
    });
    if (!updated) throw AppError.notFound('Delivery not found');
    return toObject(updated);
  },

  async markInTransit(id: string) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    assertDeliveryTransition(delivery.status, 'in_transit');
    const updated = await deliveryRepository.updateDelivery(id, { status: 'in_transit' });
    if (!updated) throw AppError.notFound('Delivery not found');
    return toObject(updated);
  },

  async track(id: string, input: { lat: number; lng: number; heading?: number; speed?: number }) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    await deliveryRepository.updateDelivery(id, {
      $push: {
        trackings: {
          lat: input.lat,
          lng: input.lng,
          at: new Date(),
          heading: input.heading ?? null,
          speed: input.speed ?? null,
        },
      },
    });
    if (delivery.driverId) {
      await deliveryRepository.updateDriver(String(delivery.driverId), {
        currentLocation: { lat: input.lat, lng: input.lng, at: new Date(), heading: input.heading ?? null },
      });
    }
    return { tracked: true };
  },

  async deliver(id: string, input: { method: 'signature' | 'photo' | 'otp'; signatureUrl?: string; photoUrl?: string; otp?: string; recipientName?: string; notes?: string; lat?: number; lng?: number }) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    if (input.method === 'otp') {
      if (!input.otp) throw AppError.validation('The proof-of-delivery OTP is required for OTP confirmations');
      if (!delivery.proofOfDeliveryOtp || input.otp !== delivery.proofOfDeliveryOtp) {
        throw AppError.validation('The proof-of-delivery OTP does not match');
      }
    }
    assertDeliveryTransition(delivery.status, 'delivered');
    const updated = await deliveryRepository.updateDelivery(id, {
      status: 'delivered',
      deliveredAt: new Date(),
      pod: {
        method: input.method,
        signatureUrl: input.signatureUrl ?? '',
        photoUrl: input.photoUrl ?? '',
        otpVerifiedAt: input.method === 'otp' ? new Date() : null,
        recipientName: input.recipientName ?? '',
        notes: input.notes ?? '',
        at: new Date(),
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      },
    });
    if (!updated) throw AppError.notFound('Delivery not found');
    if (delivery.driverId) await deliveryRepository.incrementDriverDeliveries(String(delivery.driverId));
    const response = toObject(updated) as Record<string, unknown>;
    delete response.proofOfDeliveryOtp;
    return response;
  },

  async fail(id: string, input: { reason: string }) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    assertDeliveryTransition(delivery.status, 'failed');
    const updated = await deliveryRepository.updateDelivery(id, { status: 'failed', failedReason: input.reason });
    if (!updated) throw AppError.notFound('Delivery not found');
    return toObject(updated);
  },

  async reschedule(id: string, input: { plannedAt: Date }) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw AppError.notFound('Delivery not found');
    assertDeliveryTransition(delivery.status, 'rescheduled');
    const updated = await deliveryRepository.updateDelivery(id, {
      status: 'rescheduled',
      plannedAt: input.plannedAt,
      driverId: null,
      vehicleId: null,
      routeId: null,
      sequence: 0,
    });
    if (!updated) throw AppError.notFound('Delivery not found');
    return toObject(updated);
  },

  async statusCounts() {
    const rows = await deliveryRepository.statusCounts();
    const counts = new Map(rows.map((row) => [row.status, row.count]));
    return DELIVERY_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  },

  /**
   * Plans a route: nearest-neighbour ordering of the stops over haversine
   * distance and the stops are persisted with their sequence numbers.
   */
  async createRoute(
    input: { routeDate: Date; driverId: string; vehicleId: string; deliveryIds: string[]; lat?: number; lng?: number },
  ) {
    const stopDocs = await deliveryRepository.deliveriesByIds(input.deliveryIds);
    if (stopDocs.length !== input.deliveryIds.length) throw AppError.notFound('One or more deliveries were not found');
    const depot = { lat: input.lat ?? 11.0168, lng: input.lng ?? 76.9558 };

    const remaining = stopDocs.map((doc) => {
      const loc = (doc.address as { geo?: { coordinates?: number[] } } | undefined)?.geo?.coordinates;
      const lng = Array.isArray(loc) ? loc[0] : undefined;
      const lat = Array.isArray(loc) ? loc[1] : undefined;
      return { id: String(doc._id), lat: typeof lat === 'number' ? lat : depot.lat, lng: typeof lng === 'number' ? lng : depot.lng };
    });
    const ordered: { id: string; lat: number; lng: number }[] = [];
    let current = depot;
    while (remaining.length > 0) {
      remaining.sort((a, b) => haversineKm(current, a) - haversineKm(current, b));
      const next = remaining.shift();
      if (!next) break;
      ordered.push(next);
      current = next;
    }
    let totalDistanceKm = 0;
    let prev = depot;
    for (const stop of ordered) {
      totalDistanceKm += haversineKm(prev, stop);
      prev = stop;
    }

    const route = await deliveryRepository.createRoute({
      routeDate: input.routeDate,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      stops: ordered.map((stop) => stop.id),
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMinutes: ordered.length * 15,
      status: 'planned',
      optimisedAt: new Date(),
    });
    for (const [index, stop] of ordered.entries()) {
      await deliveryRepository.updateDelivery(stop.id, {
        routeId: route._id,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        sequence: index + 1,
        status: 'assigned',
        plannedAt: input.routeDate,
      });
    }
    return toObject(route);
  },

  async listRoutes(query: Record<string, unknown>) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.routeDate && query.routeDate instanceof Date) {
      const from = new Date(query.routeDate);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      filter.routeDate = { $gte: from, $lt: to };
    }
    if (query.driverId) filter.driverId = query.driverId;
    const [routes, total] = await Promise.all([
      deliveryRepository.listRoutes(filter, params.skip, params.limit),
      deliveryRepository.countRoutes(filter),
    ]);
    return {
      routes: routes.map((route) => ({
        ...toObject(route),
        driver: route.driverId,
        vehicle: route.vehicleId,
      })),
      meta: buildPageMeta(total, params),
    };
  },
};
