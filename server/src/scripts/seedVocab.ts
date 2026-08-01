import User from '../db/models/user.model';
import VocabItem from '../db/models/vocabItem.model';

const SEED: Array<{ sourceText: string; term: string; itemType: 'word' | 'phrase' }> = [
  { sourceText: 'the dog', term: 'el perro', itemType: 'word' },
  { sourceText: 'to run', term: 'correr', itemType: 'word' },
  { sourceText: 'the house', term: 'la casa', itemType: 'word' },
  { sourceText: 'to eat', term: 'comer', itemType: 'word' },
  { sourceText: 'where is the bathroom?', term: '¿dónde está el baño?', itemType: 'phrase' },
  { sourceText: 'good morning', term: 'buenos días', itemType: 'phrase' },
];

function normalize(term: string): string {
  return term.trim().toLowerCase();
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node dist/scripts/seedVocab.js <userEmail>');
    process.exit(1);
  }
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  for (const s of SEED) {
    await VocabItem.findOrCreate({
      where: { userId: user.id, targetLanguageCode: 'es', termNormalized: normalize(s.term) },
      defaults: {
        userId: user.id,
        targetLanguageCode: 'es',
        sourceText: s.sourceText,
        term: s.term,
        termNormalized: normalize(s.term),
        itemType: s.itemType,
        translationSource: 'ai',
      },
    });
  }
  console.log(`Seeded ${SEED.length} Spanish vocab items for ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
