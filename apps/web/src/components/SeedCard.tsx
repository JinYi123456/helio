import type { Mission } from '../lib/types';

export function SeedCard({ mission }: { mission: Mission }) {
  return (
    <article className="seed">
      <div className="seed__perf" aria-hidden="true" />
      <header className="seed__head">
        <span className="seed__kicker">today's seed</span>
        <span className="seed__no">№ {String(Math.abs(hash(mission.id)) % 900 + 100)}</span>
      </header>
      <h2 className="seed__title">{mission.title}</h2>
      <p className="seed__whisper">{mission.whisper}</p>
      <div className="seed__tags">
        {mission.tags.slice(0, 4).map((t) => (
          <span key={t} className="chip">{t}</span>
        ))}
      </div>
      <footer className="seed__meta">
        <span>{mission.durationMin} min</span>
        {mission.window && (
          <span className="seed__window">☀ {mission.window.label}</span>
        )}
        <span className="seed__engine">{mission.engine.split('·')[0].trim()}</span>
      </footer>
      {mission.whyNow && <p className="seed__why">{mission.whyNow}</p>}
    </article>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
