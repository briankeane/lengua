import User from '../../db/models/user.model';
import { NotFoundError } from '../../utils/errors';

export async function getUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function updateUser(
  userId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    profileImageUrl?: string;
  },
): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  await user.update(updates);
  return user;
}
