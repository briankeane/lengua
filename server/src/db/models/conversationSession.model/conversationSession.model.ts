import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

// Arbitrary JSON stored in the JSONB columns. Typed (rather than `unknown`) so
// callers can assign real values on create without tripping Sequelize's
// CreationOptional brand-intersection compile error.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const VOICE_MODES = ['quiz', 'weave'] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const CONVERSATION_SESSION_STATUSES = ['active', 'completed', 'failed', 'expired'] as const;
export type ConversationSessionStatus = (typeof CONVERSATION_SESSION_STATUSES)[number];

export const EVALUATION_STATUSES = [
  'not_started',
  'waiting_transcript',
  'pending',
  'ready',
  'failed',
  'expired',
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

class ConversationSession extends Model<
  InferAttributes<ConversationSession>,
  InferCreationAttributes<ConversationSession>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare provider: string;
  declare providerConversationId: CreationOptional<string | null>;
  declare mode: VoiceMode;
  declare targetLanguageCode: string;
  declare status: CreationOptional<ConversationSessionStatus>;
  declare vocabSnapshot: CreationOptional<JsonValue>;
  declare promptVersion: CreationOptional<string | null>;
  declare providerConfigSnapshot: CreationOptional<JsonValue>;
  declare evaluationStatus: CreationOptional<EvaluationStatus>;
  declare rawProviderTranscript: CreationOptional<JsonValue>;
  declare normalizedTranscript: CreationOptional<JsonValue>;
  declare scoring: CreationOptional<JsonValue>;
  declare evaluatorProvider: CreationOptional<string | null>;
  declare evaluatorModel: CreationOptional<string | null>;
  declare evaluatorVersion: CreationOptional<string | null>;
  declare transcriptHash: CreationOptional<string | null>;
  declare evaluationAttemptCount: CreationOptional<number>;
  declare evaluationErrorCode: CreationOptional<string | null>;
  declare evaluationErrorMessage: CreationOptional<string | null>;
  declare webhookReceivedAt: CreationOptional<Date | null>;
  declare clientEndedAt: CreationOptional<Date | null>;
  declare evaluationStartedAt: CreationOptional<Date | null>;
  declare evaluationCompletedAt: CreationOptional<Date | null>;
  declare durationSeconds: CreationOptional<number | null>;
  declare costCents: CreationOptional<number | null>;
  declare startedAt: CreationOptional<Date | null>;
  declare endedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ConversationSession.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.STRING, allowNull: false },
    providerConversationId: { type: DataTypes.STRING, unique: true, allowNull: true },
    mode: { type: DataTypes.ENUM(...VOICE_MODES), allowNull: false },
    targetLanguageCode: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM(...CONVERSATION_SESSION_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    vocabSnapshot: { type: DataTypes.JSONB, allowNull: true },
    promptVersion: { type: DataTypes.STRING, allowNull: true },
    providerConfigSnapshot: { type: DataTypes.JSONB, allowNull: true },
    evaluationStatus: {
      type: DataTypes.ENUM(...EVALUATION_STATUSES),
      allowNull: false,
      defaultValue: 'not_started',
    },
    rawProviderTranscript: { type: DataTypes.JSONB, allowNull: true },
    normalizedTranscript: { type: DataTypes.JSONB, allowNull: true },
    scoring: { type: DataTypes.JSONB, allowNull: true },
    evaluatorProvider: { type: DataTypes.STRING, allowNull: true },
    evaluatorModel: { type: DataTypes.STRING, allowNull: true },
    evaluatorVersion: { type: DataTypes.STRING, allowNull: true },
    transcriptHash: { type: DataTypes.STRING, allowNull: true },
    evaluationAttemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    evaluationErrorCode: { type: DataTypes.STRING, allowNull: true },
    evaluationErrorMessage: { type: DataTypes.STRING, allowNull: true },
    webhookReceivedAt: { type: DataTypes.DATE, allowNull: true },
    clientEndedAt: { type: DataTypes.DATE, allowNull: true },
    evaluationStartedAt: { type: DataTypes.DATE, allowNull: true },
    evaluationCompletedAt: { type: DataTypes.DATE, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
    costCents: { type: DataTypes.INTEGER, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'conversationSession',
  },
);

export default ConversationSession;
