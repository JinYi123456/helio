import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DayWindow, Health, Mission, Settings, Walk } from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import * as db from './lib/db';
import { api } from './lib/api';
import { dateKey } from './lib/sun';

export type Screen = 'boot' | 'home' | 'door' | 'pocket' | 'proof' | 'journal' | 'bloom' | 'settings' | 'about';

type Ctx = {
  settings: Settings;
  setSettings: (s: Settings) => void;
  health: Health | null;
  walks: Walk[];
  addWalk: (w: Walk) => void;
  updateWalk: (w: Walk) => void;
  removeWalk: (id: string) => void;
  mission: Mission | null;
  setMission: (m: Mission | null) => void;
  windows: DayWindow[];
  setWindows: (w: DayWindow[]) => void;
  screen: Screen;
  go: (s: Screen) => void;
  today: string;
  loaded: boolean;
};

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export function App() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [windows, setWindows] = useState<DayWindow[]>([]);
  const [screen, setScreen] = useState<Screen>('boot');
  const today = useMemo(() => dateKey(), []);

  useEffect(() => {
    (async () => {
      try {
        const s = await db.loadSettings();
        if (s) setSettingsState({ ...DEFAULT_SETTINGS, ...s });
        const ws = await db.allWalks();
        setWalks(ws.sort((a, b) => b.ts - a.ts));
        const m = await db.getMission(dateKey());
        if (m) setMission(m);
      } catch {
        /* private mode without idb — Helio still runs, just forgets */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    (async () => {
      try {
        const h = await api.health(settings);
        if (alive) setHealth(h);
      } catch {
        if (alive) setHealth(null);
      }
      try {
        const w = await api.window(settings, settings.cityKey);
        if (alive && w.days?.length) setWindows(w.days);
      } catch {
        /* dial keeps whatever the service worker cached */
      }
    })();
    return () => {
      alive = false;
    };
  }, [loaded, settings.cityKey, settings.serverUrl]);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    void db.saveSettings(s);
  };

  const addWalk = (w: Walk) => {
    void db.putWalk(w);
    setWalks((prev) => [w, ...prev].sort((a, b) => b.ts - a.ts));
  };

  const updateWalk = (w: Walk) => {
    void db.putWalk(w);
    setWalks((prev) => prev.map((x) => (x.id === w.id ? w : x)));
  };

  const removeWalk = (id: string) => {
    void db.delWalk(id);
    setWalks((prev) => prev.filter((x) => x.id !== id));
  };

  // Pending proofs (captured offline) get their whisper + model check the moment we're back in signal.
  useEffect(() => {
    const pending = walks.filter((w) => w.pending);
    if (!pending.length || !health?.ok) return;
    let alive = true;
    (async () => {
      try {
        const { results } = await api.sync(settings, pending.slice(0, 3));
        if (!alive) return;
        for (const r of results) {
          if (r.error) continue;
          const w = pending.find((p) => p.id === r.id);
          if (w) updateWalk({ ...w, pending: false, haiku: r.haiku ?? w.haiku, syncedAt: Date.now() });
        }
      } catch {
        /* still offline — stays pending, nothing is lost */
      }
    })();
    return () => {
      alive = false;
    };
  }, [walks, health, settings]);

  const value: Ctx = {
    settings, setSettings, health, walks, addWalk, updateWalk, removeWalk,
    mission, setMission, windows, setWindows, screen,
    go: setScreen, today, loaded,
  };

  return (
    <AppCtx.Provider value={value}>
      <Shell />
    </AppCtx.Provider>
  );
}

import { Boot } from './screens/Boot';
import { Home } from './screens/Home';
import { Door } from './screens/Door';
import { Pocket } from './screens/Pocket';
import { Proof } from './screens/Proof';
import { Journal } from './screens/Journal';
import { Bloom } from './screens/Bloom';
import { SettingsScreen } from './screens/Settings';
import { About } from './screens/About';

function Shell() {
  const { screen } = useApp();
  const key = screen === 'journal' || screen === 'bloom' ? screen : screen;
  return (
    <div className={`app ${screen === 'pocket' ? 'app--pocket' : ''}`}>
      <div className="screen" key={key}>
        {screen === 'boot' && <Boot />}
        {screen === 'home' && <Home />}
        {screen === 'door' && <Door />}
        {screen === 'pocket' && <Pocket />}
        {screen === 'proof' && <Proof />}
        {screen === 'journal' && <Journal />}
        {screen === 'bloom' && <Bloom />}
        {screen === 'settings' && <SettingsScreen />}
        {screen === 'about' && <About />}
      </div>
    </div>
  );
}
