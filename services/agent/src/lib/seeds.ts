import { hashStr, pick, mulberry32 } from './util.js';
import type { DayWindow } from './window.js';

/* Hand-written field missions. The model usually writes something better,
   but a seed this good means the day is never lost — no network, no server,
   no model, the mission still stands. */

export type MissionSeed = {
  envs: string[];
  title: string[];
  whisper: string[];
  proofCriteria: string;
  proofHint: string;
  durationMin: number;
  tags: string[];
};

export const SEEDS: MissionSeed[] = [
  {
    envs: ['street', 'park'],
    title: ['The Cracked Code', 'Pavement Rebels', 'Between the Stones'],
    whisper: [
      'Somewhere within two streets of you, a plant is losing a fight for its life — and winning.',
      'Pavement was not asked for permission. Find the sprout that ignored it.',
    ],
    proofCriteria: 'A small plant or grass sprout growing out of pavement, a crack, or a wall.',
    proofHint: 'Crouch low. Get the crack and the green in one frame.',
    durationMin: 10,
    tags: ['sprout', 'grass', 'weed', 'crack'],
  },
  {
    envs: ['park', 'garden', 'trail'],
    title: ['One Honest Leaf', 'The Two-Colour Leaf', 'Leaf Ledger'],
    whisper: [
      'Leaves keep records. Bring back one that is mid-sentence.',
      'Find a single leaf that has started to lie about the season.',
    ],
    proofCriteria: 'A close-up photo of one leaf, ideally showing colour change, veins, or texture.',
    proofHint: 'One leaf, filling a third of the frame. Backlight it if you can.',
    durationMin: 12,
    tags: ['leaf', 'foliage'],
  },
  {
    envs: ['garden', 'balcony', 'park'],
    title: ['Who Planted This?', 'The Volunteer', 'Nobody Watered This'],
    whisper: [
      'Find a flower nobody planted and nobody watered. It wants nothing from you.',
      'A volunteer bloom is somewhere near. Photograph it before it changes its mind.',
    ],
    proofCriteria: 'A photo of a flower — a bloom or blossom, wild or cultivated, with visible petals.',
    proofHint: 'Get close enough that a bee would feel crowded.',
    durationMin: 12,
    tags: ['flower', 'bloom', 'petal'],
  },
  {
    envs: ['trail', 'park'],
    title: ['Bark Study', 'Read the Trunk', 'The Oldest Standing Thing'],
    whisper: [
      'Find the oldest standing thing within walking distance. Touch its side, then photograph it honestly.',
      'Bark is a diary written in ridges. Find the tree that wrote today.',
    ],
    proofCriteria: 'A photo showing the bark or trunk of a tree — clear texture of ridges, plates, or rings.',
    proofHint: 'Fill the frame with bark. Steady your phone against the tree.',
    durationMin: 15,
    tags: ['bark', 'tree', 'trunk'],
  },
  {
    envs: ['waterside', 'street', 'park'],
    title: ['Still Water', 'The Puddle Oracle', 'Small Weather'],
    whisper: [
      'Yesterday is still here. Find water sitting in one place and photograph its ceiling.',
      'Find the smallest body of water you can be tall next to.',
    ],
    proofCriteria: 'A photo of water — a puddle, pond, stream, or lake — ideally showing reflection or surface texture.',
    proofHint: 'Kneel. Aim for the reflection, not the horizon.',
    durationMin: 10,
    tags: ['water', 'puddle', 'reflection'],
  },
  {
    envs: ['balcony', 'street', 'park', 'garden', 'trail'],
    title: ['Sky First', 'Look Up Tax', 'The Ceiling Problem'],
    whisper: [
      'You have underrated the ceiling you never look at. Sixty seconds, face up, then one photograph.',
      'The sky is free and today it has a mood about it.',
    ],
    proofCriteria: 'A photo pointing up — sky, clouds, sun, or light coming through leaves or branches.',
    proofHint: 'Point straight up. Include a leaf, branch, or building edge for scale.',
    durationMin: 8,
    tags: ['sky', 'cloud', 'sunlight'],
  },
  {
    envs: ['park', 'trail', 'waterside'],
    title: ["Feather Hunt", 'The Wind Left This', 'Small Relic'],
    whisper: [
      'Birds drop evidence everywhere. Bring me a feather, or at least its story.',
      'Something feathered, or someone feathered, is nearby. Find the trace.',
    ],
    proofCriteria: 'A photo of a bird, a feather, or clear evidence of a bird (nest, tracks, wing marks).',
    proofHint: 'Move slowly. Birds notice light and hurry.',
    durationMin: 15,
    tags: ['bird', 'feather'],
  },
  {
    envs: ['park', 'garden', 'trail'],
    title: ['Small Witness', 'The Worker', 'Six Legs, No Phone'],
    whisper: [
      'Someone nearby is working a double shift for no wage. Find them, thank them, photograph them.',
      'A bee or butterfly or beetle has time for you. Go.',
    ],
    proofCriteria: 'A photo of an insect — bee, butterfly, beetle, ant, or moth — visiting a plant if possible.',
    proofHint: 'Don\'t chase. Stand in a flower patch for a minute and let one land.',
    durationMin: 15,
    tags: ['bee', 'butterfly', 'pollinator'],
  },
  {
    envs: ['street', 'trail', 'park', 'waterside'],
    title: ['Stone Library', 'Read a Rock', 'The Patient Kind'],
    whisper: [
      'Pick up one stone. Read it like a stranger\'s resume. Put it back when you\'re done.',
      'Stones are just rocks that finished the course. Find a graduate.',
    ],
    proofCriteria: 'A close-up photo of a stone, rock, pebble, or gravel with visible texture or pattern.',
    proofHint: 'Wet stones read better. Rain helps, hands work too.',
    durationMin: 10,
    tags: ['stone', 'rock', 'pebble'],
  },
  {
    envs: ['trail', 'garden', 'park'],
    title: ['Moss Minute', 'The Quiet Room', 'Softer Than It Looks'],
    whisper: [
      'Moss only lives where the light is a suggestion. Find a patch and photograph it at its scale.',
      'There is a small green carpet somewhere in this city. Bring photo proof of its softness.',
    ],
    proofCriteria: 'A photo of moss, lichen, or a small patch of low green growth on stone, bark, or soil.',
    proofHint: 'Get within a hand\'s width. Fill the whole frame.',
    durationMin: 10,
    tags: ['moss', 'lichen'],
  },
  {
    envs: ['park', 'garden', 'trail', 'street'],
    title: ['Seed Courier', 'The Package', 'Nature\'s Parcel'],
    whisper: [
      'Trees are shipping the future by wind and squirrel. Intercept one package.',
      'Find a seed, pod, acorn, or berry. Don\'t keep it — just photograph it.',
    ],
    proofCriteria: 'A photo of seeds, a seed pod, acorn, nut, or berries — on the ground or on the branch.',
    proofHint: 'Look at the pavement under trees. Couriers drop things.',
    durationMin: 10,
    tags: ['seed', 'acorn', 'pod'],
  },
  {
    envs: ['street', 'park', 'trail'],
    title: ['Trace Reader', 'Left Behind', 'The Trail\'s Shortest Chapter'],
    whisper: [
      'Somebody passed here before you and left a mark. Find the trail, the prints, the gate that knows.',
      'Read one trace of somebody\'s journey — human, bird, or cat.',
    ],
    proofCriteria: 'A photo of traces — a trail or path, footprints, a gate, door, or worn steps outdoors.',
    proofHint: 'Look for wear: the wood people touch, the ground people cross.',
    durationMin: 12,
    tags: ['trace', 'trail', 'footprint'],
  },
];

