'use strict';

/**
 * Split the single, unused SRS column set on vocabItems into two independent
 * per-track sets: `receptive*` (see target word -> recall meaning) and
 * `productive*` (see meaning -> produce target word). Each track carries its
 * own familiarity + due date so the two recall skills schedule independently.
 *
 * The table has no real SRS data yet (every column is at its default), so this
 * is a lossless forward migration. Wrapped in a transaction so a partial failure
 * never leaves a half-reshaped schema.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TRACKS = ['receptive', 'productive'];

// The seven single-track columns being replaced, with the definitions used to
// restore them on `down`.
const OLD_COLUMNS = {
  familiarity: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  lastSeenAt: { type: 'DATE', allowNull: true },
  timesSeen: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  timesCorrect: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  timesIncorrect: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  lastOutcome: { type: 'STRING', allowNull: true },
  nextDueAt: { type: 'DATE', allowNull: true },
};

// Suffixes appended to each track prefix, mirroring OLD_COLUMNS.
const TRACK_COLUMNS = {
  Familiarity: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  NextDueAt: { type: 'DATE', allowNull: true },
  LastSeenAt: { type: 'DATE', allowNull: true },
  TimesSeen: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  TimesCorrect: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  TimesIncorrect: { type: 'INTEGER', allowNull: false, defaultValue: 0 },
  LastOutcome: { type: 'STRING', allowNull: true },
};

function spec(Sequelize, def) {
  return {
    type: Sequelize[def.type],
    allowNull: def.allowNull,
    ...(def.defaultValue !== undefined ? { defaultValue: def.defaultValue } : {}),
  };
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // The old due-date/familiarity indexes reference columns we are about to
      // drop; remove them first.
      await queryInterface.removeIndex('vocabItems', ['userId', 'familiarity'], { transaction });
      await queryInterface.removeIndex('vocabItems', ['userId', 'nextDueAt'], { transaction });

      for (const name of Object.keys(OLD_COLUMNS)) {
        await queryInterface.removeColumn('vocabItems', name, { transaction });
      }

      for (const track of TRACKS) {
        for (const [suffix, def] of Object.entries(TRACK_COLUMNS)) {
          await queryInterface.addColumn('vocabItems', `${track}${suffix}`, spec(Sequelize, def), {
            transaction,
          });
        }
      }

      // Back the review due-queue: WHERE userId = ? AND {track}NextDueAt due
      // ORDER BY {track}NextDueAt, one index per track.
      await queryInterface.addIndex('vocabItems', ['userId', 'receptiveNextDueAt'], {
        transaction,
      });
      await queryInterface.addIndex('vocabItems', ['userId', 'productiveNextDueAt'], {
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('vocabItems', ['userId', 'receptiveNextDueAt'], {
        transaction,
      });
      await queryInterface.removeIndex('vocabItems', ['userId', 'productiveNextDueAt'], {
        transaction,
      });

      for (const track of TRACKS) {
        for (const suffix of Object.keys(TRACK_COLUMNS)) {
          await queryInterface.removeColumn('vocabItems', `${track}${suffix}`, { transaction });
        }
      }

      for (const [name, def] of Object.entries(OLD_COLUMNS)) {
        await queryInterface.addColumn('vocabItems', name, spec(Sequelize, def), { transaction });
      }

      await queryInterface.addIndex('vocabItems', ['userId', 'familiarity'], { transaction });
      await queryInterface.addIndex('vocabItems', ['userId', 'nextDueAt'], { transaction });
    });
  },
};
