/**
 * Product analytics: anonymous events (a name and a few flat flags) batched to the
 * Rootera backend. Used for the onboarding funnel. Never blocks or breaks the UI:
 * a failed send is dropped, not retried forever.
 */
import { request } from './api';

type Props = Record<string, string | number | boolean>;
let queue: { name: string; at: string; props: Props }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = queue.splice(0, 50);
  if (!batch.length) return;
  try { await request('/v1/events', 'POST', { events: batch }, 6000); } catch { /* analytics must never affect the app */ }
  if (queue.length) timer = setTimeout(flush, 1500);
}

export function track(name: string, props: Props = {}) {
  queue.push({ name, at: new Date().toISOString(), props });
  if (!timer) timer = setTimeout(flush, 1500);
}
