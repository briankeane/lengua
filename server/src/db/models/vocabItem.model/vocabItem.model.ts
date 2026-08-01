import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

class VocabItem extends Model<InferAttributes<VocabItem>, InferCreationAttributes<VocabItem>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare targetLanguageCode: string;
  declare sourceText: string;
  declare targetText: string;
  declare targetTextNormalized: string;
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
    sourceText: { type: DataTypes.TEXT, allowNull: false },
    targetText: { type: DataTypes.TEXT, allowNull: false },
    targetTextNormalized: { type: DataTypes.TEXT, allowNull: false },
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
      { unique: true, fields: ['userId', 'targetLanguageCode', 'targetTextNormalized'] },
      { fields: ['userId', 'familiarity'] },
      { fields: ['userId', 'nextDueAt'] },
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
