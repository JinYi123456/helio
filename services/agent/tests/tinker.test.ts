import { describe, it, expect } from 'vitest';
import { parseWhisperResponse, tinkerConfigured, whisperUserPrompt, USER_PREFIX } from '../src/lib/tinker.js';

describe('tinker whisper client', () => {
  it('is configured only when both key and sampler path exist', () => {
    expect(tinkerConfigured('', 'tinker://run/sampler')).toBe(false);
    expect(tinkerConfigured('tml-x', '')).toBe(false);
    expect(tinkerConfigured('tml-x', 'tinker://run/sampler')).toBe(true);
  });

  it('builds the same prompt contract the fine-tune was trained on', () => {
    const prompt = whisperUserPrompt({
      city: 'Petaling Jaya, MY',
      weekday: 'Sat',
      hour: 7,
      envs: ['street', 'park'],
      tMax: 31,
      precip: 12,
      tags: ['sprout', 'grass'],
      title: 'Pavement Rebels',
    });
    const [head, ctx] = prompt.split('\n');
    expect(head).toBe(USER_PREFIX);
    expect(JSON.parse(ctx)).toEqual({
      city: 'Petaling Jaya, MY',
      weekday: 'Sat',
      hour: 7,
      envs: ['street', 'park'],
      tMax: 31,
      precip: 12,
      tags: ['sprout', 'grass'],
      title: 'Pavement Rebels',
    });
  });

  it('parses an OpenAI-shaped completion and rejects junk', () => {
    const ok = { choices: [{ message: { content: 'Find the sprout that ignored the pavement.' } }] };
    expect(parseWhisperResponse(ok)).toBe('Find the sprout that ignored the pavement.');
    expect(parseWhisperResponse({ choices: [{ message: { content: 'hi' } }] })).toBeNull();
    expect(parseWhisperResponse({})).toBeNull();
    expect(parseWhisperResponse(null)).toBeNull();
  });
});
