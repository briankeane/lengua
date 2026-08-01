import { expect } from 'chai';
import sinon from 'sinon';
import tk from 'timekeeper';
import { UniqueConstraintError } from 'sequelize';
import VocabItem from '../../db/models/vocabItem.model';
import { saveVocabItem, listVocabItems, serializeVocabItem } from './vocabItem.lib';
import { ValidationError } from '../../utils/errors';
import { createUser, createVocabItem } from '../../test/testDataGenerator';

describe('saveVocabItem', () => {
  afterEach(() => sinon.restore());

  it('creates a new item and reports created: true', async () => {
    const user = await createUser();
    const { item, created } = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'the dog',
      targetText: 'el perro',
    });

    expect(created).to.equal(true);
    expect(item.id).to.be.a('string');
    expect(item.userId).to.equal(user.id);
    expect(item.sourceText).to.equal('the dog');
    expect(item.targetText).to.equal('el perro');
  });

  it('normalizes targetText (trim + lowercase) and preserves accents', async () => {
    const user = await createUser();
    const { item } = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'the dog',
      targetText: '  El Perró  ',
    });

    expect(item.targetText).to.equal('  El Perró  ');
    expect(item.targetTextNormalized).to.equal('el perró');
  });

  it('canonicalizes targetLanguageCode to lowercase', async () => {
    const user = await createUser();
    const { item } = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'ES',
      sourceText: 'the dog',
      targetText: 'el perro',
    });

    expect(item.targetLanguageCode).to.equal('es');
  });

  it('returns the existing item (created: false) on a duplicate and does not overwrite sourceText', async () => {
    const user = await createUser();
    const first = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'the dog',
      targetText: 'el perro',
    });

    const second = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'ES',
      sourceText: 'the hound',
      targetText: '  El Perro  ',
    });

    expect(second.created).to.equal(false);
    expect(second.item.id).to.equal(first.item.id);
    expect(second.item.sourceText).to.equal('the dog');
    expect(await VocabItem.count({ where: { userId: user.id } })).to.equal(1);
  });

  it('treats composed and decomposed accents as the same term (NFC)', async () => {
    const user = await createUser();
    const composed = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'coffee',
      targetText: 'café', // composed é (U+00E9)
    });
    const decomposed = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'coffee',
      targetText: 'café', // e + combining acute
    });

    expect(decomposed.created).to.equal(false);
    expect(decomposed.item.id).to.equal(composed.item.id);
  });

  it('treats different accents as distinct terms', async () => {
    const user = await createUser();
    const a = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      targetText: 'perro',
    });
    const b = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      targetText: 'perró',
    });

    expect(b.created).to.equal(true);
    expect(b.item.id).to.not.equal(a.item.id);
  });

  it('treats a different targetLanguageCode as a non-duplicate', async () => {
    const user = await createUser();
    await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'the dog',
      targetText: 'perro',
    });
    const other = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'it',
      sourceText: 'the dog',
      targetText: 'perro',
    });

    expect(other.created).to.equal(true);
  });

  it('recovers from a concurrent insert race (UniqueConstraintError) by re-fetching', async () => {
    const user = await createUser();
    const existing = await createVocabItemRow(user.id);

    const findOne = sinon.stub(VocabItem, 'findOne');
    findOne.onFirstCall().resolves(null);
    findOne.onSecondCall().resolves(existing);
    sinon.stub(VocabItem, 'create').rejects(new UniqueConstraintError({ errors: [], fields: {} }));

    const { item, created } = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'the dog',
      targetText: 'el perro',
    });

    expect(created).to.equal(false);
    expect(item.id).to.equal(existing.id);
  });
});

async function createVocabItemRow(userId: string) {
  return VocabItem.create({
    userId,
    targetLanguageCode: 'es',
    sourceText: 'the dog',
    targetText: 'el perro',
    targetTextNormalized: 'el perro',
  });
}

// Seed `count` items for a user, one second apart, so createdAt ordering is
// deterministic. Returns them in insertion (oldest-first) order.
async function seedItems(
  userId: string,
  count: number,
  overrides: { targetLanguageCode?: string } = {},
): Promise<VocabItem[]> {
  const items: VocabItem[] = [];
  for (let i = 0; i < count; i += 1) {
    tk.freeze(new Date(`2026-01-26T10:00:${String(i).padStart(2, '0')}.000Z`));
    items.push(
      await createVocabItem({
        userId,
        targetText: `word-${i}`,
        ...overrides,
      }),
    );
  }
  return items;
}

