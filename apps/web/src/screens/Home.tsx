import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { Mission } from '../lib/types';
import { api } from '../lib/api';
import * as db from '../lib/db';
import { cityCoords, cityLabelOf } from '../lib/geo';
import { whisper } from '../lib/speech';
import { SunDial } from '../components/SunDial';
import { SeedCard } from '../components/SeedCard';
import { SkyStrip } from '../components/SkyStrip';
import { IconDial, IconJournal, IconMeadow, IconGear, IconWhisper, IconRefresh, IconArrow, IconLeaf } from '../components/Icons';

export function Home() {
  const { settings, mission, setMission, windows, walks, health, go, today, loaded } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const city = cityCoords(settings);

  const doneToday = !!mission && walks.some((w) => w.missionId === mission.id);
  const weekWalks = useMemo(
    () => walks.filter((w) => Date.now() - w.ts < 7 * 864e5).length,
    [walks]
  );

  const inflight = useRef(false);

  const fetchMission = useCallback(
    async (regen = false) => {
      if (inflight.current) return;
      inflight.current = true;
      setBusy(true);
      setErr(null);
      try {
        const m = await api.mission(settings, {
          cityKey: settings.cityKey,
          cityLabel: cityLabelOf(settings),
          envs: settings.envs,
          dateKey: today,
          history: walks.slice(0, 8).map((w) => w.missionTitle),
          regenerate: regen,
          name: settings.name,
        });
        await db.putMission(m);
        setMission(m);
      } catch {
        const local = localSeed(today, regen ? 1 : 0);
        setErr('offline — a hand-written seed instead');
        setMission(local);
      } finally {
        inflight.current = false;
        setBusy(false);
      }
    },
    [settings, today, walks, setMission]
  );

  useEffect(() => {
    if (!loaded) return;
    if (!mission || mission.dateKey !== today) void fetchMission(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, today]);

  const state: 'ready' | 'waiting' | 'bloomed' = doneToday ? 'bloomed' : mission ? 'ready' : 'waiting';

  return (
    <div className="home">
      <header className="topbar">
        <div className="wordmark" onClick={() => go('about')}>
          <IconLeaf size={18} /> helio
        </div>
        <div className="topbar__right">
          <span className="chip chip--stat">{weekWalks} walks · 7d</span>
          {health && (
            <span className={`dot ${health.ok ? 'dot--on' : 'dot--off'}`} title={health.engine ?? 'offline'} />
          )}
        </div>
      </header>

      <div className="home__dialwrap">
        <SunDial windows={windows} lat={city.lat} lon={city.lon} state={state} onOpen={() => mission && go('door')} />
      </div>

      <SkyStrip days={windows} today={today} />

      <div className="home__panel">
        {err && <p className="note note--offline">{err}</p>}

        {mission ? (
          <>
            <SeedCard mission={mission} />
            {doneToday ? (
              <div className="home__done">
                <span className="home__done-kicker">seed bloomed today</span>
                <div className="row">
                  <button className="btn btn--ghost" onClick={() => void fetchMission(true)}>
                    <IconRefresh size={17} /> another seed
                  </button>
                  <button className="btn btn--ghost" onClick={() => go('journal')}>
                    <IconJournal size={17} /> field journal
                  </button>
                </div>
              </div>
            ) : (
              <div className="home__cta">
                <button className="btn btn--primary btn--big" onClick={() => go('door')} disabled={busy}>
                  open the door <IconArrow size={19} />
                </button>
                <div className="row row--spread">
                  <button
                    className="btn btn--quiet"
                    onClick={() => void whisper(mission.whisper, mission.audioUrl, !settings.voiceOn)}
                  >
                    <IconWhisper size={17} /> whisper it
                  </button>
                  <button className="btn btn--quiet" onClick={() => void fetchMission(true)} disabled={busy}>
                    <IconRefresh size={17} /> {busy ? '…' : 'another seed'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button className="btn btn--primary btn--big" onClick={() => void fetchMission(false)} disabled={busy}>
            {busy ? 'helio is thinking…' : 'ask for today’s seed'} <IconArrow size={19} />
          </button>
        )}

        {mission?.whyNow && !doneToday && <p className="home__why">why now: {mission.whyNow}</p>}
      </div>

      <nav className="nav">
        <button className="nav__item nav__item--on" onClick={() => go('home')}><IconDial /><span>dial</span></button>
        <button className="nav__item" onClick={() => go('journal')}><IconJournal /><span>journal</span></button>
        <button className="nav__item" onClick={() => go('bloom')}><IconMeadow /><span>meadow</span></button>
        <button className="nav__item" onClick={() => go('settings')}><IconGear /><span>settings</span></button>
      </nav>
    </div>
  );
}

const LOCAL_SEEDS: Omit<Mission, 'id' | 'dateKey' | 'createdAt' | 'engine'>[] = [
  { title: 'a plant winning against concrete', whisper: 'Find one plant that is beating the pavement. Photograph the resistance.', proofCriteria: 'a wild plant growing through or around man-made hard surface (crack, wall, kerb)', proofHint: 'get low — the crack is the story', durationMin: 15, tags: ['grass', 'stone', 'sky'] },
  { title: 'the oldest living thing within reach', whisper: 'Something near you is older than you. Go meet it. Trees count. Photograph what you found.', proofCriteria: 'a large, old living thing — tree, mossy wall, fern — clearly long-lived', proofHint: 'bark texture at close range reads well', durationMin: 20, tags: ['bark', 'moss'] },
  { title: 'a colour the shadows kept', whisper: 'Find a colour hiding inside shadow. Show it to me as it is.', proofCriteria: 'a vivid colour inside a shadowed area (under a car, a leaf pile, a doorway)', proofHint: 'frame the shadow and the colour will speak', durationMin: 12, tags: ['sky', 'leaf'] },
  { title: 'one perfect circle that nobody made', whisper: 'Nature is full of circles. Find one that a human hand did not draw. Photograph the circle.', proofCriteria: 'a natural circular shape — flower head, tree ring, pebble, puddle ring', proofHint: 'fill the frame with your circle', durationMin: 15, tags: ['flower', 'water'] },
  { title: 'the ants’ commute', whisper: 'There is traffic under your feet. Find it, watch it for one minute, and photograph the workers.', proofCriteria: 'small insects moving purposefully — ants, bees, anything on a commute', proofHint: 'macro mode; patience beats zoom', durationMin: 18, tags: ['pollinator', 'grass'] },
  { title: 'a sky only today has', whisper: 'Today’s sky will never happen again. Find a slice of it worth keeping and photograph it against something alive.', proofCriteria: 'sky visible with living foreground (branch, leaf, grass)', proofHint: 'put the horizon low and the sky generous', durationMin: 10, tags: ['sky'] },
  { title: 'the softest thing you can find legally', whisper: 'Go find soft. Moss, petals, a cat’s-dog-ear leaf. Photograph softness up close.', proofCriteria: 'macro photo emphasising soft texture — moss, petal, lichen, grass seedhead', proofHint: 'a fingertip next to it shows scale', durationMin: 15, tags: ['moss', 'flower'] },
  { title: 'evidence of rain', whisper: 'Even if it stopped hours ago, rain left fingerprints. Find one and photograph it.', proofCriteria: 'a droplet, puddle, damp mark, or petrichor-darkened surface', proofHint: 'backlight your puddle — it is basically a mirror', durationMin: 12, tags: ['water', 'leaf'] },
  { title: 'a leaf with a biography', whisper: 'Find the most used, bitten, travelled leaf in sight. Its damage is its story. Photograph it.', proofCriteria: 'a leaf with holes, curls, galls or bite marks — visibly weathered', proofHint: 'hold it to the light — the holes become windows', durationMin: 15, tags: ['leaf'] },
  { title: 'something the wind is carrying', whisper: 'The wind is a courier. Catch one parcel mid-job — a seed, a feather, a petal in motion. Photograph the courier.', proofCriteria: 'an airborne or freshly-landed light object (seed fluff, feather, petal)', proofHint: 'burst mode or luck; either is allowed', durationMin: 20, tags: ['seed', 'sky'] },
];

function localSeed(dateKey: string, variant = 0): Mission {
  let h = variant * 7919;
  for (let i = 0; i < dateKey.length; i++) h = (Math.imul(31, h) + dateKey.charCodeAt(i)) | 0;
  const s = LOCAL_SEEDS[Math.abs(h) % LOCAL_SEEDS.length];
  return {
    ...s,
    id: `local-${dateKey}-${variant}`,
    dateKey,
    createdAt: Date.now(),
    engine: 'hand-written seed · offline',
    audioUrl: null,
    window: null,
  };
}
