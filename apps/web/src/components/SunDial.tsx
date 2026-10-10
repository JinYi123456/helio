import { useMemo } from 'react';
import type { DayWindow } from '../lib/types';
import { sunTimes, nowHours, fmtHour } from '../lib/sun';

type Props = {
  windows: DayWindow[];
  lat: number;
  lon: number;
  state: 'ready' | 'waiting' | 'bloomed';
  onOpen?: () => void;
};

const CX = 160, CY = 160;
const R_OUT = 138, R_IN = 96, R_TICK = 146, R_LABEL = 152;

function pol(cx: number, cy: number, r: number, aDeg: number) {
  const a = (aDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function h2a(h: number) {
  return (h / 24) * 360 - 90;
}
function ring(r0: number, r1: number, a0: number, a1: number): string {
  let sweep = a1 - a0;
  const large = sweep > 180 ? 1 : 0;
  const [x0o, y0o] = pol(CX, CY, r1, a0);
  const [x1o, y1o] = pol(CX, CY, r1, a1);
  const [x1i, y1i] = pol(CX, CY, r0, a1);
  const [x0i, y0i] = pol(CX, CY, r0, a0);
  return `M ${x0o} ${y0o} A ${r1} ${r1} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${r0} ${r0} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

export function SunDial({ windows, lat, lon, state, onOpen }: Props) {
  const now = new Date();
  const { sunrise, sunset } = useMemo(() => sunTimes(now, lat, lon), [lat, lon]);
  const hNow = nowHours(now);
  const isToday = (d: string) => d === new Date().toISOString().slice(0, 10);

  const today = windows.find((w) => isToday(w.date));
  const nextGood = windows.find((w) => !isToday(w.date) && w.score >= 55);
  const inWindow = !!today && today.hours.some((h) => Math.abs(h - hNow) < 1);

  const [sx, sy] = pol(CX, CY, (R_OUT + R_IN) / 2, h2a(hNow));
  const nightSegs: string[] = [];
  if (sunrise > 0) nightSegs.push(ring(R_IN, R_OUT, h2a(0), h2a(sunrise)));
  if (sunset < 24) nightSegs.push(ring(R_IN, R_OUT, h2a(sunset), h2a(24)));

  const winkey = { ready: 'a seed is waiting', waiting: 'no seed yet', bloomed: 'bloomed today' }[state];

  return (
    <div className="dial" onClick={onOpen} role="button" aria-label={`helio dial — ${winkey}`}>
      <svg viewBox="0 0 320 320">
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#e8a33d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffcf6b" />
            <stop offset="100%" stopColor="#e8943d" />
          </linearGradient>
        </defs>

        <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2 + 10} fill="none" stroke="var(--ink)" strokeOpacity="0.08" strokeWidth="42" />

        {[0, 6, 12, 18].map((h) => {
          const [x1, y1] = pol(CX, CY, R_OUT - 3, h2a(h));
          const [x2, y2] = pol(CX, CY, R_OUT + 3, h2a(h));
          const [lx, ly] = pol(CX, CY, R_LABEL + 10, h2a(h));
          return (
            <g key={h}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1.4" />
              <text x={lx} y={ly} fontSize="9" fill="var(--ink)" fillOpacity="0.45" textAnchor="middle" dominantBaseline="middle">
                {String(h).padStart(2, '0')}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 48 }, (_, i) => i * 0.5).map((h) =>
          h % 6 === 0 ? null : (
            <line
              key={h}
              x1={pol(CX, CY, R_TICK - 4, h2a(h))[0]}
              y1={pol(CX, CY, R_TICK - 4, h2a(h))[1]}
              x2={pol(CX, CY, R_TICK, h2a(h))[0]}
              y2={pol(CX, CY, R_TICK, h2a(h))[1]}
              stroke="var(--ink)"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
          )
        )}

        {nightSegs.map((d, i) => (
          <path key={i} d={d} fill="var(--night)" opacity="0.55" />
        ))}

        {today?.hours.map((h, i) => (
          <path
            key={i}
            d={ring(R_IN + 6, R_OUT - 6, h2a(h - 0.45), h2a(h + 1.45))}
            fill="url(#goldArc)"
            className="dial__window"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}

        <path
          d={ring(R_IN - 8, R_IN - 5, h2a(sunrise), h2a(sunset))}
          fill="var(--sun)"
          opacity="0.25"
        />

        <circle cx={sx} cy={sy} r="34" fill="url(#sunGlow)">
          {inWindow && <animate attributeName="r" values="26;40;26" dur="3.2s" repeatCount="indefinite" />}
        </circle>
        <circle cx={sx} cy={sy} r="6.5" fill="var(--sun)" stroke="var(--paper)" strokeWidth="2" />

        <g transform={`translate(${CX}, ${CY})`}>
          <circle r="74" fill="var(--paper)" stroke="var(--ink)" strokeOpacity="0.14" />
          <g className="dial__sprout" transform="translate(-24,-34) scale(2.0)">
            <path d="M24 34 C 24 26, 24 22, 24 18" stroke="var(--moss)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M24 24 C 18 22, 16 15, 17.5 10 C 23 12, 25 18, 24 24 Z" fill="var(--moss)" />
            <path d="M24 24 C 30 22, 32 15, 30.5 10 C 25 12, 23 18, 24 24 Z" fill="var(--moss2)" />
          </g>
          <text y="16" textAnchor="middle" className="dial__state">
            {state === 'bloomed' ? 'bloomed' : state === 'ready' ? 'a seed waits' : 'ask for a seed'}
          </text>
          <text y="34" textAnchor="middle" className="dial__hint">
            {today ? `gold window · ${fmtHour(today.hours[0] ?? 7)}` : nextGood ? `next gold · ${nextGood.weekday}` : 'listening…'}
          </text>
        </g>
      </svg>
    </div>
  );
}
