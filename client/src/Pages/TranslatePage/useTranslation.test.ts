import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as translateService from '../../Services/translateService';
import { useTranslation } from './useTranslation';

describe('useTranslation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not call the service for blank input', async () => {
    const spy = vi.spyOn(translateService, 'translate');
    const { result } = renderHook(() => useTranslation());
    act(() => result.current.setInputText('   '));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.outputText).toBe('');
  });

  it('debounces typing into a single call and shows the result', async () => {
    const spy = vi
      .spyOn(translateService, 'translate')
      .mockResolvedValue({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('h'));
    act(() => result.current.setInputText('he'));
    act(() => result.current.setInputText('hello'));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    // Note: not wrapped in waitFor — @testing-library/dom's fake-timer
    // detection only recognizes Jest, so waitFor's internal polling never
    // advances under vi.useFakeTimers() and hangs until the test timeout.
    // The resolved-promise state update is already flushed synchronously
    // by the awaited act() block above, so a direct assertion is correct.
    expect(result.current.outputText).toBe('hola');
  });

  it('ignores a stale response that resolves after a newer one', async () => {
    const resolvers: Array<(v: { text: string; direction: 'en-es' }) => void> = [];
    vi.spyOn(translateService, 'translate').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve as (v: { text: string; direction: 'en-es' }) => void);
        }),
    );
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('one'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.setInputText('two'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Resolve the NEWER request first, then the stale older one.
    await act(async () => {
      resolvers[1]({ text: 'dos', direction: 'en-es' });
    });
    await act(async () => {
      resolvers[0]({ text: 'uno', direction: 'en-es' });
    });

    expect(result.current.outputText).toBe('dos');
  });

  it('invalidates an in-flight request immediately when input changes before it resolves', async () => {
    const resolvers: Array<(v: { text: string; direction: 'en-es' }) => void> = [];
    vi.spyOn(translateService, 'translate').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve as (v: { text: string; direction: 'en-es' }) => void);
        }),
    );
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('one'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    // Request #1 is now in-flight.

    act(() => result.current.setInputText('two'));
    // Still inside the new debounce window: request #2's timer hasn't fired yet.

    // Resolve the stale request #1 while it should already be invalidated.
    await act(async () => {
      resolvers[0]({ text: 'uno', direction: 'en-es' });
    });

    expect(result.current.outputText).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await act(async () => {
      resolvers[1]({ text: 'dos', direction: 'en-es' });
    });

    expect(result.current.outputText).toBe('dos');
  });

  it('clears stale output immediately when input changes after a successful translation', async () => {
    vi.spyOn(translateService, 'translate').mockResolvedValue({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('hello'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.outputText).toBe('hola');

    act(() => result.current.setInputText('goodbye'));

    expect(result.current.outputText).toBe('');
  });

  it('clears output and does not leave a stale translation when a request fails', async () => {
    const spy = vi.spyOn(translateService, 'translate');
    spy.mockResolvedValueOnce({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('hello'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.outputText).toBe('hola');

    spy.mockRejectedValueOnce(new Error('boom'));
    act(() => result.current.setInputText('goodbye'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.outputText).toBe('');
  });

  it('swap flips direction and moves output into input', async () => {
    vi.spyOn(translateService, 'translate').mockResolvedValue({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('hello'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.outputText).toBe('hola');

    act(() => result.current.swap());

    expect(result.current.direction).toBe('es-en');
    expect(result.current.inputText).toBe('hola');
  });
});
