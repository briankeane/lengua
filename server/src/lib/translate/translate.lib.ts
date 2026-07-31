import { ValidationError } from '../../utils/errors';
import { deeplProvider, TranslateProvider } from './deeplProvider';

export const TRANSLATION_DIRECTIONS = ['en-es', 'es-en'] as const;
export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

export const MAX_INPUT_LENGTH = 5000;

const DIRECTION_TO_DEEPL: Record<
  TranslationDirection,
  { source: 'EN' | 'ES'; target: 'EN' | 'ES' }
> = {
  'en-es': { source: 'EN', target: 'ES' },
  'es-en': { source: 'ES', target: 'EN' },
};

export type TranslateInput = { text: string; direction: TranslationDirection };
export type TranslateResult = { text: string; direction: TranslationDirection };

export async function translateText(
  { text, direction }: TranslateInput,
  provider: TranslateProvider = deeplProvider,
): Promise<TranslateResult> {
  if (typeof text !== 'string') {
    throw new ValidationError('text must be a string');
  }
  if (text.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(`text must be at most ${MAX_INPUT_LENGTH} characters`);
  }
  if (text.trim() === '') {
    return { text: '', direction };
  }
  const { source, target } = DIRECTION_TO_DEEPL[direction];
  const translated = await provider.translate({ text, sourceLang: source, targetLang: target });
  return { text: translated, direction };
}
