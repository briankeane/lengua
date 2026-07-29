'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'googleId', {
      type: Sequelize.STRING,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'googleId');
  },
};