export function seedMission(opts: {
  dateKey: string;
  cityKey: string;
  envs: string[];
  variant?: number;
  window?: DayWindow | null;
}): Omit<MissionSeed, 'envs' | 'title' | 'whisper'> & {
  title: string;
  whisper: string;
  whyNow: string;
  durationMin: number;
  tags: string[];
} {
  const { dateKey, cityKey, envs, variant = 0, window } = opts;
  const rng = mulberry32(hashStr(`${dateKey}|${cityKey}|${variant}`));
  const fitting = SEEDS.filter((s) => s.envs.some((e) => envs.includes(e)));
  const seed = pick(fitting.length ? fitting : SEEDS, rng);
  const title = pick(seed.title, rng);
  const whisper = pick(seed.whisper, rng);

  let whyNow = 'Any hour counts — the important thing is which hours you notice.';
  if (window) {
    const where = window.date === dateKey ? 'Today' : `On ${window.weekday}`;
    whyNow = `${where}, the grass window is ${window.label.split(' · ')[1] ?? window.label} — score ${window.score}/100 for ${window.tMax !== undefined ? `a ${Math.round(window.tMax)}° high` : 'the outdoors'}.`;
    if ((window.precip ?? 0) > 2) whyNow += ' Rain is around — take the dry slice, it is the best one.';
  }

  return { ...seed, title, whisper, whyNow };
}

export const TAG_VOCAB = [
  'grass', 'sprout', 'leaf', 'foliage', 'flower', 'bloom', 'bark', 'tree', 'bird', 'feather',
  'bee', 'butterfly', 'pollinator', 'stone', 'rock', 'water', 'puddle', 'sky', 'cloud', 'sunlight',
  'moss', 'lichen', 'seed', 'acorn', 'trace', 'trail',
];
