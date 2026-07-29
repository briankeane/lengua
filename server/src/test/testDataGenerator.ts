import { faker } from '@faker-js/faker';
import config from '../config/config';
import User from '../db/models/user.model';
import { generateToken } from '../utils/jwt';

if (config.NODE_ENV !== 'test') {
  throw new Error('testDataGenerator can only be used in test environment');
}

type UserOverrides = Partial<{
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  profileImageUrl: string;
  verifiedEmail: string;
  passwordHash: string;
  role: 'admin' | 'user' | 'guest';
}>;

export async function createUser(overrides: UserOverrides = {}) {
  const firstName = overrides.firstName ?? faker.person.firstName();
  const lastName = overrides.lastName ?? faker.person.lastName();
  return User.create({
    firstName,
    lastName,
    displayName: overrides.displayName ?? `${firstName} ${lastName}`,
    email: overrides.email ?? faker.internet.email(),
    profileImageUrl: overrides.profileImageUrl ?? faker.image.avatar(),
    role: overrides.role ?? 'user',
    ...overrides,
  });
}

export async function createUserWithToken(overrides: UserOverrides = {}) {
  const user = await createUser(overrides);
  const token = await generateToken(user);
  return { user, token };
}
