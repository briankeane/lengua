import { assert } from 'chai';
import { createUser } from '../../test/testDataGenerator';
import { getUser, updateUser } from './user.lib';

describe('User Lib', function () {
  describe('getUser', function () {
    it('returns a user by id', async function () {
      const user = await createUser({ firstName: 'Jane', lastName: 'Doe' });
      const found = await getUser(user.id);
      assert.equal(found.id, user.id);
      assert.equal(found.firstName, 'Jane');
      assert.equal(found.lastName, 'Doe');
    });

    it('throws NotFoundError for non-existent id', async function () {
      try {
        await getUser('00000000-0000-0000-0000-000000000000');
        assert.fail('should have thrown');
      } catch (err: unknown) {
        assert.equal((err as Error).constructor.name, 'NotFoundError');
      }
    });
  });

  describe('updateUser', function () {
    it('updates firstName', async function () {
      const user = await createUser({ firstName: 'Old' });
      const updated = await updateUser(user.id, { firstName: 'New' });
      assert.equal(updated.firstName, 'New');
    });

    it('updates lastName', async function () {
      const user = await createUser({ lastName: 'OldLast' });
      const updated = await updateUser(user.id, { lastName: 'NewLast' });
      assert.equal(updated.lastName, 'NewLast');
    });

    it('updates displayName', async function () {
      const user = await createUser({ displayName: 'OldDisplay' });
      const updated = await updateUser(user.id, { displayName: 'NewDisplay' });
      assert.equal(updated.displayName, 'NewDisplay');
    });

    it('updates profileImageUrl', async function () {
      const user = await createUser();
      const updated = await updateUser(user.id, {
        profileImageUrl: 'https://example.com/new.jpg',
      });
      assert.equal(updated.profileImageUrl, 'https://example.com/new.jpg');
    });

    it('throws NotFoundError for non-existent id', async function () {
      try {
        await updateUser('00000000-0000-0000-0000-000000000000', { firstName: 'Test' });
        assert.fail('should have thrown');
      } catch (err: unknown) {
        assert.equal((err as Error).constructor.name, 'NotFoundError');
      }
    });
  });
});
