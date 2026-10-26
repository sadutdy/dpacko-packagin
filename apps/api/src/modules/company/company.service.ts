import type { DocumentSeller } from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { companyRepository } from './company.repository.js';

export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  website: string;
  logo: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  declaration: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
}

const STRING_FIELDS = [
  'name',
  'address',
  'phone',
  'website',
  'logo',
  'gstin',
  'stateName',
  'stateCode',
  'declaration',
  'bankName',
  'accountNo',
  'ifsc',
  'branch',
] as const satisfies readonly (keyof CompanyProfile)[];

/** Defaults returned before the profile is ever edited. */
const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  address: '',
  phone: '',
  website: '',
  logo: '',
  gstin: '',
  stateName: '',
  stateCode: '',
  declaration: '',
  bankName: '',
  accountNo: '',
  ifsc: '',
  branch: '',
};

function toProfile(raw: Record<string, unknown> | null): CompanyProfile {
  if (!raw) return { ...EMPTY_PROFILE };
  const profile = { ...EMPTY_PROFILE };
  for (const field of STRING_FIELDS) {
    const value = raw[field];
    if (typeof value === 'string') profile[field] = value;
  }
  return profile;
}

const DEFAULT_DECLARATION =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

export const companyService = {
  get: async (): Promise<CompanyProfile> => toProfile(await companyRepository.find()),

  /** The seller block printed on quotes and invoices (profile + defaults). */
  async documentSeller(): Promise<DocumentSeller> {
    const company = await companyService.get();
    return {
      name: company.name,
      addressLines: company.address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      phone: company.phone,
      gstin: company.gstin,
      stateName: company.stateName,
      stateCode: company.stateCode,
      logo: company.logo,
      website: company.website,
      declaration: company.declaration || DEFAULT_DECLARATION,
      bank: company.bankName || company.accountNo
        ? { bankName: company.bankName, accountNo: company.accountNo, ifsc: company.ifsc, branch: company.branch }
        : null,
    };
  },

  async update(input: Record<string, unknown>): Promise<CompanyProfile> {
    const name = String(input.name ?? '').trim();
    if (!name) throw AppError.validation('Company name is required');
    return toProfile(await companyRepository.save(input));
  },
};
