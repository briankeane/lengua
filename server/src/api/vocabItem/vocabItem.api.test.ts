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
      assert.equal(res.body.userId, user.id);
      assert.equal(res.body.sourceText, 'the dog');
      assert.equal(res.body.targetText, 'el perro');
      assert.equal(res.body.targetTextNormalized, 'el perro');
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

      assert.equal(res.body.userId, user.id);
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
      assert.property(item, 'familiarity');
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
});
