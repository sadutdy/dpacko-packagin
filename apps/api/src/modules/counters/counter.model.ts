import { Schema, model } from 'mongoose';

/**
 * Gap-free numbering. Increment is atomic (`findOneAndUpdate` + `$inc`), never
 * a read-then-write, so two concurrent creates cannot collide.
 */
const counterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
    period: { type: String, default: '' },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Counter = model('Counter', counterSchema);

export async function nextCounter(key: string, period: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key: `${key}:${period}` },
    { $inc: { value: 1 }, $setOnInsert: { period } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
  return doc?.value ?? 1;
}
