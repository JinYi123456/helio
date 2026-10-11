import type { DayWindow } from '../lib/types';

const wet = (mm?: number) => typeof mm === 'number' && mm >= 0.2;

export function SkyStrip({ days, today }: { days: DayWindow[]; today: string }) {
  const week = days.slice(0, 7).filter((d) => typeof d.tMax === 'number');
  if (week.length < 2) return null;
  const now = week.find((d) => d.date === today) ?? week[0];
  const deg = (n?: number) => (typeof n === 'number' ? `${Math.round(n)}°` : '—');
  const bits: string[] = [];
  if (typeof now.precip === 'number') bits.push(wet(now.precip) ? `${now.precip.toFixed(1)} mm rain` : 'dry');
  if (typeof now.cloud === 'number') bits.push(`${Math.round(now.cloud)}% cloud`);

  return (
    <section className="sky" aria-label="today's sky">
      <div className="sky__now">
        <span className="sky__kicker">today's sky</span>
        <p className="sky__temp">
          {deg(now.tMax)}<em> / {deg(now.tMin)}</em>
        </p>
        {bits.length > 0 && <span className="sky__bits">{bits.join(' · ')}</span>}
      </div>
      <ol className="sky__week">
        {week.map((d) => (
          <li key={d.date} className={`sky__day${d.date === now.date ? ' sky__day--on' : ''}`}>
            <span className="sky__wd">{d.weekday}</span>
            <span className="sky__hi">{deg(d.tMax)}</span>
            <span className="sky__lo">{deg(d.tMin)}</span>
            <span className="sky__drop">{wet(d.precip) ? '☂' : ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
