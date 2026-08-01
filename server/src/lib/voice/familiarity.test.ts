import { assert } from 'chai';
import { bucketFor } from './familiarity';

describe('Voice familiarity', function () {
  it('buckets 0-1 as new', function () {
    assert.equal(bucketFor(0), 'new');
    assert.equal(bucketFor(1), 'new');
  });

  it('buckets 2-3 as learning', function () {
    assert.equal(bucketFor(2), 'learning');
    assert.equal(bucketFor(3), 'learning');
  });

  it('buckets 4-5 as known', function () {
    assert.equal(bucketFor(4), 'known');
    assert.equal(bucketFor(5), 'known');
  });

  it('clamps out-of-range values', function () {
    assert.equal(bucketFor(-1), 'new');
    assert.equal(bucketFor(99), 'known');
  });
});
