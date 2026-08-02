import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

// Receptive (see target word -> recall meaning) and productive (see meaning ->
// produce target word) are separate recall skills with separate retention
// curves, so each is scheduled as its own independent SRS track.
export const REVIEW_TRACKS = ['receptive', 'productive'] as const;
export type ReviewTrack = (typeof REVIEW_TRACKS)[number];

export const REVIEW_OUTCOMES = ['correct', 'incorrect'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

class VocabItem extends Model<InferAttributes<VocabItem>, InferCreationAttributes<VocabItem>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare targetLanguageCode: string;
  declare sourceText: string;
  declare targetText: string;
  declare targetTextNormalized: string;

  declare receptiveFamiliarity: CreationOptional<number>;
  declare receptiveNextDueAt: CreationOptional<Date | null>;
  declare receptiveLastSeenAt: CreationOptional<Date | null>;
  declare receptiveTimesSeen: CreationOptional<number>;
  declare receptiveTimesCorrect: CreationOptional<number>;
  declare receptiveTimesIncorrect: CreationOptional<number>;
  declare receptiveLastOutcome: CreationOptional<string | null>;

  declare productiveFamiliarity: CreationOptional<number>;
  declare productiveNextDueAt: CreationOptional<Date | null>;
  declare productiveLastSeenAt: CreationOptional<Date | null>;
  declare productiveTimesSeen: CreationOptional<number>;
  declare productiveTimesCorrect: CreationOptional<number>;
  declare productiveTimesIncorrect: CreationOptional<number>;
  declare productiveLastOutcome: CreationOptional<string | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

// Factories return a fresh definition object per attribute. Sequelize mutates
// each attribute definition during init (e.g. to record its `field`), so a
// shared object reference would collapse multiple attributes onto one column.
const intDefaultZero = () => ({ type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
const nullableDate = () => ({ type: DataTypes.DATE, allowNull: true });
const nullableString = () => ({ type: DataTypes.STRING, allowNull: true });

VocabItem.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    targetLanguageCode: { type: DataTypes.STRING, allowNull: false },
    sourceText: { type: DataTypes.TEXT, allowNull: false },
    targetText: { type: DataTypes.TEXT, allowNull: false },
    targetTextNormalized: { type: DataTypes.TEXT, allowNull: false },

    receptiveFamiliarity: intDefaultZero(),
    receptiveNextDueAt: nullableDate(),
    receptiveLastSeenAt: nullableDate(),
    receptiveTimesSeen: intDefaultZero(),
    receptiveTimesCorrect: intDefaultZero(),
    receptiveTimesIncorrect: intDefaultZero(),
    receptiveLastOutcome: nullableString(),

    productiveFamiliarity: intDefaultZero(),
    productiveNextDueAt: nullableDate(),
    productiveLastSeenAt: nullableDate(),
    productiveTimesSeen: intDefaultZero(),
    productiveTimesCorrect: intDefaultZero(),
    productiveTimesIncorrect: intDefaultZero(),
    productiveLastOutcome: nullableString(),

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'vocabItem',
    indexes: [
      { unique: true, fields: ['userId', 'targetLanguageCode', 'targetTextNormalized'] },
      // One per-track due-date index backs GET /v1/vocab-items/review ordering.
      { fields: ['userId', 'receptiveNextDueAt'] },
      { fields: ['userId', 'productiveNextDueAt'] },
      // Back GET /v1/vocab-items keyset pagination (ORDER BY createdAt DESC, id DESC).
      { name: 'vocab_items_user_created_id', fields: ['userId', 'createdAt', 'id'] },
      {
        name: 'vocab_items_user_lang_created_id',
        fields: ['userId', 'targetLanguageCode', 'createdAt', 'id'],
      },
    ],
  },
);

export default VocabItem;
