import { userRepository, type UserDoc } from '../auth/auth.repository.js';
import { hashPassword } from '../auth/strategies/password.js';

export const usersRepository = {
  list: userRepository.list,
  count: userRepository.count,
  findById: userRepository.findById,

  async invite(input: {
    phone: string;
    name: string;
    role: string;
    locale: string;
    passwordHash: string;
  }): Promise<UserDoc> {
    return userRepository.create({
      phone: input.phone,
      name: input.name,
      role: input.role,
      status: 'invited',
      locale: input.locale,
      passwordHash: input.passwordHash,
    });
  },

  hashPassword,
};
