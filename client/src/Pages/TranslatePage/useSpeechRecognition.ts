import { useEffect, useMemo, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition({
  locale,
  onFinalText,
}: {
  locale: string;
  onFinalText: (text: string) => void;
}) {
  const Ctor = useMemo(getRecognitionCtor, []);
  const isSupported = Ctor !== null;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        // Detach handlers first so events fired after stop/unmount are ignored.
        recognition.onresult = null;
        recognition.onend = null;
        recognition.stop();
      }
      recognitionRef.current = null;
      setIsListening(false);
    };
  }, [locale]);

  const toggle = () => {
    if (!Ctor) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last && last.isFinal) {
        onFinalText(last[0].transcript.trim());
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return { isSupported, isListening, toggle };
}
