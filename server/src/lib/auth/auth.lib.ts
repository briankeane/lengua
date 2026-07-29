import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import config from '../../config/config';
import User from '../../db/models/user.model';
import { AuthenticationError, ConflictError, ValidationError } from '../../utils/errors';
import { generateToken } from '../../utils/jwt';

const SALT_ROUNDS = 10;

export async function signup({
  email,
  password,
  firstName,
  lastName,
}: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<{ user: User; token: string }> {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email,
    firstName,
    lastName: lastName ?? '',
    passwordHash,
  });

  const token = await generateToken(user);
  return { user, token };
}

export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ user: User; token: string }> {
  const user = await User.findOne({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AuthenticationError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid email or password');
  }

  const token = await generateToken(user);
  return { user, token };
}

export async function googleSignIn({
  idToken,
}: {
  idToken: string;
}): Promise<{ user: User; token: string }> {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new ValidationError('Google sign-in is not configured');
  }

  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AuthenticationError('Invalid Google ID token');
  }

  if (!payload || !payload.email) {
    throw new AuthenticationError('Invalid Google ID token');
  }

  let user = await User.findOne({ where: { email: payload.email } });

  if (user) {
    if (!user.verifiedEmail && payload.email_verified) {
      await user.update({ verifiedEmail: payload.email });
    }
  } else {
    user = await User.create({
      email: payload.email,
      firstName: payload.given_name ?? payload.email.split('@')[0],
      lastName: payload.family_name ?? '',
      verifiedEmail: payload.email_verified ? payload.email : undefined,
      profileImageUrl: payload.picture,
    });
  }

  const token = await generateToken(user);
  return { user, token };
}
