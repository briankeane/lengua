import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

export const VOCAB_ITEM_TYPES = ['word', 'phrase'] as const;
export type VocabItemType = (typeof VOCAB_ITEM_TYPES)[number];

export const TRANSLATION_SOURCES = ['ai', 'user'] as const;
export type TranslationSource = (typeof TRANSLATION_SOURCES)[number];

class VocabItem extends Model<InferAttributes<VocabItem>, InferCreationAttributes<VocabItem>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare targetLanguageCode: string;
  declare sourceText: string;
  declare term: string;
  declare termNormalized: string;
  declare itemType: VocabItemType;
  declare partOfSpeech: CreationOptional<string | null>;
  declare translationSource: CreationOptional<TranslationSource>;
  declare familiarity: CreationOptional<number>;
  declare lastSeenAt: CreationOptional<Date | null>;
  declare timesSeen: CreationOptional<number>;
  declare timesCorrect: CreationOptional<number>;
  declare timesIncorrect: CreationOptional<number>;
  declare lastOutcome: CreationOptional<string | null>;
  declare nextDueAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

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
    sourceText: { type: DataTypes.STRING, allowNull: false },
    term: { type: DataTypes.STRING, allowNull: false },
    termNormalized: { type: DataTypes.STRING, allowNull: false },
    itemType: { type: DataTypes.ENUM(...VOCAB_ITEM_TYPES), allowNull: false },
    partOfSpeech: { type: DataTypes.STRING, allowNull: true },
    translationSource: {
      type: DataTypes.ENUM(...TRANSLATION_SOURCES),
      allowNull: false,
      defaultValue: 'ai',
    },
    familiarity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    timesSeen: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timesCorrect: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timesIncorrect: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastOutcome: { type: DataTypes.STRING, allowNull: true },
    nextDueAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'vocabItem',
    indexes: [
      { unique: true, fields: ['userId', 'targetLanguageCode', 'termNormalized'] },
      { fields: ['userId', 'familiarity'] },
      { fields: ['userId', 'nextDueAt'] },
    ],
  },
);

export default VocabItem;
