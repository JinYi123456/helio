import { useMemo } from 'react';
import { useApp } from '../App';
import { Meadow } from '../components/Meadow';
import { SPECIES, speciesFor } from '../lib/seed';
import { IconMeadow, IconArrow } from '../components/Icons';

export function Bloom() {
  const { walks, go } = useApp();

  const stats = useMemo(() => {
    const total = walks.length;
    const days = new Set(walks.map((w) => w.dateKey));
    let streak = 0;
    const d = new Date();
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (days.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
      if (streak > 365) break;
    }
    const week = walks.filter((w) => Date.now() - w.ts < 7 * 864e5).length;
    const found = new Set<string>();
    for (const w of walks) {
      const s = speciesFor(w.tags);
      if (s) found.add(s.key);
    }
    return { total, streak, week, found };
  }, [walks]);

  const wiltedMsg = walks.length > 0 && Date.now() - Math.max(...walks.map((w) => w.ts)) > 72 * 3600 * 1000;

  return (
    <div className="bloom">
      <header className="topbar topbar--sub">
        <button className="btn btn--quiet" onClick={() => go('home')}>← home</button>
        <span className="topbar__title"><IconMeadow size={17} /> the meadow</span>
        <span className="chip chip--stat">streak {stats.streak}d</span>
      </header>

      <Meadow walks={walks} />

      <div className="bloom__stats">
        <div className="stat"><b>{stats.total}</b><span>verified walks</span></div>
        <div className="stat"><b>{stats.week}</b><span>this week</span></div>
        <div className="stat"><b>{stats.streak}</b><span>day streak</span></div>
        <div className="stat"><b>{stats.found.size}/{SPECIES.length}</b><span>species met</span></div>
      </div>

      {wiltedMsg && (
        <button className="btn btn--primary btn--big" onClick={() => go('home')}>
          water the meadow — go outside <IconArrow size={18} />
        </button>
      )}

      <section className="dex card">
        <h3 className="dex__title">species dex</h3>
        <p className="dex__sub">every verified walk can meet a new neighbour. the meadow only records what you actually saw.</p>
        <div className="dex__grid">
          {SPECIES.map((s) => {
            const got = stats.found.has(s.key);
            return (
              <div key={s.key} className={`dex__cell ${got ? 'dex__cell--got' : ''}`}>
                <span className="dex__icon">{got ? s.icon : '·'}</span>
                <span className="dex__label">{got ? s.label : '???'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
