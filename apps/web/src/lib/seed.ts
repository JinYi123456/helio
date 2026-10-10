/* Field-guide species: freeform mission tags map onto a small, collectible set.
   The meadow and the species dex are grown purely from verified walks. */

export type Species = { key: string; label: string; icon: string; match: RegExp };

export const SPECIES: Species[] = [
  { key: 'leaf',      label: 'Leaves',        icon: '🍂', match: /leaf|leaves|foliage|fern|frond/i },
  { key: 'flower',    label: 'Flowers',       icon: '🌼', match: /flower|bloom|petal|blossom/i },
  { key: 'bark',      label: 'Trees & bark',  icon: '🌳', match: /tree|bark|trunk|branch|canopy/i },
  { key: 'grass',     label: 'Grass',         icon: '🌱', match: /grass|sprout|sedge|lawn|weed/i },
  { key: 'pollinator',label: 'Pollinators',   icon: '🦋', match: /bee|butterfly|pollinat|insect|bug|moth/i },
  { key: 'bird',      label: 'Birds',         icon: '🐦', match: /bird|feather|nest|wing/i },
  { key: 'stone',     label: 'Stones',        icon: '🪨', match: /stone|rock|pebble|gravel|cobble/i },
  { key: 'water',     label: 'Water',         icon: '💧', match: /water|puddle|rain|stream|river|pond|sea/i },
  { key: 'sky',       label: 'Sky & light',   icon: '🌤️', match: /sky|cloud|sunset|sunlight|golden|light|shadow/i },
  { key: 'moss',      label: 'Moss & lichen', icon: '🌿', match: /moss|lichen|fungus|mushroom/i },
  { key: 'seed',      label: 'Seeds & fruit', icon: '🌰', match: /seed|acorn|fruit|berry|nut|pod/i },
  { key: 'trace',     label: 'Traces',        icon: '👣', match: /tracks|trace|trail|footprint|door|gate|path/i },
];

export function speciesFor(tags: string[]): Species | null {
  for (const t of tags) {
    const s = SPECIES.find((s) => s.match.test(t));
    if (s) return s;
  }
  return null;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PETALS = ['#e8734a', '#e8a33d', '#c65b8a', '#7e9b6b', '#d8b84a', '#8a6fc9'];

export type Bloom = { petals: number; color: string; core: string; stemH: number; lean: number; leaf: boolean };

export function bloomFor(seed: string): Bloom {
  const r = mulberry32(hashStr(seed));
  return {
    petals: 5 + Math.floor(r() * 4),
    color: PETALS[Math.floor(r() * PETALS.length)],
    core: r() > 0.5 ? '#e8a33d' : '#3f2b1d',
    stemH: 26 + r() * 26,
    lean: (r() - 0.5) * 14,
    leaf: r() > 0.35,
  };
}
