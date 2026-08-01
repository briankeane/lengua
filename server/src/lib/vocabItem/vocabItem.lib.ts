import { UniqueConstraintError } from 'sequelize';
import VocabItem from '../../db/models/vocabItem.model';

export interface SaveVocabItemInput {
  userId: string;
  targetLanguageCode: string;
  sourceText: string;
  targetText: string;
}

export interface SaveVocabItemResult {
  item: VocabItem;
  created: boolean;
}

function normalizeTargetText(targetText: string): string {
  return targetText.trim().normalize('NFC').toLowerCase();
}

export async function saveVocabItem(input: SaveVocabItemInput): Promise<SaveVocabItemResult> {
  const targetLanguageCode = input.targetLanguageCode.trim().toLowerCase();
  const targetTextNormalized = normalizeTargetText(input.targetText);
  const where = { userId: input.userId, targetLanguageCode, targetTextNormalized };

  const existing = await VocabItem.findOne({ where });
  if (existing) {
    return { item: existing, created: false };
  }

  try {
    const item = await VocabItem.create({
      userId: input.userId,
      targetLanguageCode,
      sourceText: input.sourceText,
      targetText: input.targetText,
      targetTextNormalized,
    });
    return { item, created: true };
  } catch (err) {
    // A concurrent insert won the race between findOne and create. The unique
    // index is the source of truth, so re-fetch and return the existing row.
    if (err instanceof UniqueConstraintError) {
      const item = await VocabItem.findOne({ where });
      if (item) {
        return { item, created: false };
      }
    }
    throw err;
  }
}
