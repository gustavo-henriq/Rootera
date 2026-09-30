/**
 * The nudge picker (onboarding and You > Nudges) and the phone permission request.
 * The permission is asked for right after the first plant is planted, when the
 * reason is obvious (Apple HIG: request in context), never on first launch.
 */
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { NudgeKind } from '../../model';
import { useTheme } from '../../ds/theme';
import { fonts, motion, radius, space, springs } from '../../ds/tokens';
import { Chip, Glass, T, Tap } from '../../ds/components';
import { Glyph } from '../../ds/icons';
import { t } from '../../i18n';
import { enter, pivot } from '../../ds/motion';

/**
 * Asks the OS for notification permission. Returns whether nudges can reach the phone.
 * Scheduling is not built yet: nudges show inside Rootera until push is connected.
 */
export async function requestNudgePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const N = await import('expo-notifications');
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return next.granted;
  } catch {
    return false;
  }
}

const nudgeCopy: Record<NudgeKind, { label: string; title: string; guided: string; concise: string }> = {
  soil_check: { label: 'When a soil check would help', title: 'Worth a soil check', guided: 'Watered 5 days ago. Last time it dried around day 6. Worth a soil check.', concise: 'Last watered 5 days ago. Check the soil.' },
  leaves: { label: 'A reminder to look at the leaves', title: 'How do the leaves look?', guided: 'A quick look helps spot changes early.', concise: 'Take a quick look at the leaves.' },
};
const kinds = Object.keys(nudgeCopy) as NudgeKind[];

function shiftTime(t: string, minutes: number) {
  const [h, m] = t.split(':').map(Number);
  const total = (h * 60 + m + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** A little message whose extra lines fold away in the short mode. */
function MessageGlyph({ on }: { on: boolean }) {
  const { c } = useTheme();
  const p = useSharedValue(on ? 1 : 0);
  React.useEffect(() => { p.value = withSpring(on ? 1 : 0, springs.smooth); }, [on]);
  const first = useAnimatedStyle(() => ({ width: 16 + 6 * p.value }));
  const rest = useAnimatedStyle(() => ({ opacity: p.value, transform: pivot(18, 3, 0, .5, [{ scaleX: .3 + .7 * p.value }]) }));
  const last = useAnimatedStyle(() => ({ opacity: p.value, transform: pivot(12, 3, 0, .5, [{ scaleX: .3 + .7 * p.value }]) }));
  const styles = [first, rest, last];
  return <View style={{ width: 44, height: 44, borderRadius: radius.control, backgroundColor: on ? c.successSoft : c.sunken, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 10, gap: 4 }}>
    {[22, 18, 12].map((w, i) => <Animated.View key={i} style={[{ height: 3, width: w, borderRadius: 2, backgroundColor: on ? c.leafText : c.ink2 }, styles[i]]} />)}
  </View>;
}

/** Guided or concise nudges, as one switch: on means Rootera walks you through it. */
function DetailSwitch({ detail, onDetail }: { detail: 'Guided' | 'Concise'; onDetail: (d: 'Guided' | 'Concise') => void }) {
  const { c, reduceMotion } = useTheme();
  const on = detail === 'Guided';
  const x = useSharedValue(on ? 1 : 0);
  React.useEffect(() => { x.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, { damping: 15, stiffness: 260 }); }, [on]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: 3 + x.value * 24 }, { scale: 1 + .06 * Math.sin(x.value * Math.PI) }] }));
  const track = useAnimatedStyle(() => ({ opacity: x.value }));
  const title = on ? t('Walk me through it') : t('Just tell me');
  const hint = on ? t('Explains what to check, how, and why.') : t('One short line. Straight to the point.');
  return <Tap role="switch" selected={on} label={`${t('Detailed nudges')}. ${title}. ${hint}`} onPress={() => onDetail(on ? 'Concise' : 'Guided')} ring={radius.card} scaleTo={.98}>
    <Glass level="control" r={radius.card} shadow={false} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], minHeight: 72 }}>
      <MessageGlyph on={on} />
      <View style={{ flex: 1, gap: 2 }}>
        <Animated.View key={title} entering={reduceMotion ? undefined : enter.fade()} exiting={reduceMotion ? undefined : FadeOut.duration(motion.dur.fast)}>
          <T v="headline" style={{ fontFamily: fonts.medium }}>{title}</T>
          <T v="footnote" tone="ink2">{hint}</T>
        </Animated.View>
      </View>
      <View style={{ width: 54, height: 32, borderRadius: 16, backgroundColor: c.ink3, justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: c.leafMark }, track]} />
        <Animated.View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: .18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, thumb]} />
      </View>
    </Glass>
  </Tap>;
}

