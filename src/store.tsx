import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { api, CareResult } from './api';
import { CareEvent, Caregiver, emptyGarden, Garden, Nudges, Plan, Plant } from './model';

const KEY = 'rootera:garden:v2';

interface Store {
  garden: Garden;
  ready: boolean;
  /** Where the garden on screen came from. 'none' means nothing is known yet (no cache, server unreachable). */
  source: 'none' | 'cache' | 'server';
  /** True when the last refresh failed and the screen shows cached data. */
  offline: boolean;
  refresh: () => Promise<void>;
  saveProfile: (changes: Partial<{ name: string; onboarded: boolean; reminders: boolean; caregiver: Caregiver; nudges: Nudges }>) => Promise<void>;
  addPlant: (plant: Plant) => Promise<void>;
  updatePlant: (id: string, changes: Partial<Plant>) => Promise<void>;
  /** A plant leaves the garden; `reason` says why (see screens/Farewell). */
  archivePlant: (id: string, reason?: 'died' | 'given' | 'left' | 'removed') => Promise<void>;
  logCare: (event: CareEvent) => Promise<CareResult>;
  /** Undo a care record (it leaves the plant's history; the server keeps an audit entry). */
  removeCare: (plantId: string, id: string) => Promise<void>;
  setDemoPlan: (plan: Plan, annual: boolean) => Promise<void>;
  syncBilling: () => Promise<void>;
}

const Context = createContext<Store | null>(null);

/**
 * The server is the source of truth. Writes go straight to the API (with stable
 * ids, so a retry never duplicates) and are serialized; afterwards the garden is
 * reloaded. The device keeps a read-only cache for fast start and offline viewing.
 */
export function StoreProvider({ children }: React.PropsWithChildren) {
  const [garden, setGarden] = useState<Garden>(emptyGarden);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [source, setSource] = useState<Store['source']>('none');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const writes = useRef(0);

  const apply = useCallback(async (next: Garden) => {
    setGarden(next);
    setOffline(false);
    setSource('server');
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* cache is optional */ }
  }, []);

  const refresh = useCallback(async () => {
    if (writes.current) return;
    try { await apply(await api.garden()); } catch { setOffline(true); }
  }, [apply]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          // A cached garden opens the app at once; the server refresh follows in the background.
          if (Array.isArray(cached?.plants) && cached?.twins) { setGarden(cached); setSource('cache'); setReady(true); }
        }
      } catch { /* ignore a corrupt cache */ }
      await refresh();
      setReady(true);
    })();
    const timer = setInterval(refresh, 60000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refresh(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [refresh]);

  const write = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    writes.current++;
    const op = queue.current.then(async () => {
      try {
        const result = await run();
        // The write succeeded; a failed reload must not look like a failed save.
        try { await apply(await api.garden()); } catch { setOffline(true); }
        return result;
      } finally {
        writes.current--;
      }
    });
    queue.current = op.catch(() => undefined);
    return op;
  }, [apply]);

  const value = useMemo<Store>(() => ({
    garden, ready, source, offline, refresh,
    saveProfile: changes => write(() => api.profile(changes)).then(() => undefined),
    addPlant: plant => write(() => api.addPlant(plant)).then(() => undefined),
    updatePlant: (id, changes) => write(() => api.updatePlant(id, changes)).then(() => undefined),
    archivePlant: (id, reason) => write(() => api.archivePlant(id, reason)).then(() => undefined),
    logCare: event => write(() => api.logCare(event)),
    removeCare: (plantId, id) => write(() => api.removeCare(plantId, id)).then(() => undefined),
    setDemoPlan: (plan, annual) => write(() => api.demoPlan(plan, annual)).then(() => undefined),
    syncBilling: () => write(() => api.syncBilling()).then(() => undefined),
  }), [garden, ready, source, offline, refresh, write]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
