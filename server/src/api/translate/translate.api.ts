import { NextFunction, Request, Response } from 'express';
import { translateText, TranslationDirection } from '../../lib/translate';

export async function handleTranslate(req: Request, res: Response, next: NextFunction) {
  try {
    const { text, direction } = req.body as { text: string; direction: TranslationDirection };
    const result = await translateText({ text, direction });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
