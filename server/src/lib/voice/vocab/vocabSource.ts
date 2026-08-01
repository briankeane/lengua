import VocabItemModel from '../../../db/models/vocabItem.model';
import { VocabItem } from '../types';

export const SESSION_WORD_COUNT = 6;

export async function getSessionVocab(input: {
  userId: string;
  targetLanguage: string;
}): Promise<VocabItem[]> {
  const rows = await VocabItemModel.findAll({
    where: { userId: input.userId, targetLanguageCode: input.targetLanguage },
    // Never-seen/due first, then lower familiarity, then least-recently seen.
    // createdAt + id are stable final tie-breakers so the same rows are picked
    // deterministically when the scheduling columns tie (e.g. a fresh learner
    // whose rows all share NULL nextDueAt/lastSeenAt).
    order: [
      ['nextDueAt', 'ASC NULLS FIRST'],
      ['familiarity', 'ASC'],
      ['lastSeenAt', 'ASC NULLS FIRST'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
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
