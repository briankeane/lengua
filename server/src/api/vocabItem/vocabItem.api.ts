import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../security';
import {
  saveVocabItem,
  listVocabItems,
  deleteVocabItem,
  serializeVocabItem,
} from '../../lib/vocabItem';
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
    const limit = parseLimit(req.query.limit);

    const { items, nextCursor } = await listVocabItems({
      userId: authReq.auth.id,
      limit,
      targetLanguageCode: singleStringParam(req.query.targetLanguageCode, 'targetLanguageCode'),
      cursor: singleStringParam(req.query.cursor, 'cursor'),
    });

    res.status(200).json({
      vocabItems: items.map(serializeVocabItem),
      pagination: { limit, nextCursor },
    });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteVocabItem(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    await deleteVocabItem({
      userId: authReq.auth.id,
      vocabItemId: req.params.vocabItemId as string,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// A repeated query param (e.g. ?cursor=a&cursor=b) parses to an array. Reject it
// rather than silently coercing to undefined, which would quietly restart
// pagination or drop the language filter instead of surfacing the bad request.
function singleStringParam(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`Invalid Value: ${name} must be a single value`);
  }
  return value;
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
