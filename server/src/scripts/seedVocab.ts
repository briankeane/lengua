import User from '../db/models/user.model';
import { saveVocabItem } from '../lib/vocabItem';

const SEED: Array<{ sourceText: string; targetText: string }> = [
  { sourceText: 'the dog', targetText: 'el perro' },
  { sourceText: 'to run', targetText: 'correr' },
  { sourceText: 'the house', targetText: 'la casa' },
  { sourceText: 'to eat', targetText: 'comer' },
  { sourceText: 'where is the bathroom?', targetText: '¿dónde está el baño?' },
  { sourceText: 'good morning', targetText: 'buenos días' },
];

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
    // saveVocabItem is idempotent per (user, language, normalized target text):
    // a repeat run returns the existing row with created=false.
    const { created: wasCreated } = await saveVocabItem({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: s.sourceText,
      targetText: s.targetText,
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
