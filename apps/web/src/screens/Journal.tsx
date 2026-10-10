import { useState } from 'react';
import { useApp } from '../App';
import type { Walk } from '../lib/types';
import { Stamp } from '../components/Stamp';
import { IconDownload, IconJournal, IconTrash, IconX } from '../components/Icons';

export function Journal() {
  const { walks, removeWalk, go } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = walks.find((w) => w.id === openId) ?? null;

  return (
    <div className="journal">
      <header className="topbar topbar--sub">
        <button className="btn btn--quiet" onClick={() => go('home')}>← home</button>
        <span className="topbar__title"><IconJournal size={17} /> field journal</span>
        <span className="chip chip--stat">{walks.length} pages</span>
      </header>

      {walks.length === 0 && (
        <div className="journal__empty card">
          <h2>the first page is blank.</h2>
          <p>every verified walk writes itself here: your photo, a small poem from the model, and the weather that made it.</p>
          <button className="btn btn--primary" onClick={() => go('home')}>go find one</button>
        </div>
      )}

      <div className="journal__pages">
        {walks.map((w, i) => (
          <button key={w.id} className={`page ${i % 2 ? 'page--tilt' : ''}`} onClick={() => setOpenId(w.id)}>
            <div className="page__ph">
              {w.photo ? <img src={w.photo} alt="" /> : <div className="page__ph--empty" />}
              {w.pending && <span className="page__badge page__badge--pending">waiting for the model</span>}
              {!w.pending && w.verdict?.loose && <span className="page__badge">loose wander</span>}
              {!w.pending && w.verdict?.passed && <span className="page__badge page__badge--ok">verified</span>}
            </div>
            <div className="page__body">
              <span className="page__date">{new Date(w.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <b className="page__title">{w.missionTitle}</b>
              {w.haiku && <i className="page__haiku">{w.haiku}</i>}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="sheet" onClick={() => setOpenId(null)}>
          <div className="sheet__card" onClick={(e) => e.stopPropagation()}>
            <button className="sheet__x" onClick={() => setOpenId(null)}><IconX size={20} /></button>
            {open.photo && <img src={open.photo} alt="" className="sheet__photo" />}
            <div className="sheet__meta">
              <span>{new Date(open.ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {open.cityKey}</span>
            </div>
            <h2 className="sheet__title">{open.missionTitle}</h2>
            {open.haiku && <p className="sheet__haiku">{open.haiku}</p>}
            {open.verdict?.seen && <p className="sheet__seen">the model saw: {open.verdict.seen}</p>}
            <div className="sheet__row">
              <div className="sheet__stamp">
                <Stamp dateKey={open.dateKey} />
              </div>
              <div className="sheet__facts">
                {open.weather?.label && <span>☀ {open.weather.label}</span>}
                {typeof open.weather?.tMax === 'number' && <span>↑ {Math.round(open.weather.tMax)}° · ↓ {Math.round(open.weather.tMin ?? 0)}°</span>}
                {open.tags.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>
            <div className="row">
              <button className="btn btn--quiet" onClick={() => void exportPage(open)}>
                <IconDownload size={17} /> save as card
              </button>
              <button
                className="btn btn--quiet btn--danger"
                onClick={() => {
                  removeWalk(open.id);
                  setOpenId(null);
                }}
              >
                <IconTrash size={17} /> delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function exportPage(w: Walk) {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f6f1e3';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#22301f';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    if (!w.photo) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = w.photo;
  });
  if (img) {
    const bw = W - 160, bh = 640;
    const s = Math.max(bw / img.width, bh / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(80, 90, bw, bh);
    ctx.clip();
    ctx.drawImage(img, 80 + (bw - dw) / 2, 90 + (bh - dh) / 2, dw, dh);
    ctx.restore();
  }

  ctx.fillStyle = '#22301f';
  ctx.font = 'italic 64px Georgia, "Times New Roman", serif';
  wrapText(ctx, w.missionTitle, 80, 840, W - 160, 74);

  if (w.haiku) {
    ctx.font = 'italic 46px Georgia, serif';
    ctx.fillStyle = '#4a5a41';
    wrapText(ctx, w.haiku, 80, 1020, W - 160, 60);
  }

  ctx.fillStyle = '#22301f';
  ctx.font = '28px ui-monospace, monospace';
  ctx.fillText(`PROOF OF GRASS · ${w.dateKey} · ${w.cityKey.toUpperCase()}`, 80, 1330);

  ctx.beginPath();
  ctx.arc(W - 170, 1250, 92, 0, Math.PI * 2);
  ctx.strokeStyle = '#3f6b3a';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - 170, 1250, 78, 0, Math.PI * 2);
  ctx.strokeStyle = '#3f6b3a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3f6b3a';
  ctx.fillText('VERIFIED', W - 170, 1250);
  ctx.font = '24px ui-monospace, monospace';
  ctx.fillText('· HELIO ·', W - 170, 1286);
  ctx.textAlign = 'left';

  const a = document.createElement('a');
  a.download = `helio-${w.dateKey}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
