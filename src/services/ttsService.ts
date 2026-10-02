export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraph: number;
  totalParagraphs: number;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private paragraphs: string[] = [];
  private currentIndex: number = 0;
  private rate: number = 1.0;
  private stateChangeCallback: ((state: TTSState) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public setRate(newRate: number) {
    this.rate = newRate;
    if (this.utterance) {
      this.utterance.rate = newRate;
    }
  }

  public startReading(
    paragraphs: string[],
    startIndex: number = 0,
    rate: number = 1.0,
    onStateChange: (state: TTSState) => void
  ) {
    if (!this.synth) return;

    this.stop();
    this.paragraphs = paragraphs;
    this.currentIndex = startIndex;
    this.rate = rate;
    this.stateChangeCallback = onStateChange;

    this.speakCurrent();
  }

  private speakCurrent() {
    if (!this.synth || this.currentIndex >= this.paragraphs.length) {
      this.stop();
      return;
    }

    const text = this.paragraphs[this.currentIndex];
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = this.rate;
    
    // Find Vietnamese voice if available
    const voices = this.synth.getVoices();
    const viVoice = voices.find((v) => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) {
      this.utterance.voice = viVoice;
    }
    this.utterance.lang = 'vi-VN';

    this.utterance.onend = () => {
      this.currentIndex++;
      if (this.currentIndex < this.paragraphs.length) {
        this.speakCurrent();
      } else {
        this.stop();
      }
    };

    this.utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      this.stop();
    };

    this.synth.speak(this.utterance);
    this.notifyState(true, false);
  }

  public pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
      this.notifyState(true, true);
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.notifyState(true, false);
    }
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.utterance = null;
    this.notifyState(false, false);
  }

  private notifyState(isPlaying: boolean, isPaused: boolean) {
    if (this.stateChangeCallback) {
      this.stateChangeCallback({
        isPlaying,
        isPaused,
        currentParagraph: this.currentIndex,
        totalParagraphs: this.paragraphs.length,
      });
    }
  }
}

export const ttsService = new TTSService();
