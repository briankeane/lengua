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
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seedVocab in production.');
    process.exit(1);
  }

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

  let created = 0;
  for (const s of SEED) {
    const [, wasCreated] = await VocabItem.findOrCreate({
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
    if (wasCreated) created += 1;
  }
  console.log(
    `Seeded ${created} new Spanish vocab items for ${email} (${SEED.length - created} already existed).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
