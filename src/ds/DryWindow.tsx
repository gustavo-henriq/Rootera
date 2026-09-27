/**
 * The drying window: roughly how many days after a watering this plant's soil is found dry,
 * drawn as a band on a day line with a marker for today. Where the window comes from is
 * always said: the person's own cycles, or a general estimate for the species and pot
 * (named factors), or a mix of both while the first cycles come in. Until a pattern exists,
 * the server uses this same window to decide when a check is worth asking for.
 */
import React from 'react';
import { View } from 'react-native';
import { Forecast } from '../model';
import { locale, t, tn } from '../i18n';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { SourceLabel, T } from './components';

const factorLabel: Record<string, string> = {
  small_pot: 'small pot', large_pot: 'large pot', terracotta: 'terracotta pot', no_drainage: 'no drainage hole',
  chunky_mix: 'chunky soil', dense_mix: 'dense soil', direct_sun: 'direct sun', bright_light: 'bright light',
  low_light: 'low light', outdoors: 'outdoors',
};
const DAY = 86400000;

/** "today", "tomorrow", or the weekday and date. */
function dayName(at: number, now: number) {
  const days = Math.round((new Date(new Date(at).toDateString()).getTime() - new Date(new Date(now).toDateString()).getTime()) / DAY);
  return days <= 0 ? t('today') : days === 1 ? t('tomorrow') : new Date(at).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
}

export function DryWindow({ forecast: f, lastWatered, now = Date.now() }: { forecast: Forecast; lastWatered: string | null; now?: number }) {
  const { c } = useTheme();
  const own = f.source === 'cycles';
  const range = `${f.low_days}–${f.high_days}`;
  const headline = own ? t('Usually dry {range} days after watering', { range }) : t('Likely dry {range} days after watering', { range });
  const since = lastWatered ? Math.max(0, (now - new Date(lastWatered).getTime()) / DAY) : null;
  const checkFrom = f.check_from ? new Date(f.check_from).getTime() : null;
  const dryBy = f.dry_by ? new Date(f.dry_by).getTime() : null;
  const next = checkFrom === null || dryBy === null ? t('It starts counting from the next watering you record.')
    : now < checkFrom ? t('Suggested next check: {date}', { date: dayName(checkFrom, now) })
    : now <= dryBy ? t('It may be dry now. A soil check will tell.')
    : t('Past its usual window. Worth a soil check.');
  const source = own ? t('Learned from your records')
    : f.source === 'blend' ? tn(f.cycles, 'Your first cycle, mixed with a general estimate', 'Your first {n} cycles, mixed with a general estimate')
    : t('General estimate for this species and pot');
  // The day line: a little past the window, and far enough to show today.
  const span = Math.max(f.high_days * 1.3, (since ?? 0) + 1, f.high_days + 2);
  const at = (d: number) => `${Math.min(100, (d / span) * 100)}%` as const;
  return <View accessible accessibilityLabel={`${headline}. ${next} ${source}.`} style={{ gap: space[2] }}>
    <SourceLabel kind={own ? 'suggested' : 'species'} text={source} />
    <T v="headline">{headline}</T>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 34, justifyContent: 'center' }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.sunken }} />
      {/* A general estimate is drawn hollow: it is a guess about plants like this one. */}
      <View style={{ position: 'absolute', left: at(f.low_days), width: `${((f.high_days - f.low_days) / span) * 100}%`, minWidth: 8, height: 12, borderRadius: radius.inner,
        backgroundColor: own ? c.leafMark : 'transparent', borderWidth: own ? 0 : 1.5, borderStyle: own ? 'solid' : 'dashed', borderColor: c.leafMark }} />
      {since !== null && <View style={{ position: 'absolute', left: at(since), marginLeft: -1, width: 2, height: 26, borderRadius: 1, backgroundColor: c.ink }} />}
      <View style={{ position: 'absolute', left: 0, bottom: -12, flexDirection: 'row', width: '100%' }}>
        {(since === null || since / span > .2) && <T v="caption" tone="ink2">{t('Watered')}</T>}
        {since !== null && <T v="caption" tone="ink" style={{ position: 'absolute', left: at(since), marginLeft: -16 }}>{t('Today')}</T>}
      </View>
    </View>
    <T v="subhead" tone="ink2" style={{ marginTop: space[2] }}>{next}</T>
    {!!f.factors.length && <T v="footnote" tone="ink2">{t('Adjusted for: {list}.', { list: f.factors.map(k => t(factorLabel[k] ?? k)).join(', ') })}</T>}
    {!own && <T v="footnote" tone="ink2">{t('Your own checks replace this estimate after three watering cycles.')}</T>}
  </View>;
}
