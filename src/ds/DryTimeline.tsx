/**
 * The drying timeline under the plant's status: a day line from the last watering, the
 * window when the soil is usually found dry, and today moving toward (or past) it. The
 * filled part of the line is the time already gone, so "nearly dry" reads as a bar that
 * has almost reached the band. A general estimate is drawn hollow, a learned one solid.
 *
 * CycleBars shows the recent cycles side by side (days until dry), with the current one
 * dashed: the rhythm Rootera learned, at a glance.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ago, Forecast } from '../model';
import { locale, t, tn } from '../i18n';
import { useTheme } from './theme';
import { motion, radius, space } from './tokens';
import { T } from './components';
import { pivot } from './motion';

const DAY = 86400000;

/**
 * Where a plant is in its drying, the same phases the guidance uses (guidance.py): before
 * the first check is worth it, an early check (a general estimate opens its checks before
 * the window), inside the window, past it. Every surface that talks about the window uses this.
 */
export type Phase = 'before' | 'early' | 'window' | 'past';
export function phase(f: Forecast, since: number): Phase {
  const checkAfter = f.check_after_days ?? f.low_days;
  return since < checkAfter ? 'before' : since < f.low_days ? 'early' : since <= f.high_days ? 'window' : 'past';
}

/** "today", "tomorrow", or the weekday and date. */
export function dayName(at: number, now: number) {
  const days = Math.round((new Date(new Date(at).toDateString()).getTime() - new Date(new Date(now).toDateString()).getTime()) / DAY);
  return days <= 0 ? t('today') : days === 1 ? t('tomorrow') : new Date(at).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

export function DryTimeline({ forecast: f, lastWatered, now = Date.now() }: { forecast?: Forecast | null; lastWatered: string | null; now?: number }) {
  const { c, reduceMotion } = useTheme();
  const [w, setW] = React.useState(0);
  const since = lastWatered ? Math.max(0, (now - new Date(lastWatered).getTime()) / DAY) : null;
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => { if (!reduceMotion) fill.value = withTiming(1, { duration: motion.dur.fill, easing: Easing.out(Easing.cubic) }); }, [since !== null]);
  // Measured once the line is laid out; the fill grows from the watering to today.
  const fillW = useSharedValue(1);
  const progress = useAnimatedStyle(() => ({ transform: pivot(fillW.value, 6, 0, .5, [{ scaleX: Math.max(.001, fill.value) }]) }));

  if (!f || since === null) {
    return <View style={{ gap: space[2] }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.sunken }} />
      <T v="footnote" tone="ink2">{t('The timeline starts at the next watering you record.')}</T>
    </View>;
  }
  const own = f.source === 'cycles';
  const span = Math.max(f.high_days * 1.25, since + 1, f.high_days + 1);
  const x = (d: number) => Math.min(1, d / span) * w;
  const p = phase(f, since);
  const until = Math.max(1, Math.round((f.check_after_days ?? f.low_days) - since)), past = Math.max(1, Math.round(since - f.high_days));
  const state = p === 'before' ? tn(until, '{n} day until a check is worth it', '{n} days until a check is worth it')
    : p === 'early' ? t('Worth an early check') : p === 'window' ? t('In its drying window') : tn(past, 'Past its window by {n} day', 'Past its window by {n} days');
  const dryBy = f.dry_by ? new Date(f.dry_by).getTime() : new Date(lastWatered!).getTime() + f.high_days * DAY;
  fillW.value = Math.max(1, x(since));
  return <View accessible accessibilityLabel={`${state}. ${t('Usually dry {low} to {high} days after watering', { low: f.low_days, high: f.high_days })}`} style={{ gap: space[2] }}>
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: 30, justifyContent: 'center' }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.sunken }} />
      {!!w && <>
        {/* Time gone since the watering. */}
        <Animated.View style={[{ position: 'absolute', left: 0, width: Math.max(1, x(since)), height: 6, borderRadius: 3, backgroundColor: c.ink3 }, progress]} />
        {/* The drying window. */}
        <View style={{ position: 'absolute', left: x(f.low_days), width: Math.max(8, x(f.high_days) - x(f.low_days)), height: 12, borderRadius: radius.inner,
          backgroundColor: own ? c.leafMark : 'transparent', borderWidth: own ? 0 : 1.5, borderStyle: own ? 'solid' : 'dashed', borderColor: c.leafMark }} />
        {/* Today. */}
        <View style={{ position: 'absolute', left: x(since) - 1, width: 2, height: 26, borderRadius: 1, backgroundColor: c.ink }} />
      </>}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="caption" tone="ink2">{t('Watered {when}', { when: ago(lastWatered, now) })}</T>
      <T v="caption" tone="ink2">{t('Dry by {when}', { when: dayName(dryBy, now) })}</T>
    </View>
    <T v="subhead">{state}</T>
  </View>;
}

export function CycleBars({ days, since }: { days: number[]; since: number | null }) {
  const { c } = useTheme();
  if (!days.length) return null;
  const all = [...days, ...(since !== null ? [since] : [])];
  const max = Math.max(...all, 1);
  const H = 64;
  const fmt = (d: number) => d.toLocaleString(locale(), { maximumFractionDigits: 1 });
  return <View accessible accessibilityLabel={t('Recent cycles: {list} days', { list: days.map(fmt).join(', ') })} style={{ gap: space[2] }}>
    <T v="footnote" tone="ink2">{t('Recent cycles')}</T>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2], height: H }}>
      {days.map((d, i) => <View key={i} style={{ flex: 1, height: Math.max(6, (d / max) * H), borderRadius: radius.inner, backgroundColor: c.leafMark, opacity: .45 + .55 * ((i + 1) / days.length) }} />)}
      {since !== null && <View style={{ flex: 1, height: Math.max(6, (since / max) * H), borderRadius: radius.inner, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.leafMark }} />}
    </View>
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {days.map((d, i) => <T key={i} v="caption" tone="ink2" center style={{ flex: 1 }}>{t('{n} d', { n: fmt(d) })}</T>)}
      {since !== null && <T v="caption" tone="ink" center style={{ flex: 1 }}>{t('now')}</T>}
    </View>
  </View>;
}
