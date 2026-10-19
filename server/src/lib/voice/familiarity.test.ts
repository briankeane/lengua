import { assert } from 'chai';
import { bucketFor } from './familiarity';

describe('Voice familiarity', function () {
  it('buckets 0-2 as new', function () {
    assert.equal(bucketFor(0), 'new');
    assert.equal(bucketFor(1), 'new');
    assert.equal(bucketFor(2), 'new');
  });

  it('buckets 3-5 as learning', function () {
    assert.equal(bucketFor(3), 'learning');
    assert.equal(bucketFor(4), 'learning');
    assert.equal(bucketFor(5), 'learning');
  });

  it('buckets 6-8 as known', function () {
    assert.equal(bucketFor(6), 'known');
    assert.equal(bucketFor(8), 'known');
  });

  it('clamps out-of-range values', function () {
    assert.equal(bucketFor(-1), 'new');
    assert.equal(bucketFor(99), 'known');
  });
});
