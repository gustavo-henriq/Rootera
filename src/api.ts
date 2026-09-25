import { Platform } from 'react-native';
import { CareEvent, Caregiver, Garden, Nudges, Plan, Plant, PlantKind } from './model';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');
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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Can’t reach Rootera right now. Nothing was saved. Check your connection and try again.', 0, true);
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : 'Please check the information and try again.';
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
  archivePlant: (id: string) => request(`/v1/plants/${encodeURIComponent(id)}`, 'DELETE'),
  logCare: (e: CareEvent) => request<CareResult>(`/v1/plants/${encodeURIComponent(e.plantId)}/user-observations`, 'POST', {
    id: e.id, type: e.type, note: e.note, observed_at: e.at,
    soil: e.soil ?? null, amount_ml: e.amount_ml ?? null, ...(e.visual ? { visual: e.visual } : {}),
  }),
  demoPlan: (plan: Plan, annual: boolean) => request('/v1/demo/plan', 'POST', { plan, annual }),
  syncBilling: () => request<{ plan: Plan }>('/v1/billing/sync', 'POST'),
  identify: (image_base64: string) => request<{ results: Candidate[] }>('/v1/identify', 'POST', { image_base64 }, 30000),
};
