import { useEffect, useState } from 'react';
import { useApp } from '../App';

export function Boot() {
  const { settings, setSettings, go, loaded } = useApp();
  const [phase, setPhase] = useState<'splash' | 'intro'>('splash');
  const [name, setName] = useState(settings.name);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      if (settings.seenIntro) go('home');
      else setPhase('intro');
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded, settings.seenIntro, go]);

  if (phase === 'splash') {
    return (
      <div className="boot">
        <div className="boot__sprout" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <path className="boot__stem" d="M60 104 C 60 78, 60 64, 60 52" />
            <path className="boot__leafL" d="M60 74 C 40 68, 34 46, 40 30 C 56 36, 64 56, 60 74 Z" />
            <path className="boot__leafR" d="M60 74 C 80 68, 86 46, 80 30 C 64 36, 56 56, 60 74 Z" />
            <circle className="boot__sun" cx="60" cy="34" r="0" />
          </svg>
        </div>
        <h1 className="boot__word">helio</h1>
        <p className="boot__tag">proof of grass</p>
      </div>
    );
  }

  return (
    <div className="boot boot--intro">
      <div className="intro card">
        <h1 className="intro__title">helio doesn't want your attention.</h1>
        <p className="intro__sub">it wants you outside. here's the whole deal:</p>
        <ol className="intro__steps">
          <li><b>1.</b> a seed is whispered in your ear — a tiny mission for the real world.</li>
          <li><b>2.</b> you leave the phone in your pocket and go. one photo is your proof.</li>
          <li><b>3.</b> a model running <i>on this device's doorstep</i> — never a server — decides if you truly touched grass.</li>
        </ol>
        <label className="intro__name">
          <span>what should helio call you?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="(optional)"
            maxLength={24}
          />
        </label>
        <button
          className="btn btn--primary"
          onClick={() => {
            setSettings({ ...settings, name, seenIntro: true });
            go('home');
          }}
        >
          begin
        </button>
        <p className="intro__foot">open weights · offline-capable · nothing you photograph leaves this device</p>
      </div>
    </div>
  );
}
