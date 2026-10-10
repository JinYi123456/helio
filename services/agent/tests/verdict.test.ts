import { describe, it, expect } from 'vitest';
import { verdictFromRaw } from '../src/lib/vision.js';

describe('verdictFromRaw', () => {
  it('accepts a clean model verdict', () => {
    const v = verdictFromRaw(
      { passed: false, confidence: 0.2, seen: 'a keyboard, no plants', note: 'Close, but that is a desk.' },
      'gemma4:e2b · ollama',
      1234
    )!;
    expect(v.passed).toBe(false);
    expect(v.confidence).toBeCloseTo(0.2);
    expect(v.seen).toContain('keyboard');
    expect(v.ms).toBe(1234);
    expect(v.loose).toBeUndefined();
  });

  it('keeps a walker smiling when the model forgot the passed flag', () => {
    const v = verdictFromRaw({ seen: 'one wet leaf', note: 'That counts.' }, 'm', 10)!;
    expect(v.passed).toBe(true);
    expect(v.loose).toBe(true);
  });

  it('clamps silly confidence values', () => {
    const v = verdictFromRaw({ passed: true, confidence: 9, seen: 'grass', note: 'ok' }, 'm', 1)!;
    expect(v.confidence).toBe(1);
  });

  it('returns null for empty garbage', () => {
    expect(verdictFromRaw({}, 'm', 1)).toBeNull();
    expect(verdictFromRaw({ confidence: 0.5 }, 'm', 1)).toBeNull();
  });

  it('fills gentle defaults for missing prose', () => {
    const v = verdictFromRaw({ passed: true }, 'm', 1)!;
    expect(v.seen.length).toBeGreaterThan(3);
    expect(v.note.length).toBeGreaterThan(3);
  });
});
