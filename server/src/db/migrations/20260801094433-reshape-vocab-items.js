'use strict';

/**
 * Reshape vocabItems:
 *  - rename `term` -> `targetText`, `termNormalized` -> `targetTextNormalized`
 *  - drop `translationSource`, `itemType` (provenance/type not acted on), `partOfSpeech`
 * The table has no data yet, so this is a clean forward migration.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('vocabItems', 'term', 'targetText');
    await queryInterface.renameColumn('vocabItems', 'termNormalized', 'targetTextNormalized');

    await queryInterface.removeColumn('vocabItems', 'translationSource');
    await queryInterface.removeColumn('vocabItems', 'itemType');
    await queryInterface.removeColumn('vocabItems', 'partOfSpeech');

    // Drop the ENUM types Postgres created for the removed enum columns.
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_vocabItems_translationSource";',
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_vocabItems_itemType";');

    // Keep the unique index name aligned with the renamed column.
    await queryInterface.sequelize.query(
      'ALTER INDEX "vocab_items_user_lang_term_unique" RENAME TO "vocab_items_user_lang_targettext_unique";',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER INDEX "vocab_items_user_lang_targettext_unique" RENAME TO "vocab_items_user_lang_term_unique";',
    );

    await queryInterface.addColumn('vocabItems', 'partOfSpeech', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add with a temporary default so rollback succeeds even if rows exist, then
    // drop the default to match the original schema (NOT NULL, no default).
    await queryInterface.addColumn('vocabItems', 'itemType', {
      type: Sequelize.ENUM('word', 'phrase'),
      allowNull: false,
      defaultValue: 'word',
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE "vocabItems" ALTER COLUMN "itemType" DROP DEFAULT;',
    );
    await queryInterface.addColumn('vocabItems', 'translationSource', {
      type: Sequelize.ENUM('ai', 'user'),
      allowNull: false,
      defaultValue: 'ai',
    });

    await queryInterface.renameColumn('vocabItems', 'targetTextNormalized', 'termNormalized');
    await queryInterface.renameColumn('vocabItems', 'targetText', 'term');
  },
};
