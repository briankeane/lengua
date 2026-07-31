import apiClient from './apiClient';

export type TranslationDirection = 'en-es' | 'es-en';

export interface TranslateResult {
  text: string;
  direction: TranslationDirection;
}

export async function translate(
  params: { text: string; direction: TranslationDirection },
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const response = await apiClient.post<TranslateResult>('/v1/translate', params, { signal });
  return response.data;
}
