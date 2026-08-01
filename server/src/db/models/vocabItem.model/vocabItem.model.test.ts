import { expect } from 'chai';
import VocabItem from './vocabItem.model';
import { createUser } from '../../../test/testDataGenerator';

describe('VocabItem model', () => {
  it('creates an item with sensible defaults', async () => {
    const user = await createUser();
    const item = await VocabItem.create({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: "Where's the bathroom?",
      targetText: '¿Dónde está el baño?',
      targetTextNormalized: '¿dónde está el baño?',
    });

    expect(item.id).to.be.a('string');
    expect(item.familiarity).to.equal(0);
    expect(item.timesSeen).to.equal(0);
  });

  it('enforces per-user uniqueness on (userId, targetLanguageCode, targetTextNormalized)', async () => {
    const user = await createUser();
    const base = {
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      targetText: 'perro',
      targetTextNormalized: 'perro',
    };
    await VocabItem.create(base);
    let threw = false;
    try {
      await VocabItem.create(base);
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it('allows the same normalized target text for different users', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const shape = (userId: string) => ({
      userId,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      targetText: 'perro',
      targetTextNormalized: 'perro',
    });
    await VocabItem.create(shape(a.id));
    const second = await VocabItem.create(shape(b.id));
    expect(second.id).to.be.a('string');
  });
});
