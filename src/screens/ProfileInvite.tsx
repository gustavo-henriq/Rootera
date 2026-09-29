/**
 * The profile is asked for once the person has put something in, the way Duolingo asks
 * before your progress would be lost: a suggestion after the first watering they record,
 * and required after the second (the watering is saved; the app waits for the name).
 *
 * Shipaton scope: the profile is only a name, and the sheet says so. Full accounts (email,
 * Sign in with Apple) come after, and would plug in here.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, Field, T } from '../ds/components';
import { track } from '../analytics';
import { t } from '../i18n';

const SUGGESTED = 'rootera:profile-invite:suggested';

/** Whether the profile sheet is up, so other sheets (the nudge invite) wait their turn. */
let asking = false;
const listeners = new Set<() => void>();
function setAsking(v: boolean) { if (v !== asking) { asking = v; listeners.forEach(l => l()); } }
export function useProfileAsking() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => asking);
}

export function ProfileInvite() {
  const { garden, saveProfile } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [suggestedBefore, setSuggestedBefore] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { AsyncStorage.getItem(SUGGESTED).then(v => setSuggestedBefore(v === '1')).catch(() => setSuggestedBefore(false)); }, []);

  // Waterings the person recorded on their own plants (not the example, not the rough one at setup).
  const waterings = useMemo(() => {
    const own = new Set(garden.plants.filter(p => !p.example).map(p => p.id));
    return garden.events.filter(e => e.type === 'Watered' && !e.approximate && own.has(e.plantId)).length;
  }, [garden.events, garden.plants]);

  const needed = garden.onboarded && !garden.name.trim();
  const required = needed && waterings >= 2;
  const suggested = needed && waterings === 1 && suggestedBefore === false && !dismissed;
  const showing = required || suggested;
  useEffect(() => { setAsking(showing); return () => setAsking(false); }, [showing]);
  if (!showing) return null;

  const later = () => {
    setDismissed(true);
    AsyncStorage.setItem(SUGGESTED, '1').catch(() => undefined);
    track('profile_invite_later', {});
  };
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try {
      await saveProfile({ name: name.trim() });
      AsyncStorage.setItem(SUGGESTED, '1').catch(() => undefined);
      track('profile_created', { required });
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };

  return <Modal transparent visible animationType="none" onRequestClose={required ? () => undefined : later} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      {/* Required: the backdrop does not close it. */}
      {!required && <Pressable accessibilityRole="button" accessibilityLabel={t('Not now')} onPress={later} style={StyleSheet.absoluteFill} />}
    </Animated.View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)}
        style={{ width: '100%', maxWidth: 440, backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome, padding: space.gutter, paddingBottom: insets.bottom + space[5], gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <T v="title2" accessibilityRole="header">{required ? t('One last thing: your name') : t('What should we call you?')}</T>
          <T v="subhead" tone="ink2">{required ? t('Create your profile to keep looking after your plants.') : t('Create your profile to keep your garden.')}</T>
        </View>
        <Field label={t('Your name')} value={name} onChangeText={setName} maxLength={40} autoFocus onSubmitEditing={() => void save()} />
        {!!error && <T v="footnote" tone="danger">{error}</T>}
        <View style={{ gap: space[2] }}>
          <Btn title={t('Create profile')} busy={busy} disabled={!name.trim()} hint={t('Type a name to save it.')} onPress={() => void save()} />
          {!required && <Btn kind="plain" title={t('Not now')} onPress={later} style={{ alignSelf: 'center' }} />}
        </View>
        <View style={{ borderTopWidth: 1, borderColor: c.leafMark, paddingTop: space[3] }}>
          <T v="footnote" tone="ink2">{t('During Shipaton, your profile is only your name. Full accounts come after.')}</T>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}
