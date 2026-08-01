import { assert } from 'chai';
import request from 'supertest';
import app from '../../server';
import VocabItem from '../../db/models/vocabItem.model';
import { createUserWithToken } from '../../test/testDataGenerator';

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

    it('returns 401 without authentication', async function () {
      await request(app).post('/v1/vocab-items').send(VALID_BODY).expect(401);
    });
  });
});
