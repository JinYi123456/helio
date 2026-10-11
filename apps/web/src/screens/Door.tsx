import { useEffect, useRef, useState } from 'react';
import { useApp } from '../App';
import { whisper } from '../lib/speech';
import { IconWhisper, IconArrow } from '../components/Icons';

export function Door() {
  const { mission, settings, go } = useApp();
  const [opening, setOpening] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (!mission) go('home');
  }, [mission, go]);

  useEffect(() => {
    if (mission && !played.current && settings.voiceOn) {
      played.current = true;
      const t = setTimeout(() => void whisper(mission.whisper, mission.audioUrl, false), 450);
      return () => clearTimeout(t);
    }
  }, [mission, settings.voiceOn]);

  if (!mission) return null;

  const enter = () => {
    setOpening(true);
    setTimeout(() => go('pocket'), 720);
  };

  return (
    <div className={`door ${opening ? 'door--opening' : ''}`}>
      <div className="door__scene" aria-hidden="true">
        <svg viewBox="0 0 300 320">
          <defs>
            <linearGradient id="light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffd27a" stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="archClip">
              <path d="M60 320 L60 120 Q60 40 150 40 Q240 40 240 120 L240 320 Z" />
            </clipPath>
          </defs>

          <path className="door__glow" d="M40 320 L40 130 Q40 20 150 20 Q260 20 260 130 L260 320 Z" fill="url(#light)" />
          <path className="door__frame" d="M60 320 L60 120 Q60 40 150 40 Q240 40 240 120 L240 320 Z" fill="none" stroke="var(--ink)" strokeWidth="5" />
          <g clipPath="url(#archClip)">
            <rect className="door__leaf" x="60" y="40" width="180" height="280" fill="#20291c" />
            <g stroke="#38452f" strokeWidth="2">
              {Array.from({ length: 6 }).map((_, i) => (
                <line key={i} x1={72 + i * 30} y1="40" x2={72 + i * 30} y2="320" />
              ))}
            </g>
            <circle className="door__knob" cx="216" cy="200" r="6" fill="var(--sun)" />
          </g>
          <path d="M150 320 L150 60" stroke="var(--paper)" strokeOpacity="0.14" strokeWidth="1.4" strokeDasharray="4 5" />
        </svg>
      </div>

      <div className="door__copy">
        <span className="door__kicker">a seed for {settings.name || 'you'}</span>
        <h1 className="door__title">{mission.title}</h1>
        <p className="door__whisper">“{mission.whisper}”</p>
        <p className="door__proof">proof: {mission.proofCriteria}</p>
        {mission.lifecycle?.scheduled && (
          <p className="door__lifecycle">held by a Temporal timer — ripens {mission.lifecycle.goldenLabel}</p>
        )}

        <div className="door__actions">
          <button className="btn btn--primary btn--big" onClick={enter}>
            i'm going <IconArrow size={19} />
          </button>
          <button
            className="btn btn--quiet"
            onClick={() => void whisper(mission.whisper, mission.audioUrl, !settings.voiceOn)}
          >
            <IconWhisper size={17} /> whisper again
          </button>
          <button className="btn btn--quiet" onClick={() => go('home')}>
            not now
          </button>
        </div>
      </div>
    </div>
  );
}
