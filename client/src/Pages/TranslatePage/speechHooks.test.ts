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

  it('stops recognition when the locale changes', () => {
    const start = vi.fn();
    const instances: { stop: ReturnType<typeof vi.fn> }[] = [];
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = start;
      stop = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    // @ts-expect-error inject test global
    window.SpeechRecognition = FakeRecognition;

    const onFinalText = vi.fn();
    const { result, rerender } = renderHook(
      ({ locale }) => useSpeechRecognition({ locale, onFinalText }),
      { initialProps: { locale: 'en-US' } },
    );
    act(() => result.current.toggle());
    expect(start).toHaveBeenCalled();
    expect(instances).toHaveLength(1);

    rerender({ locale: 'es-ES' });

    expect(instances[0].stop).toHaveBeenCalled();
  });

  it('does not throw and keeps isListening false when start() throws', () => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start = vi.fn(() => {
        throw new Error('InvalidStateError');
      });
      stop = vi.fn();
    }
    // @ts-expect-error inject test global
    window.SpeechRecognition = FakeRecognition;

    const onFinalText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ locale: 'en-US', onFinalText }));

    expect(() => act(() => result.current.toggle())).not.toThrow();
    expect(result.current.isListening).toBe(false);
  });

  it('resets isListening to false when the recognition instance fires onerror', () => {
    const instances: { onerror: (() => void) | null }[] = [];
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    // @ts-expect-error inject test global
    window.SpeechRecognition = FakeRecognition;

    const onFinalText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ locale: 'en-US', onFinalText }));

    act(() => result.current.toggle());
    expect(result.current.isListening).toBe(true);

    act(() => instances[0].onerror?.());

    expect(result.current.isListening).toBe(false);
  });
});

describe('useSpeechSynthesis', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test globals
    delete window.speechSynthesis;
    // @ts-expect-error cleanup test globals
    delete window.SpeechSynthesisUtterance;
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

  it('reports unsupported when SpeechSynthesisUtterance is absent and speak() does not throw', () => {
    // @ts-expect-error inject test global
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    // Intentionally no window.SpeechSynthesisUtterance assigned.

    const { result } = renderHook(() => useSpeechSynthesis({ locale: 'es-ES' }));
    expect(result.current.isSupported).toBe(false);
    expect(() => act(() => result.current.speak('hola'))).not.toThrow();
  });
});
