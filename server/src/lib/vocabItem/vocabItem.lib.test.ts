import { expect } from 'chai';
import sinon from 'sinon';
import { UniqueConstraintError } from 'sequelize';
import VocabItem from '../../db/models/vocabItem.model';
import { saveVocabItem } from './vocabItem.lib';
import { createUser } from '../../test/testDataGenerator';

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
