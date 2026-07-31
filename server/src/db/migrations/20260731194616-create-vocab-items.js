'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vocabItems', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        autoIncrement: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      targetLanguageCode: { type: Sequelize.STRING, allowNull: false },
      sourceText: { type: Sequelize.STRING, allowNull: false },
      term: { type: Sequelize.STRING, allowNull: false },
      termNormalized: { type: Sequelize.STRING, allowNull: false },
      itemType: { type: Sequelize.ENUM('word', 'phrase'), allowNull: false },
      partOfSpeech: { type: Sequelize.STRING, allowNull: true },
      translationSource: {
        type: Sequelize.ENUM('ai', 'user'),
        allowNull: false,
        defaultValue: 'ai',
      },
      familiarity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lastSeenAt: { type: Sequelize.DATE, allowNull: true },
      timesSeen: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      timesCorrect: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      timesIncorrect: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lastOutcome: { type: Sequelize.STRING, allowNull: true },
      nextDueAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex(
      'vocabItems',
      ['userId', 'targetLanguageCode', 'termNormalized'],
      {
        unique: true,
        name: 'vocab_items_user_lang_term_unique',
      },
    );
    await queryInterface.addIndex('vocabItems', ['userId', 'familiarity']);
    await queryInterface.addIndex('vocabItems', ['userId', 'nextDueAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vocabItems');
    // Drop the ENUM types Postgres created for the enum columns.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_vocabItems_itemType";');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_vocabItems_translationSource";',
    );
  },
};