describe('listVocabItems', () => {
  afterEach(() => {
    sinon.restore();
    tk.reset();
  });

  it("returns the user's items newest-first", async () => {
    const user = await createUser();
    const seeded = await seedItems(user.id, 3);

    const { items, nextCursor } = await listVocabItems({ userId: user.id, limit: 50 });

    expect(items.map((i) => i.id)).to.deep.equal([seeded[2].id, seeded[1].id, seeded[0].id]);
    expect(nextCursor).to.equal(null);
  });

  it('scopes results to the given user', async () => {
    const user = await createUser();
    const other = await createUser();
    await seedItems(user.id, 2);
    await seedItems(other.id, 3);

    const { items } = await listVocabItems({ userId: user.id, limit: 50 });

    expect(items).to.have.length(2);
    expect(items.every((i) => i.userId === user.id)).to.equal(true);
  });

  it('filters by targetLanguageCode (case-insensitive)', async () => {
    const user = await createUser();
    await seedItems(user.id, 2, { targetLanguageCode: 'es' });
    await seedItems(user.id, 3, { targetLanguageCode: 'it' });

    const { items } = await listVocabItems({
      userId: user.id,
      limit: 50,
      targetLanguageCode: 'IT',
    });

    expect(items).to.have.length(3);
    expect(items.every((i) => i.targetLanguageCode === 'it')).to.equal(true);
  });

  it('walks every item exactly once across cursor pages with no gaps or overlaps', async () => {
    const user = await createUser();
    const seeded = await seedItems(user.id, 5);
    const expectedOrder = [...seeded].reverse().map((i) => i.id);

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await listVocabItems({ userId: user.id, limit: 2, cursor });
      seen.push(...result.items.map((i) => i.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(seen).to.deep.equal(expectedOrder);
  });

  it('keeps ordering stable when items share a createdAt (id tiebreak)', async () => {
    const user = await createUser();
    tk.freeze(new Date('2026-01-26T10:00:00.000Z'));
    const a = await createVocabItem({ userId: user.id, targetText: 'word-a' });
    const b = await createVocabItem({ userId: user.id, targetText: 'word-b' });
    const c = await createVocabItem({ userId: user.id, targetText: 'word-c' });
    const expected = new Set([a.id, b.id, c.id]);

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await listVocabItems({ userId: user.id, limit: 1, cursor });
      seen.push(...result.items.map((i) => i.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(seen).to.have.length(3);
    expect(new Set(seen)).to.deep.equal(expected);
  });

  it('returns nextCursor null once the last item has been read', async () => {
    const user = await createUser();
    await seedItems(user.id, 4);

    const first = await listVocabItems({ userId: user.id, limit: 4 });
    expect(first.items).to.have.length(4);
    expect(first.nextCursor).to.equal(null);
  });

  it('throws ValidationError on a malformed cursor', async () => {
    const user = await createUser();
    await seedItems(user.id, 1);

    let thrown: unknown;
    try {
      await listVocabItems({ userId: user.id, limit: 50, cursor: 'not-a-real-cursor' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(ValidationError);
  });

  it('rejects a well-formed cursor whose id is not a UUID (would otherwise 500)', async () => {
    const user = await createUser();
    await seedItems(user.id, 1);
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: '2026-01-26T10:00:00.000Z', id: 'not-a-uuid' }),
      'utf8',
    ).toString('base64url');

    let thrown: unknown;
    try {
      await listVocabItems({ userId: user.id, limit: 50, cursor });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(ValidationError);
  });
});

describe('serializeVocabItem', () => {
  afterEach(() => tk.reset());

  it('omits internal fields (userId, targetTextNormalized)', async () => {
    const user = await createUser();
    const [item] = await seedItems(user.id, 1);

    const serialized = serializeVocabItem(item);

    expect(serialized).to.not.have.property('userId');
    expect(serialized).to.not.have.property('targetTextNormalized');
  });

  it('includes stats and nullable review fields', async () => {
    const user = await createUser();
    const [item] = await seedItems(user.id, 1);

    const serialized = serializeVocabItem(item);

    expect(serialized).to.include.keys([
      'id',
      'targetLanguageCode',
      'sourceText',
      'targetText',
      'familiarity',
      'lastSeenAt',
      'timesSeen',
      'timesCorrect',
      'timesIncorrect',
      'lastOutcome',
      'nextDueAt',
      'createdAt',
      'updatedAt',
    ]);
    expect(serialized.familiarity).to.equal(0);
    expect(serialized.lastSeenAt).to.equal(null);
    expect(serialized.nextDueAt).to.equal(null);
  });
});
