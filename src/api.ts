import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { CareEvent, Caregiver, Garden, Nudges, Plan, Plant, PlantKind } from './model';
import { lang, t } from './i18n';

/**
 * Where the API lives. "metro" means: through the dev server that served this bundle
 * (metro.config.js forwards /rootera-api), which also works over an Expo tunnel.
 */
function apiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured === 'metro') {
    const bundle: string | undefined = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.href : undefined) : NativeModules.SourceCode?.scriptURL;
    // With the new architecture NativeModules.SourceCode can be missing; Expo still knows
    // the dev server it loaded from ("192.168.0.129:8081", or a tunnel host served over https).
    const host = Constants.expoConfig?.hostUri;
    const fromHost = host ? `${/\.exp\.direct$|ngrok/.test(host.split(':')[0]) ? 'https' : 'http'}://${host}` : undefined;
    const origin = bundle?.match(/^(https?:\/\/[^/]+)/)?.[1] ?? fromHost;
    if (origin) return `${origin}/rootera-api`;
  }
  if (configured && configured !== 'metro') return configured;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
}
export const API_URL = apiUrl();
// Preview access only. Real accounts replace this with a per-user session token.
const token = process.env.EXPO_PUBLIC_DEMO_TOKEN || 'rootera-local-demo';

export class ApiError extends Error {
  constructor(message: string, public status: number, public offline = false) { super(message); }
}

export async function request<T>(path: string, method = 'GET', body?: unknown, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method, signal: controller.signal,
      // The server writes its guidance in the app's language.
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Language': lang() === 'pt' ? 'pt-BR' : 'en' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(t('No connection. Nothing was saved. Try again.'), 0, true);
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : t('Please check the information and try again.');
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}

export interface CareResult { id: string; duplicate: boolean; change: { from: string; to: string } | null }
export interface Candidate { scientific_name: string; common_name: string; family: string; kind: PlantKind; score: number }

export const api = {
  garden: () => request<Garden>('/v1/garden'),
  profile: (changes: Partial<{ name: string; onboarded: boolean; reminders: boolean; caregiver: Caregiver; nudges: Nudges }>) => request('/v1/profile', 'PATCH', changes),
  addPlant: (plant: Plant) => request<Plant>('/v1/plants', 'POST', plant),
  updatePlant: (id: string, changes: Partial<Plant>) => request<Plant>(`/v1/plants/${encodeURIComponent(id)}`, 'PATCH', changes),
  archivePlant: (id: string, reason: 'died' | 'given' | 'left' | 'removed' = 'removed') => request(`/v1/plants/${encodeURIComponent(id)}?reason=${reason}`, 'DELETE'),
  logCare: (e: CareEvent) => request<CareResult>(`/v1/plants/${encodeURIComponent(e.plantId)}/user-observations`, 'POST', {
    id: e.id, type: e.type, note: e.note, observed_at: e.at,
    soil: e.layers ? null : e.soil ?? null, ...(e.layers ? { layers: e.layers } : {}), amount_ml: e.amount_ml ?? null, ...(e.visual ? { visual: e.visual } : {}), ...(e.approximate ? { approximate: true } : {}),
  }),
  demoPlan: (plan: Plan, annual: boolean) => request('/v1/demo/plan', 'POST', { plan, annual }),
  syncBilling: () => request<{ plan: Plan }>('/v1/billing/sync', 'POST'),
  identify: (image_base64: string) => request<{ results: Candidate[] }>('/v1/identify', 'POST', { image_base64 }, 30000),
  /** Older care records, newest first, beyond what the garden snapshot carries. */
  journal: (q: { before?: string; limit?: number; plant?: string }) => {
    const params = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return request<{ events: CareEvent[]; more: boolean }>(`/v1/journal${params ? `?${params}` : ''}`);
  },
  removeCare: (plantId: string, id: string) => request<{ removed: boolean; change: CareResult['change'] }>(`/v1/plants/${encodeURIComponent(plantId)}/user-observations/${encodeURIComponent(id)}`, 'DELETE'),
};
