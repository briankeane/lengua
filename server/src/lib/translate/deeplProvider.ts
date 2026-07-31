import config from '../../config/config';
import { RateLimitError, ServerError, UpstreamError } from '../../utils/errors';

const DEEPL_TIMEOUT_MS = 8000;

export type TranslateProvider = {
  translate(input: {
    text: string;
    sourceLang: 'EN' | 'ES';
    targetLang: 'EN' | 'ES';
  }): Promise<string>;
};

function deeplBaseUrl(apiKey: string): string {
  // DeepL free-tier keys end with ":fx" and use the api-free host.
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

export const deeplProvider: TranslateProvider = {
  async translate({ text, sourceLang, targetLang }) {
    const apiKey = config.DEEPL_API_KEY;
    if (!apiKey) {
      throw new ServerError('DEEPL_API_KEY is not configured');
    }

    const body = new URLSearchParams({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    });

    let response: Response;
    try {
      response = await fetch(`${deeplBaseUrl(apiKey)}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(DEEPL_TIMEOUT_MS),
      });
    } catch {
      throw new UpstreamError('Translation provider request failed');
    }

    if (response.status === 429) {
      throw new RateLimitError('Translation provider rate limit exceeded');
    }
    if (!response.ok) {
      throw new UpstreamError('Translation provider returned an error');
    }

    let data: { translations?: { text: string }[] };
    try {
      data = (await response.json()) as { translations?: { text: string }[] };
    } catch {
      throw new UpstreamError('Translation provider returned an unexpected response');
    }
    const translated = data.translations?.[0]?.text;
    if (translated == null || typeof translated !== 'string') {
      throw new UpstreamError('Translation provider returned an unexpected response');
    }
    return translated;
  },
};
