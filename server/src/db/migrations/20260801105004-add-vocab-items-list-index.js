'use strict';

/**
 * Indexes backing GET /v1/vocab-items keyset pagination.
 *
 * The list query is `WHERE userId = ? [AND targetLanguageCode = ?]
 * ORDER BY createdAt DESC, id DESC LIMIT n`. Postgres can scan a
 * (userId, createdAt, id) btree backwards to satisfy the DESC order without a
 * sort, and the language-scoped variant covers the filtered path. Both ORDER BY
 * columns live in the index so pagination stays O(page) as a user's vocab list
 * grows.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('vocabItems', ['userId', 'createdAt', 'id'], {
      name: 'vocab_items_user_created_id',
    });
    await queryInterface.addIndex(
      'vocabItems',
      ['userId', 'targetLanguageCode', 'createdAt', 'id'],
      { name: 'vocab_items_user_lang_created_id' },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('vocabItems', 'vocab_items_user_lang_created_id');
    await queryInterface.removeIndex('vocabItems', 'vocab_items_user_created_id');
  },
};
