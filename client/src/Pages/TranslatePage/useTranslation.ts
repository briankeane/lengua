import { useCallback, useEffect, useRef, useState } from 'react';
import { translate, TranslationDirection } from '../../Services/translateService';

export const DEBOUNCE_MS = 400;

export function useTranslation() {
  const [direction, setDirection] = useState<TranslationDirection>('en-es');
  const [inputText, setInputTextState] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Invalidate synchronously at the source of the input change, rather than
  // relying on the debounce effect's cleanup (which React defers until after
  // the render/paint) — closes the window where an in-flight response could
  // resolve after the user typed but before cleanup runs.
  const setInputText = useCallback((text: string) => {
    abortRef.current?.abort();
    requestIdRef.current++;
    setInputTextState(text);
  }, []);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const trimmed = inputText.trim();
    if (trimmed === '') {
      abortRef.current?.abort();
      setOutputText('');
      setError(null);
      setLoading(false);
      return;
    }

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);
      translate({ text: inputText, direction }, controller.signal)
        .then((result) => {
          if (requestId !== requestIdRef.current) return; // stale
          setOutputText(result.text);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return; // stale
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Translation failed');
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
    };
  }, [inputText, direction]);

  const swap = useCallback(() => {
    abortRef.current?.abort();
    requestIdRef.current++; // invalidate any in-flight response
    setDirection((prev) => (prev === 'en-es' ? 'es-en' : 'en-es'));
    setInputTextState(outputText);
    setOutputText('');
  }, [outputText]);

  return { direction, inputText, outputText, loading, error, setInputText, swap };
}
