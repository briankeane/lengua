import { expect } from 'chai';
import sinon from 'sinon';
import tk from 'timekeeper';
import { UniqueConstraintError } from 'sequelize';
import VocabItem from '../../db/models/vocabItem.model';
import {
  saveVocabItem,
  listVocabItems,
  serializeVocabItem,
  deleteVocabItem,
  scheduleTrack,
  getReviewQueue,
  gradeReview,
  INCORRECT_RETRY_MS,
} from './vocabItem.lib';
import { NotFoundError, ValidationError } from '../../utils/errors';
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

describe('deleteVocabItem', () => {
  afterEach(() => {
    sinon.restore();
    tk.reset();
  });

  it('deletes the item owned by the user', async () => {
    const user = await createUser();
    const [item] = await seedItems(user.id, 1);

    await deleteVocabItem({ userId: user.id, vocabItemId: item.id });

    expect(await VocabItem.findByPk(item.id)).to.equal(null);
  });

  it('leaves the user other items untouched', async () => {
    const user = await createUser();
    const [first, second] = await seedItems(user.id, 2);

    await deleteVocabItem({ userId: user.id, vocabItemId: first.id });

    expect(await VocabItem.findByPk(second.id)).to.not.equal(null);
  });

  it('throws NotFoundError when the item does not exist', async () => {
    const user = await createUser();

    let thrown: unknown;
    try {
      await deleteVocabItem({
        userId: user.id,
        vocabItemId: '00000000-0000-0000-0000-000000000000',
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(NotFoundError);
  });

  it('throws NotFoundError (not deletion) when the item belongs to another user', async () => {
    const user = await createUser();
    const other = await createUser();
    const [item] = await seedItems(other.id, 1);

    let thrown: unknown;
    try {
      await deleteVocabItem({ userId: user.id, vocabItemId: item.id });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(NotFoundError);
    expect(await VocabItem.findByPk(item.id)).to.not.equal(null);
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

  it('nests SRS state under independent receptive and productive tracks', async () => {
    const user = await createUser();
    const [item] = await seedItems(user.id, 1);

    const serialized = serializeVocabItem(item);

    expect(serialized).to.include.keys([
      'id',
      'targetLanguageCode',
      'sourceText',
      'targetText',
      'receptive',
      'productive',
      'createdAt',
      'updatedAt',
    ]);
    expect(serialized).to.not.have.property('familiarity');
    for (const track of [serialized.receptive, serialized.productive]) {
      expect(track).to.include.keys([
        'familiarity',
        'nextDueAt',
        'lastSeenAt',
        'timesSeen',
        'timesCorrect',
        'timesIncorrect',
        'lastOutcome',
      ]);
      expect(track.familiarity).to.equal(0);
      expect(track.nextDueAt).to.equal(null);
      expect(track.lastSeenAt).to.equal(null);
      expect(track.lastOutcome).to.equal(null);
      expect(track.timesSeen).to.equal(0);
    }
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-26T10:00:00.000Z');

describe('scheduleTrack', () => {
  it('promotes one Leitner box and schedules the new box interval on correct', () => {
    expect(scheduleTrack(0, 'correct', NOW)).to.deep.equal({
      familiarity: 1,
      nextDueAt: new Date(NOW.getTime() + 1 * DAY_MS),
    });
    expect(scheduleTrack(2, 'correct', NOW)).to.deep.equal({
      familiarity: 3,
      nextDueAt: new Date(NOW.getTime() + 7 * DAY_MS),
    });
  });

  it('resets familiarity to 0 and reschedules 10 minutes out on incorrect', () => {
    expect(scheduleTrack(5, 'incorrect', NOW)).to.deep.equal({
      familiarity: 0,
      nextDueAt: new Date(NOW.getTime() + INCORRECT_RETRY_MS),
    });
  });

  it('caps familiarity at 8 and uses the 365-day interval', () => {
    expect(scheduleTrack(8, 'correct', NOW)).to.deep.equal({
      familiarity: 8,
      nextDueAt: new Date(NOW.getTime() + 365 * DAY_MS),
    });
  });
});

// Creates a card and sets each track's next-due date. `null` means the track has
// never been scheduled (due immediately); a Date sets an explicit due time.
async function createCard(
  userId: string,
  targetText: string,
  due: { receptive?: Date | null; productive?: Date | null } = {},
) {
  const item = await createVocabItem({ userId, targetText });
  await item.update({
    receptiveNextDueAt: due.receptive ?? null,
    productiveNextDueAt: due.productive ?? null,
  });
  return item;
}

describe('getReviewQueue', () => {
  beforeEach(() => tk.freeze(NOW));
  afterEach(() => tk.reset());

  const future = new Date(NOW.getTime() + DAY_MS);

  it('emits a card only for the tracks that are due', async () => {
    const user = await createUser();
    // receptive due (null), productive not due (future).
    await createCard(user.id, 'perro', { receptive: null, productive: future });

    const { reviewCards, dueCounts } = await getReviewQueue({
      userId: user.id,
      direction: 'any',
      limit: 20,
    });

    expect(reviewCards).to.have.length(1);
    expect(reviewCards[0].direction).to.equal('receptive');
    expect(dueCounts).to.deep.equal({ receptive: 1, productive: 0, total: 1 });
  });

  it('emits two entries for a card due in both tracks when direction=any', async () => {
    const user = await createUser();
    const card = await createCard(user.id, 'perro', { receptive: null, productive: null });

    const { reviewCards, dueCounts } = await getReviewQueue({
      userId: user.id,
      direction: 'any',
      limit: 20,
    });

    expect(reviewCards).to.have.length(2);
    expect(reviewCards.map((c) => c.direction)).to.have.members(['receptive', 'productive']);
    expect(reviewCards.every((c) => c.vocabItemId === card.id)).to.equal(true);
    expect(dueCounts).to.deep.equal({ receptive: 1, productive: 1, total: 1 });
  });

  it('filters by direction and returns only that track', async () => {
    const user = await createUser();
    await createCard(user.id, 'perro', { receptive: null, productive: null });

    const { reviewCards } = await getReviewQueue({
      userId: user.id,
      direction: 'productive',
      limit: 20,
    });

    expect(reviewCards).to.have.length(1);
    expect(reviewCards[0].direction).to.equal('productive');
  });

  it('orders most-overdue first (NULLs first, then due date ascending)', async () => {
    const user = await createUser();
    const older = new Date(NOW.getTime() - 2 * DAY_MS);
    const newer = new Date(NOW.getTime() - 1 * DAY_MS);
    await createCard(user.id, 'a', { receptive: newer });
    await createCard(user.id, 'b', { receptive: null });
    await createCard(user.id, 'c', { receptive: older });

    const { reviewCards } = await getReviewQueue({
      userId: user.id,
      direction: 'receptive',
      limit: 20,
    });

    expect(reviewCards.map((c) => c.targetText)).to.deep.equal(['b', 'c', 'a']);
  });

  it('caps reviewCards at limit but reports full dueCounts', async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i += 1) {
      await createCard(user.id, `word-${i}`, { receptive: null, productive: future });
    }

    const { reviewCards, dueCounts } = await getReviewQueue({
      userId: user.id,
      direction: 'receptive',
      limit: 2,
    });

    expect(reviewCards).to.have.length(2);
    expect(dueCounts.receptive).to.equal(3);
  });

  it('scopes the queue and counts to the given user', async () => {
    const user = await createUser();
    const other = await createUser();
    await createCard(user.id, 'perro');
    await createCard(other.id, 'gato');

    const { reviewCards, dueCounts } = await getReviewQueue({
      userId: user.id,
      direction: 'any',
      limit: 20,
    });

    expect(reviewCards.every((c) => c.vocabItemId !== undefined)).to.equal(true);
    expect(dueCounts.total).to.equal(1);
  });
});

describe('gradeReview', () => {
  beforeEach(() => tk.freeze(NOW));
  afterEach(() => tk.reset());

  it('mutates only the named track, reschedules it, and leaves the other untouched', async () => {
    const user = await createUser();
    const card = await createCard(user.id, 'perro');

    await gradeReview({
      userId: user.id,
      vocabItemId: card.id,
      direction: 'receptive',
      outcome: 'correct',
    });
    await card.reload();

    expect(card.receptiveFamiliarity).to.equal(1);
    expect(card.receptiveTimesSeen).to.equal(1);
    expect(card.receptiveTimesCorrect).to.equal(1);
    expect(card.receptiveTimesIncorrect).to.equal(0);
    expect(card.receptiveLastOutcome).to.equal('correct');
    expect(card.receptiveLastSeenAt?.getTime()).to.equal(NOW.getTime());
    expect(card.receptiveNextDueAt?.getTime()).to.equal(NOW.getTime() + DAY_MS);

    // Productive track untouched.
    expect(card.productiveFamiliarity).to.equal(0);
    expect(card.productiveTimesSeen).to.equal(0);
    expect(card.productiveLastOutcome).to.equal(null);
    expect(card.productiveNextDueAt).to.equal(null);
  });

  it('increments timesIncorrect and resets on an incorrect grade', async () => {
    const user = await createUser();
    const card = await createCard(user.id, 'perro');
    await card.update({ productiveFamiliarity: 4 });

    await gradeReview({
      userId: user.id,
      vocabItemId: card.id,
      direction: 'productive',
      outcome: 'incorrect',
    });
    await card.reload();

    expect(card.productiveFamiliarity).to.equal(0);
    expect(card.productiveTimesIncorrect).to.equal(1);
    expect(card.productiveNextDueAt?.getTime()).to.equal(NOW.getTime() + INCORRECT_RETRY_MS);
  });

  it('throws NotFoundError for a non-owned card and does not mutate it', async () => {
    const user = await createUser();
    const other = await createUser();
    const card = await createCard(other.id, 'perro');

    let thrown: unknown;
    try {
      await gradeReview({
        userId: user.id,
        vocabItemId: card.id,
        direction: 'receptive',
        outcome: 'correct',
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.instanceOf(NotFoundError);
    await card.reload();
    expect(card.receptiveTimesSeen).to.equal(0);
  });
});
