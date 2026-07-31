import { useEffect, useRef, useState } from 'react';

export function useSpeechSynthesis({ locale }: { locale: string }) {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [, setVoicesLoaded] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
      setVoicesLoaded(true);
    };
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
    };
  }, [isSupported]);

  const speak = (text: string) => {
    if (!isSupported || text.trim() === '') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    const prefix = locale.slice(0, 2).toLowerCase();
    const voice = voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  return { isSupported, speak };
}
