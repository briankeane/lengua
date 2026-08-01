import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../security';
import { saveVocabItem } from '../../lib/vocabItem';

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
