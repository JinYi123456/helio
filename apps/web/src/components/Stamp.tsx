export function Stamp({ dateKey, big = false }: { dateKey: string; big?: boolean }) {
  return (
    <div className={`stamp ${big ? 'stamp--big' : ''}`} aria-label="verified proof of grass">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id="ringPath" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
        </defs>
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3.4" />
        <text fontSize="10.5" letterSpacing="2.6" fill="currentColor" fontFamily="var(--font-mono, monospace)">
          <textPath href="#ringPath" startOffset="2%">PROOF OF GRASS · HELIO ·</textPath>
        </text>
        <g transform="translate(60,58)">
          <path d="M0 16 C 0 6, 0 2, 0 -4" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M0 4 C -7 2, -9 -5, -7.5 -12 C 0 -9, 2 -2, 0 4 Z" fill="currentColor" />
          <path d="M0 4 C 7 2, 9 -5, 7.5 -12 C 0 -9, -2 -2, 0 4 Z" fill="currentColor" />
        </g>
        <text x="60" y="92" fontSize="11" textAnchor="middle" fill="currentColor" fontFamily="var(--font-mono, monospace)" letterSpacing="1.5">
          {dateKey}
        </text>
      </svg>
    </div>
  );
}
