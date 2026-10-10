import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { whisper } from '../lib/speech';
import { IconCamera, IconWhisper, IconX } from '../components/Icons';

const FULL_MIN = 45;

export function Pocket() {
  const { mission, settings, go } = useApp();
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.floor((now - start) / 60000);
  const secs = Math.floor(((now - start) % 60000) / 1000);
  const progress = Math.min(1, (now - start) / (FULL_MIN * 60000));
  const C = 2 * Math.PI * 64;

  return (
    <div className="pocket">
      <button className="pocket__exit" onClick={() => go('home')} aria-label="leave without proof">
        <IconX size={20} />
      </button>

      <p className="pocket__away">the screen is done now. your eyes belong outside.</p>

      <div className="pocket__ring">
        <svg viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="64" fill="none" stroke="#2a3322" strokeWidth="6" />
          <circle
            cx="75" cy="75" r="64"
            fill="none"
            stroke="var(--sun)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${C * progress} ${C}`}
            transform="rotate(-90 75 75)"
          />
        </svg>
        <div className="pocket__time">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      <p className="pocket__nag">
        {mins < 3 && 'good. now walk.'}
        {mins >= 3 && mins < 10 && 'that’s it. breathe a little.'}
        {mins >= 10 && mins < 20 && 'your sprout is warming up ✦'}
        {mins >= 20 && mins < FULL_MIN && 'the meadow can feel you coming ✦✦'}
        {mins >= FULL_MIN && 'fully grown. whatever you find now is a gift.'}
      </p>

      {mission && (
        <p className="pocket__task">still hunting: <i>{mission.title}</i></p>
      )}

      <div className="pocket__foot">
        {mission && (
          <button
            className="btn btn--darkquiet"
            onClick={() => void whisper(mission.whisper, mission.audioUrl, !settings.voiceOn)}
          >
            <IconWhisper size={18} /> whisper again
          </button>
        )}
        <button className="pocket__shutter" onClick={() => go('proof')} aria-label="take the proof photo">
          <IconCamera size={30} />
        </button>
        <span className="pocket__shutter-hint">found it? tap the lens.</span>
      </div>
    </div>
  );
}
