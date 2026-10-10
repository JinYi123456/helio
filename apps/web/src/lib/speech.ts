/* Whispers — Helio talks, so your eyes don't have to. */

let current: HTMLAudioElement | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const pref = ['Google UK English', 'Samantha', 'Microsoft Aria', 'Google US English', 'Zira'];
  for (const p of pref) {
    const v = voices.find((v) => v.name.includes(p));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith('en')) || voices[0];
}

function speechFallback(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.96;
  u.pitch = 0.92;
  const v = pickVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/** Play a whisper: prefer cached ElevenLabs audio, fall back to the browser's own voice. */
export async function whisper(text: string, audioUrl?: string | null, silent = false): Promise<void> {
  stopWhisper();
  if (silent) return;
  if (audioUrl) {
    try {
      current = new Audio(audioUrl);
      current.volume = 1;
      await current.play();
      return;
    } catch {
      /* autoplay blocked or offline — fall through */
    }
  }
  speechFallback(text);
}

export function stopWhisper(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
