import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { sha1 } from './util.js';

/* ElevenLabs voices the mission whisper once, then it lives on disk —
   the same trail, offline, replays the same voice without a network. */

export async function ensureAudio(text: string): Promise<string | null> {
  if (!config.elevenLabsKey || !text.trim()) return null;
  const file = `${sha1(`${config.elevenLabsVoice}|${text}`)}.mp3`;
  const path = join(config.audioCacheDir, file);
  try {
    await stat(path);
    return `/audio/${file}`;
  } catch {
    /* not cached yet */
  }
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenLabsKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.55, similarity_boost: 0.7, style: 0.15 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 512) return null;
    await mkdir(config.audioCacheDir, { recursive: true });
    await writeFile(path, bytes);
    return `/audio/${file}`;
  } catch {
    return null;
  }
}

export async function audioFile(name: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{40}\.mp3$/.test(name)) return null; // path traversal guard
  try {
    return await readFile(join(config.audioCacheDir, name));
  } catch {
    return null;
  }
}
