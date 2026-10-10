import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../App';
import type { Verdict, Walk } from '../lib/types';
import { api } from '../lib/api';
import { Stamp } from '../components/Stamp';
import { IconCamera, IconCheck, IconX, IconRefresh } from '../components/Icons';

type Mode = 'live' | 'file' | 'checking' | 'verdict';

export function Proof() {
  const { mission, settings, addWalk, updateWalk, go, today } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('live');
  const [img, setImg] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [fails, setFails] = useState(0);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [camFailed, setCamFailed] = useState(false);

  useEffect(() => {
    if (!mission) go('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCam = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1600 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => undefined);
      }
      return true;
    } catch {
      setCamFailed(true);
      setMode('file');
      return false;
    }
  }, []);

  useEffect(() => {
    void startCam();
    return stop;
  }, [startCam, stop]);

  const downscale = (src: string, maxW: number, quality = 0.85): Promise<string> =>
    new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const scale = Math.min(1, maxW / im.width);
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * scale);
        c.height = Math.round(im.height * scale);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      im.src = src;
    });

  const runVerdict = async (dataUrl: string) => {
    if (!mission) return;
    setImg(dataUrl);
    setMode('checking');
    const t0 = performance.now();
    try {
      const v = await api.verify(settings, {
        mission: { id: mission.id, title: mission.title, proofCriteria: mission.proofCriteria, tags: mission.tags },
        image: dataUrl,
        cityKey: settings.cityKey,
      });
      v.ms = Math.round(performance.now() - t0);
      setVerdict(v);
      setMode('verdict');
      if (v.passed) void completeWalk(v, dataUrl, false);
      else setFails((f) => f + 1);
    } catch {
      setMode('verdict');
      setVerdict(null); // offline branch
    }
  };

  const shut = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1024 / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    stop();
    await runVerdict(c.toDataURL('image/jpeg', 0.85));
  };

  const fromFile = async (f: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(f);
    });
    stop();
    await runVerdict(await downscale(dataUrl, 1024));
  };

  const completeWalk = async (v: Verdict | null, dataUrl: string, pending: boolean) => {
    if (!mission) return;
    const thumb = await downscale(dataUrl, 512, 0.78);
    const walk: Walk = {
      id: (crypto.randomUUID?.() ?? String(Date.now())) as string,
      ts: Date.now(),
      dateKey: today,
      cityKey: settings.cityKey,
      missionId: mission.id,
      missionTitle: mission.title,
      tags: [...mission.tags],
      photo: thumb,
      verdict: v ?? undefined,
      pending,
      weather: mission.window
        ? { tMax: mission.window.tMax, tMin: mission.window.tMin, precip: mission.window.precip, label: mission.window.label }
        : null,
    };
    addWalk(walk);
    try {
      const j = await api.journal(settings, {
        missionTitle: mission.title,
        tags: mission.tags,
        seen: v?.seen ?? 'an unverified wander',
        cityKey: settings.cityKey,
        dateKey: today,
        weather: walk.weather,
      });
      updateWalk({ ...walk, haiku: j.haiku, journalAt: Date.now() });
    } catch {
      /* offline: the whisper line gets written by the model on next sync */
    }
  };

  const again = async () => {
    setVerdict(null);
    setImg(null);
    setMode('live');
    await startCam();
  };

  if (!mission) return null;

  return (
    <div className="proof">
      {mode === 'live' && (
        <>
          <video ref={videoRef} playsInline muted className="proof__video" />
          <div className="proof__mask">
            <p className="proof__remind">proof needed: {mission.proofHint || mission.proofCriteria}</p>
            <button className="proof__shutter" onClick={() => void shut()} aria-label="capture proof">
              <IconCamera size={32} />
            </button>
            <button className="btn btn--darkquiet proof__alt" onClick={() => { stop(); setMode('file'); }}>
              use a photo instead
            </button>
          </div>
        </>
      )}

      {mode === 'file' && (
        <div className="proof__file">
          <h2>{camFailed ? 'no camera here — that’s fine' : 'pick the moment'}</h2>
          <p className="note">choose or take one photo as your proof</p>
          <label className="btn btn--primary btn--big">
            choose photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void fromFile(f);
              }}
            />
          </label>
          {!camFailed && (
            <button className="btn btn--quiet" onClick={() => void again()}>back to camera</button>
          )}
          <button className="btn btn--quiet" onClick={() => go('pocket')}>back to pocket</button>
        </div>
      )}

      {mode === 'checking' && (
        <div className="proof__checking">
          {img && <img src={img} alt="your proof" className="proof__still" />}
          <div className="proof__scan" aria-hidden="true" />
          <div className="proof__think">
            <span className="proof__spinner" aria-hidden="true" />
            <p>helio is looking…</p>
            <p className="proof__engine">
              {settings.serverUrl ? settings.serverUrl : 'this device’s doorstep'} · open weights · nothing uploaded to any cloud
            </p>
          </div>
        </div>
      )}

      {mode === 'verdict' && (
        <div className="proof__verdict">
          {img && <img src={img} alt="your proof" className="proof__still proof__still--small" />}

          {verdict?.passed && (
            <div className="verdictcard verdictcard--pass">
              <Stamp dateKey={today} big />
              <h2>verified.</h2>
              <p className="verdictcard__seen">i see: {verdict.seen}</p>
              {verdict.note && <p className="verdictcard__note">{verdict.note}</p>}
              <p className="verdictcard__meta">
                {Math.round(verdict.confidence * 100)}% sure · checked in {Math.max(1, Math.round((verdict.ms ?? 0) / 100) / 10)}s by {verdict.engine}
              </p>
              <div className="row">
                <button className="btn btn--primary" onClick={() => go('journal')}>
                  see the field journal
                </button>
                <button className="btn btn--quiet" onClick={() => go('home')}>home</button>
              </div>
            </div>
          )}

          {verdict && !verdict.passed && (
            <div className="verdictcard verdictcard--fail">
              <IconX size={30} />
              <h2>not quite — and that's okay.</h2>
              <p className="verdictcard__seen">i see: {verdict.seen}</p>
              {verdict.note && <p className="verdictcard__note">{verdict.note}</p>}
              <p className="verdictcard__meta">still your walk. try the lens again, or wander loose.</p>
              <div className="row">
                <button className="btn btn--primary" onClick={() => void again()}>
                  <IconRefresh size={17} /> one more look
                </button>
                {fails >= 1 && img && (
                  <button
                    className="btn btn--quiet"
                    onClick={() => {
                      void completeWalk(null, img, false);
                      go('journal');
                    }}
                  >
                    log it loose
                  </button>
                )}
              </div>
            </div>
          )}

          {!verdict && (
            <div className="verdictcard verdictcard--offline">
              <IconCheck size={26} />
              <h2>the model is out of reach right now.</h2>
              <p className="verdictcard__note">
                your photo is safe on this device. helio will check it the moment signal comes back — or keep it as an offline wander.
              </p>
              <div className="row">
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    void completeWalk(null, img!, true);
                    setOfflineSaved(true);
                  }}
                  disabled={offlineSaved}
                >
                  {offlineSaved ? 'kept safe ✓' : 'keep my proof'}
                </button>
                {offlineSaved && (
                  <button className="btn btn--quiet" onClick={() => go('journal')}>field journal →</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
