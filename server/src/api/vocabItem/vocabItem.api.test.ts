import { assert } from 'chai';
import request from 'supertest';
import tk from 'timekeeper';
import app from '../../server';
import VocabItem from '../../db/models/vocabItem.model';
import { createUserWithToken, createVocabItem } from '../../test/testDataGenerator';

const VALID_BODY = {
  targetLanguageCode: 'es',
  sourceText: 'the dog',
  targetText: 'el perro',
};

describe('VocabItem API', function () {
  describe('POST /v1/vocab-items', function () {
    it('creates a new item and returns 201 with the saved item', async function () {
      const { user, token } = await createUserWithToken();

      const res = await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_BODY)
        .expect(201);

      assert.isString(res.body.id);
      assert.equal(res.body.sourceText, 'the dog');
      assert.equal(res.body.targetText, 'el perro');
      assert.notProperty(res.body, 'userId');
      assert.notProperty(res.body, 'targetTextNormalized');
      assert.equal(res.body.receptive.familiarity, 0);
      assert.equal(res.body.receptive.nextDueAt, null);
      assert.equal(res.body.productive.familiarity, 0);
      assert.notProperty(res.body, 'familiarity');

      const item = await VocabItem.findByPk(res.body.id);
      assert.equal(item?.userId, user.id);
    });

    it('returns 200 and the existing item on a duplicate save', async function () {
      const { token } = await createUserWithToken();

      const first = await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_BODY)
        .expect(201);

      const second = await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, sourceText: 'the hound' })
        .expect(200);

      assert.equal(second.body.id, first.body.id);
      assert.equal(second.body.sourceText, 'the dog');
    });

    it('owns the item to the authenticated user, ignoring userId in the body', async function () {
      const { user, token } = await createUserWithToken();

      const res = await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, userId: '00000000-0000-0000-0000-000000000000' })
        .expect(201);

      const item = await VocabItem.findByPk(res.body.id);
      assert.equal(item?.userId, user.id);
    });

    it('returns 400 when a required field is missing', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetLanguageCode: 'es', sourceText: 'the dog' })
        .expect(400);
    });

    it('returns 400 when targetText is empty/whitespace', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, targetText: '   ' })
        .expect(400);
    });

    it('returns 400 when sourceText is empty', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, sourceText: '' })
        .expect(400);
    });

    it('returns 400 when targetLanguageCode is empty', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, targetLanguageCode: '  ' })
        .expect(400);
    });

    it('returns 400 when targetText exceeds the max length', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, targetText: 'a'.repeat(513) })
        .expect(400);
    });

    it('returns 400 when targetLanguageCode exceeds the max length', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_BODY, targetLanguageCode: 'e'.repeat(21) })
        .expect(400);
    });

    it('returns 401 without authentication', async function () {
      await request(app).post('/v1/vocab-items').send(VALID_BODY).expect(401);
    });
  });

  describe('GET /v1/vocab-items', function () {
    afterEach(() => tk.reset());

    async function seed(userId: string, count: number, targetLanguageCode = 'es') {
      const items = [];
      for (let i = 0; i < count; i += 1) {
        tk.freeze(new Date(`2026-01-26T10:00:${String(i).padStart(2, '0')}.000Z`));
        items.push(await createVocabItem({ userId, targetLanguageCode, targetText: `word-${i}` }));
      }
      tk.reset();
      return items;
    }

    it("returns the user's items newest-first in an envelope", async function () {
      const { user, token } = await createUserWithToken();
      const seeded = await seed(user.id, 3);

      const res = await request(app)
        .get('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.isArray(res.body.vocabItems);
      assert.deepEqual(
        res.body.vocabItems.map((i: { id: string }) => i.id),
        [seeded[2].id, seeded[1].id, seeded[0].id],
      );
      assert.equal(res.body.pagination.limit, 50);
      assert.equal(res.body.pagination.nextCursor, null);
    });

    it('excludes internal fields from the serialized items', async function () {
      const { user, token } = await createUserWithToken();
      await seed(user.id, 1);

      const res = await request(app)
        .get('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const item = res.body.vocabItems[0];
      assert.property(item, 'targetText');
      assert.property(item, 'receptive');
      assert.property(item, 'productive');
      assert.equal(item.receptive.timesSeen, 0);
      assert.notProperty(item, 'familiarity');
      assert.notProperty(item, 'userId');
      assert.notProperty(item, 'targetTextNormalized');
    });

    it('only returns items owned by the authenticated user', async function () {
      const { user, token } = await createUserWithToken();
      const other = await createUserWithToken();
      await seed(user.id, 2);
      await seed(other.user.id, 3);

      const res = await request(app)
        .get('/v1/vocab-items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.vocabItems.length, 2);
    });

    it('filters by targetLanguageCode (case-insensitive)', async function () {
      const { user, token } = await createUserWithToken();
      await seed(user.id, 2, 'es');
      await seed(user.id, 3, 'it');

      const res = await request(app)
        .get('/v1/vocab-items?targetLanguageCode=IT')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.vocabItems.length, 3);
      assert.isTrue(
        res.body.vocabItems.every(
          (i: { targetLanguageCode: string }) => i.targetLanguageCode === 'it',
        ),
      );
    });

    it('pages through all items with the returned cursor', async function () {
      const { user, token } = await createUserWithToken();
      const seeded = await seed(user.id, 5);
      const expectedOrder = [...seeded].reverse().map((i) => i.id);

      const first = await request(app)
        .get('/v1/vocab-items?limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.equal(first.body.vocabItems.length, 2);
      assert.isString(first.body.pagination.nextCursor);

      const collected = [...first.body.vocabItems.map((i: { id: string }) => i.id)];
      let cursor = first.body.pagination.nextCursor;
      while (cursor) {
        const page = await request(app)
          .get(`/v1/vocab-items?limit=2&cursor=${encodeURIComponent(cursor)}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        collected.push(...page.body.vocabItems.map((i: { id: string }) => i.id));
        cursor = page.body.pagination.nextCursor;
      }

      assert.deepEqual(collected, expectedOrder);
    });

    it('returns 400 when limit exceeds the maximum', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items?limit=101')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 on a malformed cursor', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items?cursor=not-a-real-cursor')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 when cursor is repeated (parses to an array)', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items?cursor=a&cursor=b')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 when targetLanguageCode is repeated (parses to an array)', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items?targetLanguageCode=es&targetLanguageCode=it')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 on an unknown query parameter', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items?bogus=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 401 without authentication', async function () {
      await request(app).get('/v1/vocab-items').expect(401);
    });
  });

  describe('DELETE /v1/vocab-items/:vocabItemId', function () {
    it('deletes the item and returns 204', async function () {
      const { user, token } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app)
        .delete(`/v1/vocab-items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      assert.equal(await VocabItem.findByPk(item.id), null);
    });

    it('returns 404 when the item does not exist', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .delete('/v1/vocab-items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("returns 404 and does not delete another user's item", async function () {
      const { token } = await createUserWithToken();
      const other = await createUserWithToken();
      const item = await createVocabItem({ userId: other.user.id });

      await request(app)
        .delete(`/v1/vocab-items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      assert.notEqual(await VocabItem.findByPk(item.id), null);
    });

    it('returns 400 on a malformed id', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .delete('/v1/vocab-items/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 401 without authentication', async function () {
      const { user } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app).delete(`/v1/vocab-items/${item.id}`).expect(401);
    });
  });

  describe('GET /v1/vocab-items/review', function () {
    afterEach(() => tk.reset());

    it('returns 401 without authentication', async function () {
      await request(app).get('/v1/vocab-items/review').expect(401);
    });

    it('returns due cards (both tracks) with per-track dueCounts', async function () {
      const { user, token } = await createUserWithToken();
      // A brand-new card (both nextDueAt null) is due in both tracks.
      await createVocabItem({ userId: user.id, targetText: 'perro' });

      const res = await request(app)
        .get('/v1/vocab-items/review')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.deepEqual(res.body.dueCounts, { receptive: 1, productive: 1, total: 1 });
      assert.equal(res.body.reviewCards.length, 2);
      assert.deepEqual(res.body.reviewCards.map((c: { direction: string }) => c.direction).sort(), [
        'productive',
        'receptive',
      ]);
      const card = res.body.reviewCards[0];
      assert.containsAllKeys(card, [
        'vocabItemId',
        'direction',
        'sourceText',
        'targetText',
        'targetLanguageCode',
        'familiarity',
        'nextDueAt',
      ]);
    });

    it('filters reviewCards by direction but keeps dueCounts global', async function () {
      const { user, token } = await createUserWithToken();
      await createVocabItem({ userId: user.id, targetText: 'perro' });

      const res = await request(app)
        .get('/v1/vocab-items/review?direction=receptive')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.reviewCards.length, 1);
      assert.equal(res.body.reviewCards[0].direction, 'receptive');
      // dueCounts stay global regardless of the direction filter.
      assert.deepEqual(res.body.dueCounts, { receptive: 1, productive: 1, total: 1 });
    });

    it('orders most-overdue first (NULLs first, then due date ascending)', async function () {
      const { user, token } = await createUserWithToken();
      const now = Date.now();
      const future = new Date(now + 86400000);
      const a = await createVocabItem({ userId: user.id, targetText: 'a' });
      await a.update({ receptiveNextDueAt: new Date(now - 1000), productiveNextDueAt: future });
      const b = await createVocabItem({ userId: user.id, targetText: 'b' });
      await b.update({ receptiveNextDueAt: null, productiveNextDueAt: future });
      const c = await createVocabItem({ userId: user.id, targetText: 'c' });
      await c.update({ receptiveNextDueAt: new Date(now - 2000), productiveNextDueAt: future });

      const res = await request(app)
        .get('/v1/vocab-items/review?direction=receptive')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.deepEqual(
        res.body.reviewCards.map((x: { targetText: string }) => x.targetText),
        ['b', 'c', 'a'],
      );
    });

    it('caps reviewCards at limit but reports full dueCounts', async function () {
      const { user, token } = await createUserWithToken();
      for (let i = 0; i < 3; i += 1) {
        await createVocabItem({ userId: user.id, targetText: `word-${i}` });
      }

      const res = await request(app)
        .get('/v1/vocab-items/review?direction=receptive&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.equal(res.body.reviewCards.length, 2);
      assert.equal(res.body.dueCounts.receptive, 3);
    });

    it('returns 400 on an invalid direction', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items/review?direction=bogus')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 when limit exceeds the maximum', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items/review?limit=101')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 400 on an unknown query parameter', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .get('/v1/vocab-items/review?bogus=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('POST /v1/vocab-items/:vocabItemId/review', function () {
    afterEach(() => tk.reset());

    it('returns 401 without authentication', async function () {
      const { user } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .send({ direction: 'receptive', outcome: 'correct' })
        .expect(401);
    });

    it('grades one track, reschedules it, and leaves the other untouched', async function () {
      const { user, token } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });
      tk.freeze(new Date('2026-01-26T10:00:00.000Z'));

      const res = await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive', outcome: 'correct' })
        .expect(200);

      assert.equal(res.body.receptive.familiarity, 1);
      assert.equal(res.body.receptive.timesSeen, 1);
      assert.equal(res.body.receptive.timesCorrect, 1);
      assert.equal(res.body.receptive.timesIncorrect, 0);
      assert.equal(res.body.receptive.lastOutcome, 'correct');
      assert.equal(
        new Date(res.body.receptive.nextDueAt).getTime(),
        new Date('2026-01-27T10:00:00.000Z').getTime(),
      );
      // Productive track untouched.
      assert.equal(res.body.productive.familiarity, 0);
      assert.equal(res.body.productive.timesSeen, 0);
      assert.equal(res.body.productive.lastOutcome, null);
      assert.equal(res.body.productive.nextDueAt, null);
    });

    it('returns 400 on an invalid outcome', async function () {
      const { user, token } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive', outcome: 'bogus' })
        .expect(400);
    });

    it('returns 400 on an invalid direction (any is not a track)', async function () {
      const { user, token } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'any', outcome: 'correct' })
        .expect(400);
    });

    it('returns 400 when direction or outcome is missing', async function () {
      const { user, token } = await createUserWithToken();
      const item = await createVocabItem({ userId: user.id });

      await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive' })
        .expect(400);
    });

    it('returns 400 on a malformed id', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items/not-a-uuid/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive', outcome: 'correct' })
        .expect(400);
    });

    it("returns 404 and does not mutate another user's item", async function () {
      const { token } = await createUserWithToken();
      const other = await createUserWithToken();
      const item = await createVocabItem({ userId: other.user.id });

      await request(app)
        .post(`/v1/vocab-items/${item.id}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive', outcome: 'correct' })
        .expect(404);

      await item.reload();
      assert.equal(item.receptiveTimesSeen, 0);
    });

    it('returns 404 for a nonexistent item', async function () {
      const { token } = await createUserWithToken();

      await request(app)
        .post('/v1/vocab-items/00000000-0000-0000-0000-000000000000/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ direction: 'receptive', outcome: 'correct' })
        .expect(404);
    });
  });
});
