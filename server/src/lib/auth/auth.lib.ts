import * as bcrypt from 'bcrypt';
import * as appleSignIn from 'apple-signin-auth';
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

export async function googleSignInWithIdToken({
  idToken,
}: {
  idToken: string;
}): Promise<{ user: User; token: string }> {
  const audience = [config.GOOGLE_CLIENT_ID, config.GOOGLE_IOS_CLIENT_ID].filter(
    Boolean,
  ) as string[];
  if (audience.length === 0) {
    throw new ValidationError('Google sign-in is not configured');
  }

  const client = new OAuth2Client();

  let payload: TokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
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
        if (existing.googleId && existing.googleId !== sub) {
          throw new AuthenticationError(
            'This email is already linked to a different Google account',
          );
        }
        await existing.update({
          googleId: sub,
          verifiedEmail: existing.verifiedEmail ?? email,
          profileImageUrl: existing.profileImageUrl ?? payload.picture,
        });
        return existing;
      }
    }
    throw err;
  }
}

export async function appleSignInWithIdentityToken({
  identityToken,
  firstName,
  lastName,
}: {
  identityToken: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ user: User; token: string }> {
  if (!config.APPLE_CLIENT_ID) {
    throw new ValidationError('Apple sign-in is not configured');
  }

  let appleUserId: string;
  let email: string | undefined;
  try {
    const payload = await appleSignIn.verifyIdToken(identityToken, {
      audience: config.APPLE_CLIENT_ID,
    });
    appleUserId = payload.sub;
    email = payload.email;
  } catch {
    throw new AuthenticationError('Apple authentication failed');
  }

  if (!appleUserId) {
    throw new AuthenticationError('Apple authentication failed');
  }

  const user = await upsertAppleUser({ appleUserId, email, firstName, lastName });
  const token = await generateToken(user);
  return { user, token };
}

async function upsertAppleUser({
  appleUserId,
  email,
  firstName,
  lastName,
}: {
  appleUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<User> {
  const bySub = await User.findOne({ where: { appleId: appleUserId } });
  if (bySub) {
    return bySub;
  }

  // Apple only returns an email on the first authorization; synthesize a stable
  // placeholder so the NOT NULL/unique email column is always satisfied.
  const resolvedEmail = email ?? `apple-${appleUserId}@lengua.placeholder`;

  const byEmail = await User.findOne({ where: { email: resolvedEmail } });
  if (byEmail) {
    if (byEmail.appleId && byEmail.appleId !== appleUserId) {
      throw new AuthenticationError('This email is already linked to a different Apple account');
    }
    await byEmail.update({
      appleId: appleUserId,
      verifiedEmail: byEmail.verifiedEmail ?? (email ? resolvedEmail : undefined),
    });
    return byEmail;
  }

  try {
    return await User.create({
      appleId: appleUserId,
      email: resolvedEmail,
      firstName: firstName ?? resolvedEmail.split('@')[0],
      lastName: lastName ?? '',
      verifiedEmail: email ? resolvedEmail : undefined,
    });
  } catch (err) {
    // Concurrent first sign-in for the same sub/email can lose the create race;
    // the winner already made the row, so re-fetch it deterministically.
    if (err instanceof UniqueConstraintError) {
      const existing =
        (await User.findOne({ where: { appleId: appleUserId } })) ??
        (await User.findOne({ where: { email: resolvedEmail } }));
      if (existing) {
        if (existing.appleId && existing.appleId !== appleUserId) {
          throw new AuthenticationError(
            'This email is already linked to a different Apple account',
          );
        }
        await existing.update({
          appleId: appleUserId,
          verifiedEmail: existing.verifiedEmail ?? (email ? resolvedEmail : undefined),
        });
        return existing;
      }
    }
    throw err;
  }
}
