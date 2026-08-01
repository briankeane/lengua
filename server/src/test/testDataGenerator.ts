import { faker } from '@faker-js/faker';
import config from '../config/config';
import User from '../db/models/user.model';
import ConversationSession, { VoiceMode } from '../db/models/conversationSession.model';
import VocabItem from '../db/models/vocabItem.model';
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

type ConversationSessionOverrides = Partial<{
  userId: string;
  provider: string;
  mode: VoiceMode;
  targetLanguageCode: string;
}>;

export async function createConversationSession(overrides: ConversationSessionOverrides = {}) {
  const userId = overrides.userId ?? (await createUser()).id;
  return ConversationSession.create({
    userId,
    provider: overrides.provider ?? 'elevenlabs',
    mode: overrides.mode ?? 'quiz',
    targetLanguageCode: overrides.targetLanguageCode ?? 'es',
  });
}

type VocabItemOverrides = Partial<{
  userId: string;
  targetLanguageCode: string;
  sourceText: string;
  targetText: string;
  targetTextNormalized: string;
}>;

export async function createVocabItem(overrides: VocabItemOverrides = {}) {
  const userId = overrides.userId ?? (await createUser()).id;
  const targetText = overrides.targetText ?? 'perro';
  return VocabItem.create({
    userId,
    targetLanguageCode: overrides.targetLanguageCode ?? 'es',
    sourceText: overrides.sourceText ?? 'dog',
    targetText,
    targetTextNormalized: overrides.targetTextNormalized ?? targetText.toLowerCase(),
  });
}