export function NudgePicker({ selected, onToggle, detail, onDetail, time, onTime }: { selected: NudgeKind[]; onToggle: (k: NudgeKind) => void; detail: 'Guided' | 'Concise'; onDetail: (d: 'Guided' | 'Concise') => void; time: string; onTime: (t: string) => void }) {
  const { c, reduceMotion } = useTheme();
  const [focus, setFocus] = useState<NudgeKind>(selected[0] ?? 'soil_check');
  const copy = nudgeCopy[focus];
  // The watering tip only appears when it is useful: nudges set for late afternoon or evening.
  const late = Number(time.slice(0, 2)) >= 16;
  return <View style={{ gap: space[5] }}>
    <Animated.View key={focus + detail + time} entering={reduceMotion ? undefined : enter.fade()}>
      <Glass level="control" r={radius.card} style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Glyph name="sprout" size={16} tone={c.leafMark} />
          <T v="caption" tone="ink2" style={{ flex: 1 }}>{t("Rootera")}</T>
          <T v="caption" tone="ink2">{time}</T>
        </View>
        <T v="headline">{t(copy.title)}</T>
        <T v="subhead" tone="ink2">{t(detail === 'Guided' ? copy.guided : copy.concise)}</T>
      </Glass>
    </Animated.View>

    <View>
      {kinds.map(k => {
        const on = selected.includes(k);
        return <Tap key={k} role="switch" selected={on} label={t(nudgeCopy[k].label)} onPress={() => { onToggle(k); setFocus(k); }} ring={radius.inner} scaleTo={.99}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <View style={{ width: 22, height: 22, borderRadius: radius.inner, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {on && <Glyph name="check" size={15} tone={c.canvas} />}
          </View>
          <T v="body" style={{ flex: 1 }}>{t(nudgeCopy[k].label)}</T>
          {k === 'soil_check' && <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.input, backgroundColor: c.successSoft }}><T v="caption" tone="leafText">{t("Recommended")}</T></View>}
        </Tap>;
      })}
    </View>

    <View style={{ gap: space[2] }}>
      <T v="footnote" tone="ink2">{t("How they sound")}</T>
      <DetailSwitch detail={detail} onDetail={onDetail} />
    </View>

    <View style={{ gap: space[3] }}>
      <T v="footnote" tone="ink2">{t("When they arrive")}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <Tap label={t("Earlier")} onPress={() => onTime(shiftTime(time, -15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">−</T></Tap>
        <T v="figure" accessibilityLabel={t('Nudges at {time}', { time })} style={{ minWidth: 110, textAlign: 'center' }}>{time}</T>
        <Tap label={t("Later")} onPress={() => onTime(shiftTime(time, 15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">+</T></Tap>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {['07:00', '08:00', '09:00', '19:00'].map(h => <Chip key={h} label={h} selected={time === h} onPress={() => onTime(h)} />)}
      </View>
      {late && <Animated.View entering={reduceMotion ? undefined : enter.fade()} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
        <Glyph name="light" size={18} tone={c.amber} />
        <T v="subhead" style={{ flex: 1 }}>{t("Morning is best for watering: the soil dries during the day.")}</T>
      </Animated.View>}
    </View>
  </View>;
}
