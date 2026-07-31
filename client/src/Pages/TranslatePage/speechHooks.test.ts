import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechRecognition', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test globals
    delete window.SpeechRecognition;
    // @ts-expect-error cleanup test globals
    delete window.webkitSpeechRecognition;
  });

  it('reports unsupported when no SpeechRecognition constructor exists', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ locale: 'en-US', onFinalText: () => {} }),
    );
    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported and can start listening when available', () => {
    const start = vi.fn();
    const stop = vi.fn();
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = start;
      stop = stop;
    }
    // @ts-expect-error inject test global
    window.SpeechRecognition = FakeRecognition;

    const onFinalText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ locale: 'en-US', onFinalText }));
    expect(result.current.isSupported).toBe(true);
    act(() => result.current.toggle());
    expect(start).toHaveBeenCalled();
  });
});

describe('useSpeechSynthesis', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test globals
    delete window.speechSynthesis;
  });

  it('reports unsupported when speechSynthesis is absent', () => {
    const { result } = renderHook(() => useSpeechSynthesis({ locale: 'es-ES' }));
    expect(result.current.isSupported).toBe(false);
  });

  it('speaks text via the synthesis API when available', () => {
    const speak = vi.fn();
    // @ts-expect-error inject test global
    window.speechSynthesis = {
      speak,
      cancel: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    // @ts-expect-error inject test global
    window.SpeechSynthesisUtterance = class {
      lang = '';
      constructor(public text: string) {}
    };

    const { result } = renderHook(() => useSpeechSynthesis({ locale: 'es-ES' }));
    expect(result.current.isSupported).toBe(true);
    act(() => result.current.speak('hola'));
    expect(speak).toHaveBeenCalled();
  });
});
