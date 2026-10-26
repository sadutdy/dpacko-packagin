import { Company } from './company.model.js';

export const companyRepository = {
  /** The singleton profile document, or null when never saved. */
  async find(): Promise<Record<string, unknown> | null> {
    const doc = await Company.findOne({ _id: 'org' }).lean().exec();
    return doc as Record<string, unknown> | null;
  },

  /** Saves the full profile (PUT semantics: omitted fields clear to ''). */
  async save(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const doc = await Company.findOneAndUpdate(
      { _id: 'org' },
      { $set: { ...input, _id: 'org' } },
      { new: true, upsert: true, runValidators: true, lean: true },
    ).exec();
    return doc as unknown as Record<string, unknown>;
  },

  async delete(): Promise<void> {
    await Company.findOneAndDelete({ _id: 'org' }).exec();
  },
};
