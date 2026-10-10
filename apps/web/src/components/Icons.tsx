type P = { size?: number; className?: string };

const S = (p: P) => ({
  width: p.size ?? 22,
  height: p.size ?? 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: p.className,
});

export const IconDial = (p: P) => (
  <svg {...S(p)}><circle cx="12" cy="12" r="8.2" /><path d="M12 3.8v2M20.2 12h-2M12 20.2v-2M3.8 12h2" /><path d="M12 12l3-2.6" /></svg>
);
export const IconJournal = (p: P) => (
  <svg {...S(p)}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 19.5V4.5" /><path d="M9 7h6M9 10.5h4" /></svg>
);
export const IconMeadow = (p: P) => (
  <svg {...S(p)}><path d="M12 21v-7" /><path d="M12 14c0-2.8 1.8-5 4.5-5.5C16.5 11.3 14.8 13.4 12 14z" /><path d="M12 14c0-2.8-1.8-5-4.5-5.5C7.5 11.3 9.2 13.4 12 14z" /><path d="M12 7.5A2 2 0 0 0 12 3.5a2 2 0 0 0 0 4z" /></svg>
);
export const IconGear = (p: P) => (
  <svg {...S(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2.8l1.2 2.6 2.8.6 2-2 1.4 1.4-2 2 .6 2.8 2.6 1.2-2.6 1.2-.6 2.8 2 2-1.4 1.4-2-2-2.8.6-1.2 2.6L12 21.2l-1.2-2.6-2.8-.6-2 2L4.6 18.6l2-2-.6-2.8L3.4 12.6 6 11.4l.6-2.8-2-2L6 5.2l2 2 2.8-.6z" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...S(p)}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.4-2h5.8l1.4 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.4" r="3.4" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...S(p)}><path d="M7 5.5v13l11-6.5z" /></svg>
);
export const IconArrow = (p: P) => (
  <svg {...S(p)}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...S(p)}><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...S(p)}><path d="M4.5 12.5l5 5 10-11" /></svg>
);
export const IconX = (p: P) => (
  <svg {...S(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconWhisper = (p: P) => (
  <svg {...S(p)}><path d="M4 10v4h3l4 3.5v-11L7 10z" /><path d="M15 9a4.2 4.2 0 0 1 0 6" /><path d="M17.5 6.5a8 8 0 0 1 0 11" /></svg>
);
export const IconLeaf = (p: P) => (
  <svg {...S(p)}><path d="M20 4C10 4 5 9 5 16c0 2 .7 3.5 2 4.5C10 22 20 15 20 4z" /><path d="M7 17c3-4 7-7 10-9" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...S(p)}><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...S(p)}><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 18h14" /></svg>
);
