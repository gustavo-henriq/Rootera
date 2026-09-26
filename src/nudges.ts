/**
 * Local nudges on the phone. Scheduled on the device (no push server): a daily soil-check
 * nudge at the chosen time, about the plant that most needs one, with "Dry" and "Still
 * moist" buttons that record the check without opening the app; and a weekly look at the
 * leaves when that nudge is on. Everything is rescheduled whenever the garden or the
 * settings change, so a nudge never names a plant that no longer needs it.
 */
import { Platform } from 'react-native';
import { api } from './api';
import { byUrgency, Garden, newId } from './model';
import { lang, t, tn } from './i18n';

const CATEGORY = 'rootera-soil-check';
let configured = false;
/** The buttons are registered in one language; register again when it changes. */
let categoryLang = '';

async function notifications() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-notifications'); } catch { return null; }
}

async function configure() {
  const N = await notifications();
  if (!N) return N;
  if (categoryLang !== lang()) {
    categoryLang = lang();
    await N.setNotificationCategoryAsync(CATEGORY, [
      { identifier: 'dry', buttonTitle: t('Dry'), options: { opensAppToForeground: false } },
      { identifier: 'moist', buttonTitle: t('Still moist'), options: { opensAppToForeground: false } },
    ]).catch(() => undefined);
  }
  if (configured) return N;
  configured = true;
  N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  // A button press is a real soil check, recorded like any other (the app refreshes on open).
  N.addNotificationResponseReceivedListener(r => {
    const data = r.notification.request.content.data as { plantId?: string } | undefined;
    const soil = r.actionIdentifier === 'dry' ? 'dry' : r.actionIdentifier === 'moist' ? 'moist' : null;
    if (!soil || !data?.plantId) return;
    void api.logCare({ id: newId('care'), plantId: data.plantId, type: 'Soil check', soil, note: t('From a nudge'), at: new Date().toISOString(), source: 'USER' }).catch(() => undefined);
  });
  return N;
}

/** Replace every scheduled Rootera nudge with ones that match the garden right now. */
export async function scheduleNudges(garden: Garden) {
  const N = await configure();
  if (!N) return;
  try {
    const perm = await N.getPermissionsAsync();
    await N.cancelAllScheduledNotificationsAsync();
    if (!perm.granted || !garden.reminders || !garden.nudges?.kinds.length) return;
    const [hour, minute] = (garden.nudges.time ?? '08:00').split(':').map(Number);
    const detail = garden.caregiver?.detail ?? 'Guided';
    if (garden.nudges.kinds.includes('soil_check')) {
      const needs = byUrgency(garden).filter(p => { const a = garden.twins[p.id]?.guidance.action; return a === 'check_soil' || a === 'log_water'; });
      const first = needs[0];
      if (first) {
        const g = garden.twins[first.id]?.guidance;
        const others = needs.length - 1;
        await N.scheduleNotificationAsync({
          content: {
            title: t('Worth a soil check: {name}', { name: first.name }),
            body: detail === 'Guided'
              ? `${t('{title}. Push a finger into the soil and tell Rootera how it feels.', { title: g?.title ?? t('Check the soil') })}${others ? ` ${tn(others, '{n} more plant needs you today.', '{n} more plants need you today.')}` : ''}`
              : `${g?.title ?? t('Check the soil')}.${others ? ` ${t('+{n} more.', { n: others })}` : ''}`,
            categoryIdentifier: CATEGORY, data: { plantId: first.id },
          },
          trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
      }
    }
    if (garden.nudges.kinds.includes('leaves') && garden.plants.length) {
      await N.scheduleNotificationAsync({
        content: { title: t('How do the leaves look?'), body: detail === 'Guided' ? t('A quick look now and then helps spot changes early. Note anything new in Rootera.') : t('Take a quick look at the leaves.') },
        trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour, minute },
      });
    }
  } catch { /* nudges are best effort; the app works without them */ }
}
