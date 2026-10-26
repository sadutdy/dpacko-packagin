import { Schema, model } from 'mongoose';

const driverSchema = new Schema(
  {
    driverCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameTa: { type: String, default: '' },
    phone: { type: String, required: true, unique: true },
    vehicleIds: { type: [Schema.Types.ObjectId], ref: 'Vehicle', default: [] },
    isActive: { type: Boolean, default: true },
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      at: { type: Date, default: null },
      heading: { type: Number, default: null },
    },
    rating: { type: Number, default: 5 },
    totalDeliveries: { type: Number, default: 0 },
    licenseNumber: { type: String, default: '' },
    licenseExpiry: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Driver = model('Driver', driverSchema);

const vehicleSchema = new Schema(
  {
    vehicleCode: { type: String, required: true, unique: true },
    type: { type: String, enum: ['van', 'mini_truck', 'bike'], required: true },
    registrationNumber: { type: String, required: true, unique: true },
    capacityKg: { type: Number, default: 500 },
    capacityBoxes: { type: Number, default: 200 },
    isActive: { type: Boolean, default: true },
    insuranceExpiry: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Vehicle = model('Vehicle', vehicleSchema);

const trackingPointSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    at: { type: Date, default: Date.now },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
  },
  { _id: false },
);

const podSchema = new Schema(
  {
    method: { type: String, enum: ['signature', 'photo', 'otp'], default: null },
    signatureUrl: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    otpVerifiedAt: { type: Date, default: null },
    recipientName: { type: String, default: '' },
    notes: { type: String, default: '' },
    at: { type: Date, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false },
);

const deliverySchema = new Schema(
  {
    deliveryNumber: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    address: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: [
        'unassigned',
        'assigned',
        'picked_up',
        'in_transit',
        'delivered',
        'failed',
        'rescheduled',
        'returned',
      ],
      default: 'unassigned',
      index: true,
    },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    routeId: { type: Schema.Types.ObjectId, ref: 'DeliveryRoute', default: null },
    sequence: { type: Number, default: 0 },
    pickup: {
      at: { type: Date, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    pod: { type: podSchema, default: () => ({}) },
    failedReason: { type: String, default: '' },
    proofOfDeliveryOtp: { type: String, default: '' },
    plannedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    distanceKm: { type: Number, default: 0 },
    etaMinutes: { type: Number, default: 0 },
    trackings: { type: [trackingPointSchema], default: [] },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

deliverySchema.index({ driverId: 1, status: 1 });
deliverySchema.index({ status: 1, plannedAt: 1 });
deliverySchema.index({ 'address.geo': '2dsphere' });

export const Delivery = model('Delivery', deliverySchema);

const deliveryRouteSchema = new Schema(
  {
    routeDate: { type: Date, required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    stops: { type: [Schema.Types.ObjectId], ref: 'Delivery', default: [] },
    totalDistanceKm: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ['planned', 'in_progress', 'completed'], default: 'planned' },
    optimisedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const DeliveryRoute = model('DeliveryRoute', deliveryRouteSchema);
