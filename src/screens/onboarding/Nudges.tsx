/**
 * The nudge picker (onboarding and You > Nudges) and the phone permission request.
 * The permission is asked for right after the first plant is planted, when the
 * reason is obvious (Apple HIG: request in context), never on first launch.
 */
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { NudgeKind } from '../../model';
import { useTheme } from '../../ds/theme';
import { radius, space } from '../../ds/tokens';
import { Chip, Glass, Segmented, T, Tap } from '../../ds/components';
import { Glyph } from '../../ds/icons';

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
  soil_check: { label: 'When a soil check would help', title: 'Worth a soil check', guided: 'Last watered 5 days ago. Last time the soil was dry around day 6. Push a finger in and tell me what you feel.', concise: 'Last watered 5 days ago. Check the soil.' },
  pattern: { label: 'When a pattern appears', title: 'A pattern is forming', guided: 'Across 3 cycles, the soil was first dry about 6 days after watering. That depends on how often you check.', concise: 'Usually dry about 6 days after watering.' },
  leaves: { label: 'A reminder to look at the leaves', title: 'How do the leaves look?', guided: 'A quick look now and then helps spot changes early. Note anything new.', concise: 'Take a quick look at the leaves.' },
  weekly: { label: 'A weekly recap', title: 'Your week', guided: '4 soil checks and 2 waterings across your plants. The monstera dried a little faster than usual.', concise: '4 checks, 2 waterings this week.' },
};
const kinds = Object.keys(nudgeCopy) as NudgeKind[];

function shiftTime(t: string, minutes: number) {
  const [h, m] = t.split(':').map(Number);
  const total = (h * 60 + m + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function NudgePicker({ selected, onToggle, detail, onDetail, time, onTime }: { selected: NudgeKind[]; onToggle: (k: NudgeKind) => void; detail: 'Guided' | 'Concise'; onDetail: (d: 'Guided' | 'Concise') => void; time: string; onTime: (t: string) => void }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState<NudgeKind>(selected[0] ?? 'soil_check');
  const copy = nudgeCopy[focus];
  const morning = Number(time.slice(0, 2)) < 12;
  return <View style={{ gap: space[5] }}>
    <Animated.View key={focus + detail + time} entering={FadeIn.duration(220)}>
      <Glass level="control" r={radius.card} style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Glyph name="sprout" size={16} tone={c.leafMark} />
          <T v="caption" tone="ink2" style={{ flex: 1 }}>Rootera</T>
          <T v="caption" tone="ink2">{time}</T>
        </View>
        <T v="headline">{copy.title}</T>
        <T v="subhead" tone="ink2">{detail === 'Guided' ? copy.guided : copy.concise}</T>
      </Glass>
    </Animated.View>

    <View>
      {kinds.map(k => {
        const on = selected.includes(k);
        return <Tap key={k} role="switch" selected={on} label={nudgeCopy[k].label} onPress={() => { onToggle(k); setFocus(k); }} ring={radius.inner} scaleTo={.99}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <View style={{ width: 22, height: 22, borderRadius: radius.inner, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {on && <Glyph name="check" size={15} tone={c.canvas} />}
          </View>
          <T v="body" style={{ flex: 1 }}>{nudgeCopy[k].label}</T>
          {k === 'soil_check' && <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.input, backgroundColor: c.successSoft }}><T v="caption" tone="leafText">Recommended</T></View>}
        </Tap>;
      })}
    </View>

    <View style={{ gap: space[2] }}>
      <T v="footnote" tone="ink2">How they sound</T>
      <Segmented values={['Guided', 'Concise'] as const} value={detail} onChange={onDetail} labels={{ Guided: 'Walk me through it', Concise: 'Just tell me' }} />
    </View>

    <View style={{ gap: space[3] }}>
      <T v="footnote" tone="ink2">When they arrive</T>
      <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
        <Glyph name="light" size={18} tone={morning ? c.leafText : c.amber} />
        <T v="subhead" style={{ flex: 1 }}>Mornings are best for watering. Watering nudges arrive at this time.</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <Tap label="Earlier" onPress={() => onTime(shiftTime(time, -15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">−</T></Tap>
        <T v="figure" accessibilityLabel={`Nudges at ${time}`} style={{ minWidth: 110, textAlign: 'center' }}>{time}</T>
        <Tap label="Later" onPress={() => onTime(shiftTime(time, 15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">+</T></Tap>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {['07:00', '08:00', '09:00', '19:00'].map(t => <Chip key={t} label={t} selected={time === t} onPress={() => onTime(t)} />)}
      </View>
    </View>
  </View>;
}
