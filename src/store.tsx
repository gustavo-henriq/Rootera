import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { AppData, initialData } from './model';
import { getGarden, persistChanges } from './api';
const KEY = 'rootera:server-cache:v1';
const Context = createContext<{ data: AppData; update: (fn: (d: AppData) => AppData) => Promise<void>; ready: boolean; storageError: string | null; refresh: () => Promise<void> }>({ data: initialData, update: async () => {}, ready: false, storageError: null, refresh: async () => {} });
export function StoreProvider({ children }: React.PropsWithChildren) {
 const [data, setData] = useState(initialData); const current = useRef(initialData); const [ready, setReady] = useState(false); const [storageError, setError] = useState<string | null>(null); const queue = useRef(Promise.resolve()); const pending = useRef(0); const revision = useRef(0); const refreshId = useRef(0);
 const apply = async (value: AppData) => { current.current = value; setData(value); try { await AsyncStorage.setItem(KEY, JSON.stringify(value)); } catch { setError('Saved to the server, but this device cache is unavailable.'); } };
 const refresh = async () => { if (pending.current) return; const version = revision.current; const requestId = ++refreshId.current; try { const next = await getGarden(); if (!pending.current && version === revision.current && requestId === refreshId.current) { setError(null); await apply(next); } } catch { if (version !== revision.current || requestId !== refreshId.current) return; setError('Server unavailable. Showing cached data; reconnect before saving.'); } };
 useEffect(() => { (async () => { try { const raw = await AsyncStorage.getItem(KEY); if (raw) { const cached = JSON.parse(raw); if (cached.version === 1 && Array.isArray(cached.plants) && Array.isArray(cached.events) && Array.isArray(cached.sensors)) { current.current = cached; setData(cached); } } } catch {} await refresh(); setReady(true); })(); const timer = setInterval(refresh, 30000); const sub = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); }); return () => { clearInterval(timer); sub.remove(); }; }, []);
 const update = (fn: (d: AppData) => AppData) => { pending.current++; revision.current++; const operation = queue.current.then(async () => { try { const before = current.current; const after = fn(before); const saved = await persistChanges(before, after); setError(null); await apply(saved); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); try { await apply(await getGarden()); } catch {} throw e; } finally { pending.current--; } }); queue.current = operation.catch(() => {}); return operation; };
 return <Context.Provider value={{ data, update, ready, storageError, refresh }}>{children}</Context.Provider>;
}
export const useStore = () => useContext(Context);
