import { randomBytes } from 'node:crypto';

import { Role, rolePermissions } from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { toPublicUser } from '../auth/auth.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { usersRepository } from './users.repository.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const usersService = {
  async list(query: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const params = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }

    const [users, total] = await Promise.all([
      usersRepository.list(filter, params.skip, params.limit, params.sort),
      usersRepository.count(filter),
    ]);

    return { users: users.map(toPublicUser), meta: buildPageMeta(total, params) };
  },

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },

  async invite(input: { phone: string; name: string; role: string; locale: string }) {
    const existing = await userRepository.findByPhone(input.phone);
    if (existing) throw AppError.conflict('A user with this number already exists');

    const temporaryPassword = randomBytes(9).toString('base64url');
    const user = await usersRepository.invite({
      ...input,
      passwordHash: await usersRepository.hashPassword(temporaryPassword),
    });

    return { user: toPublicUser(user), temporaryPassword };
  },

  async update(id: string, input: { role?: string; status?: string }) {
    const user = await userRepository.update(id, input);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },

  roles() {
    return Object.values(Role).map((role) => ({
      role,
      permissions: rolePermissions[role],
    }));
  },
};
