/**
 * Nudges are offered once, on Today, right after the first plant is in: by then the person
 * has seen what a nudge would be about. One sentence, the time it would come, and two
 * choices. The phone's own permission prompt only follows "Turn on nudges" (Apple HIG:
 * ask in context). Either answer is remembered on this device; You > Nudges changes it later.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, Chip, T } from '../ds/components';
import { Glyph } from '../ds/icons';
import { requestNudgePermission } from './onboarding/Nudges';
import { scheduleNudges } from '../nudges';
import { track } from '../analytics';
import { useProfileAsking } from './ProfileInvite';
import { t } from '../i18n';
import { supportedNudges } from '../nudges';

const ASKED = 'rootera:nudge-invite:asked';
const TIMES = ['07:00', '08:00', '09:00', '19:00'];

export function NudgeInvite() {
  const { garden, saveProfile } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [busy, setBusy] = useState(false);
  const first = garden.plants.find(p => !p.example);
  const off = !garden.reminders || !supportedNudges(garden.nudges?.kinds).length;
  // One sheet at a time: the profile comes first.
  const profileAsking = useProfileAsking();

  useEffect(() => {
    if (!garden.onboarded || !first || !off) return;
    let live = true;
    AsyncStorage.getItem(ASKED).then(v => {
      // A short pause, so Today has settled before the sheet comes up.
      if (live && v !== '1') setTimeout(() => live && setOpen(true), reduceMotion ? 0 : 700);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [garden.onboarded, !!first, off]);

  if (!open || !first || profileAsking) return null;
  const done = () => { setOpen(false); AsyncStorage.setItem(ASKED, '1').catch(() => undefined); };
  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const kept = supportedNudges(garden.nudges?.kinds);
      const nudges = { kinds: kept.length ? kept : ['soil_check' as const], time };
      await saveProfile({ reminders: true, nudges });
      const granted = await requestNudgePermission();
      track('notification_permission', { granted, from: 'invite' });
      if (granted) void scheduleNudges({ ...garden, reminders: true, nudges });
    } catch { /* the setting can be changed any time in You */ }
    finally { setBusy(false); done(); }
  };
  const notNow = () => { track('nudge_invite_declined', {}); done(); };

  return <Modal transparent visible animationType="none" onRequestClose={notNow} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Not now')} onPress={notNow} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)}
        style={{ width: '100%', maxWidth: 440, backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome, padding: space.gutter, paddingBottom: insets.bottom + space[5], gap: space[4] }}>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <Glyph name="bell" size={24} tone={c.leafText} />
          <View style={{ flex: 1, gap: space[1] }}>
            <T v="title2" accessibilityRole="header">{t('Want a nudge when your {name} needs you?', { name: first.name })}</T>
            <T v="subhead" tone="ink2">{t('Only when a soil check would help.')}</T>
          </View>
        </View>
        <View style={{ gap: space[2] }}>
          <T v="footnote" tone="ink2">{t('When they arrive')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {TIMES.map(h => <Chip key={h} label={h} selected={time === h} onPress={() => setTime(h)} />)}
          </View>
        </View>
        <View style={{ gap: space[2] }}>
          <Btn title={t('Turn on nudges')} busy={busy} onPress={() => void turnOn()} />
          <Btn kind="plain" title={t('Not now')} onPress={notNow} style={{ alignSelf: 'center' }} />
        </View>
        <T v="footnote" tone="ink2" center>{t('You can change this any time in You.')}</T>
      </Animated.View>
    </View>
  </Modal>;
}
