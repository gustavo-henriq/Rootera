/**
 * Local nudges on the phone, scheduled on the device (no push server).
 *
 * - Soil check: at the chosen time, for each of the next days, about the plant that most
 *   needs a check that day (from the same drying window the app shows). Tapping it opens
 *   that plant's check, in three layers like every other check. A day with nothing due
 *   sends nothing, so a nudge never repeats old news while the app stays closed.
 * - Leaves: a weekly reminder to look at the leaves.
 * Everything is rescheduled whenever the garden or the settings change.
 */
import { Platform } from 'react-native';
import { byUrgency, Garden, NudgeKind, Plant } from './model';
import { t, tn } from './i18n';

/** Nudge kinds the phone can deliver. Older profiles may list others; they are ignored. */
export const NUDGE_KINDS: NudgeKind[] = ['soil_check', 'leaves'];
export const supportedNudges = (kinds?: string[]) => (kinds ?? []).filter((k): k is NudgeKind => (NUDGE_KINDS as string[]).includes(k));

/** Days of soil-check nudges scheduled ahead; opening the app replaces them. */
const AHEAD = 7;
const DAY = 86400000;
let configured = false;
let opener: ((plantId: string | null) => void) | null = null;
let pending: string | null | undefined;

async function notifications() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-notifications'); } catch { return null; }
}

/** Where a tapped nudge leads; the app registers this once navigation is ready. */
export function onNudgeOpen(open: (plantId: string | null) => void) {
  opener = open;
  if (pending !== undefined) { open(pending); pending = undefined; }
  return () => { if (opener === open) opener = null; };
}

async function configure() {
  const N = await notifications();
  if (!N || configured) return N;
  configured = true;
  N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  const route = (r: { notification: { request: { content: { data?: unknown } } } }) => {
    const id = (r.notification.request.content.data as { plantId?: string } | undefined)?.plantId ?? null;
    if (opener) opener(id); else pending = id;
  };
  N.addNotificationResponseReceivedListener(route);
  // Opened from a nudge while the app was closed: handled once, then forgotten.
  const last = await N.getLastNotificationResponseAsync().catch(() => null);
  if (last) { route(last); await N.clearLastNotificationResponseAsync?.().catch(() => undefined); }
  return N;
}

/** The plants worth a check on a given day, most urgent first. */
function dueOn(garden: Garden, plants: Plant[], day: number, now: number) {
  const end = new Date(now + day * DAY);
  end.setHours(23, 59, 59, 999);
  return plants.filter(p => {
    const g = garden.twins[p.id]?.guidance;
    if (!g) return false;
    if (g.action === 'check_soil' || g.action === 'log_water') return true;
    const from = g.forecast?.check_from;
    return !!from && new Date(from).getTime() <= end.getTime();
  });
}

/** Replace every scheduled Rootera nudge with ones that match the garden right now. */
export async function scheduleNudges(garden: Garden) {
  const N = await configure();
  if (!N) return;
  try {
    const perm = await N.getPermissionsAsync();
    await N.cancelAllScheduledNotificationsAsync();
    const kinds = supportedNudges(garden.nudges?.kinds);
    if (!perm.granted || !garden.reminders || !kinds.length) return;
    const [hour, minute] = (garden.nudges?.time ?? '08:00').split(':').map(Number);
    const guided = (garden.caregiver?.detail ?? 'Guided') === 'Guided';
    // The example plant never sends a nudge to the phone.
    const own = byUrgency(garden).filter(p => !p.example);
    if (kinds.includes('soil_check')) {
      const now = Date.now();
      const first = new Date(now);
      first.setHours(hour, minute, 0, 0);
      const skip = first.getTime() <= now ? 1 : 0;
      for (let day = skip; day < AHEAD + skip; day++) {
        const due = dueOn(garden, own, day, now);
        if (!due.length) continue;
        const date = new Date(first.getTime() + day * DAY);
        const others = due.length - 1;
        // Only today's nudge can quote today's guidance; later ones say what stays true.
        const title = day === 0 ? garden.twins[due[0].id]?.guidance.title ?? t('Check the soil') : t('Check the soil');
        const more = others ? tn(others, '{n} more plant needs you today.', '{n} more plants need you today.') : '';
        await N.scheduleNotificationAsync({
          content: {
            title: t('Worth a soil check: {name}', { name: due[0].name }),
            body: guided ? `${t('{title}. Check the soil at three depths.', { title })}${more ? ` ${more}` : ''}` : `${title}.${others ? ` ${t('+{n} more.', { n: others })}` : ''}`,
            data: { plantId: due[0].id },
          },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date },
        });
      }
    }
    if (kinds.includes('leaves') && own.length) {
      await N.scheduleNotificationAsync({
        content: { title: t('How do the leaves look?'), body: guided ? t('A quick look helps spot changes early.') : t('Take a quick look at the leaves.') },
        trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour, minute },
      });
    }
  } catch { /* nudges are best effort; the app works without them */ }
}
