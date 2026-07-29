import * as bcrypt from 'bcrypt';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { UniqueConstraintError } from 'sequelize';
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

export async function googleSignInWithCode({
  code,
}: {
  code: string;
}): Promise<{ user: User; token: string }> {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ValidationError('Google sign-in is not configured');
  }

  const client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    'postmessage',
  );

  let payload: TokenPayload | undefined;
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new Error('No id_token returned from Google');
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AuthenticationError('Google authentication failed');
  }

  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new AuthenticationError('Google authentication failed');
  }

  const user = await upsertGoogleUser(payload);
  const token = await generateToken(user);
  return { user, token };
}

async function upsertGoogleUser(payload: TokenPayload): Promise<User> {
  const sub = payload.sub as string;
  const email = payload.email as string;

  const bySub = await User.findOne({ where: { googleId: sub } });
  if (bySub) {
    return bySub;
  }

  const byEmail = await User.findOne({ where: { email } });
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== sub) {
      throw new AuthenticationError('This email is already linked to a different Google account');
    }
    await byEmail.update({
      googleId: sub,
      verifiedEmail: byEmail.verifiedEmail ?? email,
      profileImageUrl: byEmail.profileImageUrl ?? payload.picture,
    });
    return byEmail;
  }

  try {
    return await User.create({
      googleId: sub,
      email,
      firstName: payload.given_name ?? email.split('@')[0],
      lastName: payload.family_name ?? '',
      verifiedEmail: email,
      profileImageUrl: payload.picture,
    });
  } catch (err) {
    // Concurrent first sign-in for the same sub/email can lose the create race;
    // the winner already made the row, so re-fetch it deterministically.
    if (err instanceof UniqueConstraintError) {
      const existing =
        (await User.findOne({ where: { googleId: sub } })) ??
        (await User.findOne({ where: { email } }));
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
}
