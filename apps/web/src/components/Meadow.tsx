import type { Walk } from '../lib/types';
import { bloomFor } from '../lib/seed';

const MAX = 13;

export function Meadow({ walks }: { walks: Walk[] }) {
  const shown = [...walks].sort((a, b) => a.ts - b.ts).slice(-MAX);
  const older = walks.length - shown.length;
  const lastTs = walks.length ? Math.max(...walks.map((w) => w.ts)) : 0;
  const wilted = walks.length > 0 && Date.now() - lastTs > 72 * 3600 * 1000;

  return (
    <div className="meadow">
      <svg viewBox="0 0 360 240">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fdf7e6" />
            <stop offset="100%" stopColor="#f3ecd9" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="240" fill="url(#sky)" rx="14" />
        <circle cx="312" cy="44" r="26" fill="var(--sun)" opacity={wilted ? 0.55 : 0.9} />
        <circle cx="312" cy="44" r="34" fill="url(#sunGlowT)" opacity="0.35" />
        <defs>
          <radialGradient id="sunGlowT" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd27a" />
            <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {shown.map((w, i) => {
          const b = bloomFor(w.id);
          const x = 42 + i * ((360 - 84) / Math.max(shown.length - 1, 1));
          const jitter = ((w.ts % 17) - 8) * 0.8;
          const x2 = Math.min(330, Math.max(30, x + jitter));
          const y0 = 196;
          const top = y0 - b.stemH;
          const age = Date.now() - w.ts;
          const fading = age > 48 * 3600 * 1000;
          const droop = wilted ? 18 : 0;
          const petalR = 7.4;
          return (
            <g key={w.id} transform={`translate(${x2},${y0})`} opacity={fading ? 0.82 : 1}>
              <path
                d={`M 0 0 Q ${b.lean * 0.4} ${-b.stemH * 0.6} ${b.lean + droop * 0.5} ${-b.stemH}`}
                stroke="var(--moss)"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
              />
              {b.leaf && (
                <path
                  d={`M ${b.lean * 0.2} ${-b.stemH * 0.45} q 8 -4 12 2 q -8 5 -12 -2 Z`}
                  fill="var(--moss2)"
                />
              )}
              <g transform={`translate(${b.lean + droop * 0.5}, ${-b.stemH}) rotate(${wilted ? 26 : b.lean * 0.4})`}>
                {Array.from({ length: b.petals }).map((_, k) => {
                  const a = (k / b.petals) * 360;
                  return (
                    <ellipse
                      key={k}
                      cx="0"
                      cy={-petalR}
                      rx="3.6"
                      ry={petalR}
                      fill={wilted ? '#a8a48c' : b.color}
                      transform={`rotate(${a})`}
                      opacity="0.94"
                    />
                  );
                })}
                <circle r="3.4" fill={wilted ? '#8f8a72' : b.core} />
              </g>
            </g>
          );
        })}

        <path
          d="M 0 196 Q 90 184 180 194 T 360 192 L 360 240 L 0 240 Z"
          fill="var(--moss3)"
        />
        {Array.from({ length: 26 }).map((_, i) => (
          <path
            key={i}
            d={`M ${8 + i * 13.6} 240 q ${i % 5 - 2} -12 ${i % 3 - 1} -18`}
            stroke="var(--moss2)"
            strokeWidth="1.6"
            fill="none"
            opacity="0.5"
          />
        ))}

        {walks.length === 0 && (
          <text x="180" y="120" textAnchor="middle" className="meadow__empty">
            nothing planted yet — the first walk starts the garden
          </text>
        )}
        {wilted && (
          <text x="180" y="26" textAnchor="middle" className="meadow__wilt">
            your meadow is thirsty — it misses you
          </text>
        )}
        {older > 0 && (
          <text x="18" y="228" className="meadow__older">
            +{older} earlier
          </text>
        )}
      </svg>
    </div>
  );
}
