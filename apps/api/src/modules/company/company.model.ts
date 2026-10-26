import { Schema, model } from 'mongoose';

/**
 * Company profile — a singleton document describing the business itself.
 * `_id` is pinned to the `singleton` string so there is always exactly one
 * row; the repository upserts against it and the service supplies defaults.
 */
export const COMPANY_SINGLETON_ID = 'org';

const companySchema = new Schema(
  {
    _id: { type: String, required: true, default: COMPANY_SINGLETON_ID },
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    // URL or object-storage key; uploads resolve to a stable URL elsewhere.
    logo: { type: String, default: '' },
    gstin: { type: String, default: '' },
    // Printed on quotations/invoices. Code defaults from the GSTIN prefix.
    stateName: { type: String, default: '' },
    stateCode: { type: String, default: '' },
    declaration: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNo: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    branch: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

export const Company = model('Company', companySchema, 'companies');
