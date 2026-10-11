import { describe, it, expect } from 'vitest';
import { fmtGeo, geoKey, isGeoKey, kmBetween, nearestBaked, resolveLocation } from '../src/lib/locate.js';

describe('geoKey formatting', () => {
  it('rounds coordinates to three decimals', () => {
    expect(geoKey(1.3521, 103.8198)).toBe('geo:1.352,103.82');
    expect(geoKey(-33.8688, 151.2093)).toBe('geo:-33.869,151.209');
  });

  it('avoids negative zero', () => {
    expect(geoKey(-0.0004, 0.0001)).toBe('geo:0,0');
  });

  it('recognises only well-formed geo keys', () => {
    expect(isGeoKey('geo:1.5,103.82')).toBe(true);
    expect(isGeoKey('geo:-33.87,151.21')).toBe(true);
    expect(isGeoKey('geo:abc,1')).toBe(false);
    expect(isGeoKey('petaling-jaya')).toBe(false);
    expect(isGeoKey(undefined)).toBe(false);
  });
});

describe('kmBetween / nearestBaked', () => {
  it('measures a known distance', () => {
    const km = kmBetween(3.139, 101.6869, 3.1073, 101.6067);
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(20);
  });

  it('picks the nearest baked sky', () => {
    expect(nearestBaked(3.139, 101.6869).key).toBe('petaling-jaya');
    expect(nearestBaked(47.6, -122.33).key).toBe('seattle');
    expect(nearestBaked(47.37, 8.54).key).toBe('zurich');
    expect(nearestBaked(1.3521, 103.8198).km).toBeGreaterThan(250);
  });
});

describe('resolveLocation', () => {
  const reverse = async () => 'Singapore, SG';

  it('uses the baked city when close', async () => {
    const r = await resolveLocation(3.139, 101.6869, reverse);
    expect(r.how).toBe('nearest-baked');
    expect(r.key).toBe('petaling-jaya');
    expect(r.label).toBe('Petaling Jaya, MY');
  });

  it('builds a live-coords key when far, named by reverse geocode', async () => {
    const r = await resolveLocation(1.3521, 103.8198, reverse);
    expect(r.how).toBe('live-coords');
    expect(r.key).toBe('geo:1.352,103.82');
    expect(r.label).toBe('Singapore, SG');
    expect(r.nearest.key).toBe('petaling-jaya');
  });

  it('falls back to formatted coordinates when the geocoder is dark', async () => {
    const r = await resolveLocation(-33.8688, 151.2093, async () => null);
    expect(r.how).toBe('live-coords');
    expect(r.label).toBe(fmtGeo(-33.8688, 151.2093));
  });
});
