import { Platform } from 'react-native';
import { AppData } from './model';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');
const token = process.env.EXPO_PUBLIC_DEMO_TOKEN || 'rootera-local-demo';
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
 try { const response = await fetch(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal }); const payload = await response.json(); if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : 'Please check the submitted information.'); return payload; }
 catch (e) { if (e instanceof Error && (e.name === 'AbortError' || /fetch|network/i.test(e.message))) throw new Error('The Rootera server is unavailable. Please reconnect before saving.'); throw e; }
 finally { clearTimeout(timer); }
}
export const getGarden = () => request<AppData>('/v1/garden');
/** User actions and device measurements use separate API contracts. */
export async function persistChanges(before: AppData, after: AppData): Promise<AppData> {
 if (JSON.stringify(before.caregiver) !== JSON.stringify(after.caregiver) || before.name !== after.name || before.onboarded !== after.onboarded || before.reminders !== after.reminders) await request('/v1/profile', 'PATCH', { name: after.name, onboarded: after.onboarded, reminders: after.reminders, ...(after.caregiver ? {caregiver:after.caregiver} : {}) });
 if (before.plan !== after.plan || before.annual !== after.annual) await request('/v1/demo/plan', 'POST', { plan: after.plan, annual: after.annual });
 for (const plant of after.plants.filter(p => !before.plants.some(old => old.id === p.id))) await request('/v1/plants', 'POST', plant);
 for (const e of after.events.filter(e => !before.events.some(old => old.id === e.id))) await request(`/v1/plants/${encodeURIComponent(e.plantId)}/user-observations`, 'POST', { id: e.id, type: e.type, note: e.note, soil: e.soil ?? null, amount_ml: e.amount_ml ?? null, observed_at: e.at, ...(e.visual ? {visual:e.visual} : {}) });
 for (const sensor of after.sensors.filter(s => !before.sensors.some(old => JSON.stringify(old) === JSON.stringify(s)))) {
  if (!sensor.demo) throw new Error('Real readings must come from the device ingestion API.');
  const { id, plantId, name, dry, wet, moisture, observedAt, source, demo } = sensor;
  await request('/v1/demo/sensors', 'POST', { id, plantId, name, dry, wet, moisture, observedAt, source, demo });
 }
 return getGarden();
}
