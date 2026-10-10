import { useState } from 'react';
import { useApp } from '../App';
import { CITIES } from '../lib/types';
import { api } from '../lib/api';
import * as db from '../lib/db';
import { IconDownload, IconGear, IconRefresh, IconTrash } from '../components/Icons';

const ENVS = ['street', 'park', 'garden', 'trail', 'waterside', 'balcony'];

export function SettingsScreen() {
  const { settings, setSettings, health, walks, go } = useApp();
  const [test, setTest] = useState<string | null>(null);
  const [packed, setPacked] = useState<string | null>(null);

  const toggleEnv = (e: string) => {
    const has = settings.envs.includes(e);
    const next = has ? settings.envs.filter((x) => x !== e) : [...settings.envs, e];
    setSettings({ ...settings, envs: next.length ? next : settings.envs });
  };

  const runTest = async () => {
    setTest('…');
    try {
      const h = await api.health(settings);
      setTest(
        `ok · ${h.engine ?? h.provider} · storage: ${h.storage} · tabpfn: ${h.tabpfn ? 'on' : 'off'} · voice: ${h.tts ? 'elevenlabs' : 'browser'} · search: ${h.serpapi ? 'on' : 'off'}`
      );
    } catch {
      setTest('no answer — is the agent awake?');
    }
  };

  const prepareOffline = async () => {
    setPacked('packing…');
    try {
      let ok = 0;
      try {
        const w = await api.window(settings, settings.cityKey);
        ok += w.days?.length ? 1 : 0;
      } catch { /* window is a nice-to-have */ }
      const cached = await db.getMission(new Date().toISOString().slice(0, 10));
      if (cached?.audioUrl) {
        try {
          await fetch(cached.audioUrl);
          ok += 1;
        } catch { /* no whisper audio today */ }
      }
      setPacked(ok ? `packed ✓ (${ok} goodies cached for the trail)` : 'nothing new to pack — still fully usable offline');
    } catch {
      setPacked('pack failed — app still works offline with last cached seeds');
    }
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, walks }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'helio-export.json';
    a.click();
  };

  return (
    <div className="settings">
      <header className="topbar topbar--sub">
        <button className="btn btn--quiet" onClick={() => go('home')}>← home</button>
        <span className="topbar__title"><IconGear size={17} /> settings</span>
        <span />
      </header>

      <section className="card">
        <h3>you</h3>
        <label className="field">
          <span>name</span>
          <input
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            placeholder="what helio calls you"
          />
        </label>
        <label className="field">
          <span>your city <small>(drives the sun dial + personal model)</small></span>
          <select value={settings.cityKey} onChange={(e) => setSettings({ ...settings, cityKey: e.target.value })}>
            {CITIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>places within reach <small>(seeds respect these)</small></span>
          <div className="chips">
            {ENVS.map((e) => (
              <button
                key={e}
                className={`chip chip--toggle ${settings.envs.includes(e) ? 'chip--on' : ''}`}
                onClick={() => toggleEnv(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="field field--row">
          <span>voice whispers</span>
          <button
            className={`toggle ${settings.voiceOn ? 'toggle--on' : ''}`}
            onClick={() => setSettings({ ...settings, voiceOn: !settings.voiceOn })}
            aria-label="toggle voice"
          >
            <span />
          </button>
        </div>
      </section>

      <section className="card">
        <h3>the machine</h3>
        <p className="note">
          helio talks to a model. point it at your own laptop (ollama, llama.cpp, lm studio — anything open) or a free
          hosted Gemma. leave empty to use the same address this page came from.
        </p>
        <label className="field">
          <span>agent / model address</span>
          <input
            value={settings.serverUrl}
            onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
            placeholder="e.g. http://192.168.1.20:8787  (or empty)"
          />
        </label>
        <div className="row">
          <button className="btn btn--quiet" onClick={() => void runTest()}>
            <IconRefresh size={16} /> test connection
          </button>
          <button className="btn btn--quiet" onClick={() => void prepareOffline()}>
            prepare offline pack
          </button>
        </div>
        {test && <p className="note">{test}</p>}
        {packed && <p className="note">{packed}</p>}
        {health && (
          <p className="note note--dim">
            now: {health.engine ?? health.provider} · photos stay on this device · nothing is uploaded anywhere
          </p>
        )}
      </section>

      <section className="card">
        <h3>your data</h3>
        <p className="note">walks, photos and poems live in this browser's IndexedDB. export or burn — your call.</p>
        <div className="row">
          <button className="btn btn--quiet" onClick={exportAll}>
            <IconDownload size={16} /> export everything
          </button>
          <button
            className="btn btn--quiet btn--danger"
            onClick={() => {
              if (confirm('erase every walk, seed and poem on this device?')) {
                void db.wipeAll().then(() => window.location.reload());
              }
            }}
          >
            <IconTrash size={16} /> wipe device
          </button>
        </div>
      </section>

      <section className="card card--about">
        <h3>why helio is open</h3>
        <ul className="about__list">
          <li>the model runs <b>on your machine</b> — backcountry, airplane mode, zero signal, it still works.</li>
          <li>your photos never leave the device; there's no account, no server that wants them.</li>
          <li>swap the model anytime: ollama today, llama.cpp tomorrow, the weights belong to everyone.</li>
          <li>it costs nothing to run — no meters, no keys, no landlord.</li>
        </ul>
        <button className="btn btn--quiet" onClick={() => go('about')}>read the full manifesto</button>
      </section>
    </div>
  );
}
