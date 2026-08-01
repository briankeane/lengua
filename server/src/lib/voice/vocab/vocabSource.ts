import VocabItemModel from '../../../db/models/vocabItem.model';
import { VocabItem } from '../types';

export const SESSION_WORD_COUNT = 6;

export async function getSessionVocab(input: {
  userId: string;
  targetLanguage: string;
}): Promise<VocabItem[]> {
  const rows = await VocabItemModel.findAll({
    where: { userId: input.userId, targetLanguageCode: input.targetLanguage },
    order: [
      ['nextDueAt', 'ASC NULLS FIRST'],
      ['familiarity', 'ASC'],
      ['lastSeenAt', 'ASC NULLS FIRST'],
    ],
    limit: SESSION_WORD_COUNT,
  });

  return rows.map((r) => ({
    id: r.id,
    sourceText: r.sourceText,
    term: r.term,
    itemType: r.itemType,
    partOfSpeech: r.partOfSpeech ?? null,
    familiarity: r.familiarity,
  }));
}
