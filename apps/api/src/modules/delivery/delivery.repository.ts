import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { Delivery, DeliveryRoute, Driver, Vehicle } from './delivery.model.js';

export const DELIVERY_STATUSES = [
  'unassigned',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'rescheduled',
  'returned',
] as const;

export type DriverDoc = HydratedDocument<
  {
    driverCode: string;
    name: string;
    nameTa: string;
    phone: string;
    vehicleIds: Types.ObjectId[];
    currentLocation: {
      lat?: number | null;
      lng?: number | null;
      at?: Date | null;
      heading?: number | null;
    };
    isActive: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type VehicleDoc = HydratedDocument<
  {
    vehicleCode: string;
    type: string;
    registrationNumber: string;
    capacityKg: number;
    capacityBoxes: number;
    isActive: boolean;
    insuranceExpiry?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type DeliveryDoc = HydratedDocument<
  {
    deliveryNumber: string;
    orderId: Types.ObjectId;
    customerId: Types.ObjectId;
    address: unknown;
    status: string;
    driverId?: Types.ObjectId | null;
    vehicleId?: Types.ObjectId | null;
    routeId?: Types.ObjectId | null;
    sequence: number;
    pickup: {
      at?: Date | null;
      lat?: number | null;
      lng?: number | null;
      by?: Types.ObjectId | null;
    };
    pod: {
      method?: string | null;
      signatureUrl: string;
      photoUrl: string;
      otpVerifiedAt?: Date | null;
      recipientName: string;
      notes: string;
      at?: Date | null;
      lat?: number | null;
      lng?: number | null;
    };
    failedReason: string;
    proofOfDeliveryOtp: string;
    plannedAt?: Date | null;
    deliveredAt?: Date | null;
    distanceKm: number;
    etaMinutes: number;
    trackings: Types.DocumentArray<{
      lat: number;
      lng: number;
      at?: Date | null;
      heading?: number | null;
      speed?: number | null;
    }>;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type DeliveryRouteDoc = HydratedDocument<
  {
    routeDate: Date;
    driverId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    stops: Types.ObjectId[];
    totalDistanceKm: number;
    totalDurationMinutes: number;
    status: string;
    optimisedAt?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const deliveryRepository = {
  listDrivers(filter: FilterQuery<unknown>) {
    return Driver.find(filter).sort({ name: 1 }).exec() as Promise<DriverDoc[]>;
  },
  findDriverById(id: string) {
    return Driver.findById(id).exec() as Promise<DriverDoc | null>;
  },
  async createDriver(input: Record<string, unknown>): Promise<DriverDoc> {
    const [doc] = await Driver.create([input]);
    return doc as DriverDoc;
  },
  insertionManyDrivers(docs: Record<string, unknown>[]) {
    return Driver.insertMany(docs) as unknown as Promise<DriverDoc[]>;
  },
  updateDriver(id: string, update: Record<string, unknown>) {
    return Driver.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<DriverDoc | null>;
  },
  async incrementDriverDeliveries(id: string) {
    await Driver.findByIdAndUpdate(id, { $inc: { totalDeliveries: 1 } }).exec();
  },

  listVehicles(filter: FilterQuery<unknown>) {
    return Vehicle.find(filter).sort({ vehicleCode: 1 }).exec() as Promise<VehicleDoc[]>;
  },
  findVehicleById(id: string) {
    return Vehicle.findById(id).exec() as Promise<VehicleDoc | null>;
  },
  async createVehicle(input: Record<string, unknown>): Promise<VehicleDoc> {
    const [doc] = await Vehicle.create([input]);
    return doc as VehicleDoc;
  },
  updateVehicle(id: string, input: Record<string, unknown>) {
    return Vehicle.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<VehicleDoc | null>;
  },

  findDeliveryById(id: string) {
    return Delivery.findById(id).exec() as Promise<DeliveryDoc | null>;
  },
  findDeliveryByOrder(orderId: string) {
    return Delivery.findOne({ orderId }).exec() as Promise<DeliveryDoc | null>;
  },
  countByOrderIds(orderIds: string[]) {
    return Delivery.countDocuments({ orderId: { $in: orderIds } }).exec();
  },
  listDeliveries(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Delivery.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<DeliveryDoc[]>;
  },
  countDeliveries(filter: FilterQuery<unknown>) {
    return Delivery.countDocuments(filter).exec();
  },
  async createDelivery(input: Record<string, unknown>): Promise<DeliveryDoc> {
    const [doc] = await Delivery.create([input]);
    return doc as DeliveryDoc;
  },
  insertionManyDeliveries(docs: Record<string, unknown>[]) {
    return Delivery.insertMany(docs) as unknown as Promise<DeliveryDoc[]>;
  },
  updateDelivery(id: string, update: Record<string, unknown>) {
    return Delivery.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<DeliveryDoc | null>;
  },
  statusCounts() {
    return Delivery.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]).exec();
  },

  async createRoute(input: Record<string, unknown>): Promise<DeliveryRouteDoc> {
    const [doc] = await DeliveryRoute.create([input]);
    return doc as DeliveryRouteDoc;
  },
  findRouteById(id: string) {
    return DeliveryRoute.findById(id)
      .populate('driverId')
      .populate('vehicleId')
      .exec() as Promise<DeliveryRouteDoc | null>;
  },
  listRoutes(filter: FilterQuery<unknown>, skip: number, limit: number) {
    return DeliveryRoute.find(filter).skip(skip).limit(limit).sort({ routeDate: -1 }).exec() as Promise<DeliveryRouteDoc[]>;
  },
  countRoutes(filter: FilterQuery<unknown>) {
    return DeliveryRoute.countDocuments(filter).exec();
  },
  updateRoute(id: string, update: Record<string, unknown>) {
    return DeliveryRoute.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<DeliveryRouteDoc | null>;
  },

  /** Nearest-neighbour ordering of stops around the depot using haversine. */
  deliveriesByIds(ids: string[]) {
    return Delivery.find({ _id: { $in: ids } }).exec() as Promise<DeliveryDoc[]>;
  },
};
