'use client';

// Optional browser speech recognition for a short list of commands. Off by default.
// Note: in Chrome the audio is processed by the browser vendor's speech service.

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function ctor(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return !!ctor();
}

export const VOICE_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone permission was denied. Allow it in the browser’s site settings, or use your dictation tool in any text box.',
  'service-not-allowed': 'This browser blocked speech recognition. Your OS dictation still works in any text box.',
  'no-speech': 'Didn’t catch anything. Hold the button and try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs a network connection in this browser.',
  not_supported: 'This browser has no built-in speech recognition. Use Superwhisper or macOS Dictation in any text box instead.',
  aborted: '',
};

class VoiceInput {
  private rec: Rec | null = null;
  listening = false;

  start(onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void): void {
    const C = ctor();
    if (!C) {
      onEnd('not_supported');
      return;
    }
    try {
      this.rec?.abort();
    } catch {
      // ignore
    }
    const rec = new C();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let ended = false;
    rec.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = e.results[i].isFinal;
      }
      onText(text.trim(), final);
    };
    rec.onerror = (e) => {
      ended = true;
      this.listening = false;
      onEnd(e.error);
    };
    rec.onend = () => {
      this.listening = false;
      if (!ended) onEnd();
    };
    this.rec = rec;
    this.listening = true;
    rec.start();
  }

  stop(): void {
    try {
      this.rec?.stop();
    } catch {
      // ignore
    }
  }
}

export const voice = new VoiceInput();
