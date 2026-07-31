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
      term: '¿Dónde está el baño?',
      termNormalized: 'donde esta el bano',
      itemType: 'phrase',
    });

    expect(item.id).to.be.a('string');
    expect(item.translationSource).to.equal('ai');
    expect(item.familiarity).to.equal(0);
    expect(item.timesSeen).to.equal(0);
  });

  it('enforces per-user uniqueness on (userId, targetLanguageCode, termNormalized)', async () => {
    const user = await createUser();
    const base = {
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      term: 'perro',
      termNormalized: 'perro',
      itemType: 'word' as const,
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

  it('allows the same normalized term for different users', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const shape = (userId: string) => ({
      userId,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      term: 'perro',
      termNormalized: 'perro',
      itemType: 'word' as const,
    });
    await VocabItem.create(shape(a.id));
    const second = await VocabItem.create(shape(b.id));
    expect(second.id).to.be.a('string');
  });
});
