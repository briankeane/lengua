'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'firstName', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('users', 'lastName', {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('users', 'verifiedEmail', {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('users', 'passwordHash', {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'firstName');
    await queryInterface.removeColumn('users', 'lastName');
    await queryInterface.removeColumn('users', 'verifiedEmail');
    await queryInterface.removeColumn('users', 'passwordHash');
  },
};
