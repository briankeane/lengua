import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../security';
import { saveVocabItem, listVocabItems, serializeVocabItem } from '../../lib/vocabItem';
import { ValidationError } from '../../utils/errors';

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export async function handleCreateVocabItem(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { targetLanguageCode, sourceText, targetText } = req.body;
    const { item, created } = await saveVocabItem({
      userId: authReq.auth.id,
      targetLanguageCode,
      sourceText,
      targetText,
    });
    res.status(created ? 201 : 200).json(item);
  } catch (err) {
    next(err);
  }
}

export async function handleListVocabItems(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { targetLanguageCode, cursor } = req.query;
    const limit = parseLimit(req.query.limit);

    const { items, nextCursor } = await listVocabItems({
      userId: authReq.auth.id,
      limit,
      targetLanguageCode: typeof targetLanguageCode === 'string' ? targetLanguageCode : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.status(200).json({
      vocabItems: items.map(serializeVocabItem),
      pagination: { limit, nextCursor },
    });
  } catch (err) {
    next(err);
  }
}

function parseLimit(raw: unknown): number {
  if (raw === undefined) {
    return DEFAULT_LIST_LIMIT;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
    throw new ValidationError(
      `Invalid Value: limit must be an integer between 1 and ${MAX_LIST_LIMIT}`,
    );
  }
  return value;
}
