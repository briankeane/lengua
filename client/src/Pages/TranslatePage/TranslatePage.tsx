import './TranslatePage.css';
import { useTranslation } from './useTranslation';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';

const DIRECTION_LABELS = {
  'en-es': { input: 'English', output: 'Spanish', micLocale: 'en-US', speakLocale: 'es-ES' },
  'es-en': { input: 'Spanish', output: 'English', micLocale: 'es-ES', speakLocale: 'en-US' },
} as const;

export default function TranslatePage() {
  const { direction, inputText, outputText, loading, error, setInputText, swap } = useTranslation();
  const labels = DIRECTION_LABELS[direction];

  const recognition = useSpeechRecognition({
    locale: labels.micLocale,
    onFinalText: setInputText,
  });
  const synthesis = useSpeechSynthesis({ locale: labels.speakLocale });

  return (
    <div className="translate-page">
      <section className="translate-card translate-card--input">
        <label className="translate-card__label" htmlFor="translate-input">
          {labels.input}
        </label>
        <textarea
          id="translate-input"
          className="translate-card__text"
          aria-label={labels.input}
          placeholder={`Type or speak ${labels.input}`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <div className="translate-card__actions">
          {recognition.isSupported && (
            <button
              type="button"
              className="translate-mic"
              aria-label={`Speak ${labels.input}`}
              aria-pressed={recognition.isListening}
              onClick={recognition.toggle}
            >
              🎤
            </button>
          )}
        </div>
      </section>

      <button type="button" className="translate-swap" aria-label="Swap languages" onClick={swap}>
        ⇅
      </button>

      <section className="translate-card translate-card--output">
        <span className="translate-card__label">{labels.output}</span>
        <div className="translate-card__text translate-card__text--output">
          {loading ? '…' : outputText}
        </div>
        <div className="translate-card__actions">
          <button
            type="button"
            className="translate-speaker"
            aria-label={`Listen in ${labels.output}`}
            disabled={!synthesis.isSupported || outputText.trim() === ''}
            onClick={() => synthesis.speak(outputText)}
          >
            🔊
          </button>
        </div>
      </section>

      {error && <p className="translate-error">{error}</p>}
    </div>
  );
}
