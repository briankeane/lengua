'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversationSessions', {
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
        // A session belongs to its user; deleting the user removes their sessions.
        onDelete: 'CASCADE',
      },
      provider: { type: Sequelize.STRING, allowNull: false },
      providerConversationId: { type: Sequelize.STRING, unique: true, allowNull: true },
      mode: { type: Sequelize.ENUM('quiz', 'weave'), allowNull: false },
      targetLanguageCode: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'failed', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      vocabSnapshot: { type: Sequelize.JSONB, allowNull: true },
      promptVersion: { type: Sequelize.STRING, allowNull: true },
      providerConfigSnapshot: { type: Sequelize.JSONB, allowNull: true },
      evaluationStatus: {
        type: Sequelize.ENUM(
          'not_started',
          'waiting_transcript',
          'pending',
          'ready',
          'failed',
          'expired',
        ),
        allowNull: false,
        defaultValue: 'not_started',
      },
      rawProviderTranscript: { type: Sequelize.JSONB, allowNull: true },
      normalizedTranscript: { type: Sequelize.JSONB, allowNull: true },
      scoring: { type: Sequelize.JSONB, allowNull: true },
      evaluatorProvider: { type: Sequelize.STRING, allowNull: true },
      evaluatorModel: { type: Sequelize.STRING, allowNull: true },
      evaluatorVersion: { type: Sequelize.STRING, allowNull: true },
      transcriptHash: { type: Sequelize.STRING, allowNull: true },
      evaluationAttemptCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      evaluationErrorCode: { type: Sequelize.STRING, allowNull: true },
      evaluationErrorMessage: { type: Sequelize.STRING, allowNull: true },
      webhookReceivedAt: { type: Sequelize.DATE, allowNull: true },
      clientEndedAt: { type: Sequelize.DATE, allowNull: true },
      evaluationStartedAt: { type: Sequelize.DATE, allowNull: true },
      evaluationCompletedAt: { type: Sequelize.DATE, allowNull: true },
      durationSeconds: { type: Sequelize.INTEGER, allowNull: true },
      costCents: { type: Sequelize.INTEGER, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      endedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('conversationSessions', ['userId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversationSessions');
    // Drop the ENUM types Postgres created for the enum columns.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conversationSessions_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conversationSessions_status";');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_conversationSessions_evaluationStatus";',
    );
  },
};
