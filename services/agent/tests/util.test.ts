import { describe, it, expect } from 'vitest';
import { hashStr, looseJson, mulberry32 } from '../src/lib/util.js';

describe('looseJson', () => {
  it('parses clean json', () => {
    expect(looseJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });
  it('parses json in code fences', () => {
    expect(looseJson('```json\n{"a": 2}\n```')).toEqual({ a: 2 });
  });
  it('parses json wrapped in prose', () => {
    expect(looseJson('Sure! Here is the mission: {"title":"X","tags":[]} Hope that helps.')).toEqual({
      title: 'X',
      tags: [],
    });
  });
  it('returns null for prose with no json', () => {
    expect(looseJson('just some words')).toBeNull();
  });
  it('returns null for broken json', () => {
    expect(looseJson('{broken: tru')).toBeNull();
  });
});

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('hashStr differs for different strings', () => {
    expect(hashStr('helio')).not.toBe(hashStr('helio2'));
  });
});
