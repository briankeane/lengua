import { describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import { translate } from './translateService';

describe('translateService', () => {
  it('POSTs to /v1/translate and returns the data', async () => {
    const spy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { text: 'hola', direction: 'en-es' } });

    const controller = new AbortController();
    const result = await translate({ text: 'hello', direction: 'en-es' }, controller.signal);

    expect(spy).toHaveBeenCalledWith(
      '/v1/translate',
      { text: 'hello', direction: 'en-es' },
      { signal: controller.signal },
    );
    expect(result).toEqual({ text: 'hola', direction: 'en-es' });
    spy.mockRestore();
  });
});
