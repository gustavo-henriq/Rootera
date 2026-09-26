/**
 * The name is asked on Today, and only after the first check-in, so it never competes
 * with the first useful thing the app does. It starts as one quiet line; tapping it opens
 * the field. "Not now" is remembered on this device.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Field, Glass, T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { t } from '../i18n';

const DISMISSED = 'rootera:name-invite:dismissed';
/** Set by the check-in screen after its first successful save. */
export const CHECKED_IN = 'rootera:checked-in';

export function NameInvite() {
  const { garden, saveProfile } = useStore();
  const { c } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(DISMISSED), AsyncStorage.getItem(CHECKED_IN)])
      .then(([dismissed, checked]) => setHidden(dismissed === '1' || checked !== '1'))
      .catch(() => setHidden(true));
  }, [garden.events.length]);
  if (hidden || garden.name || !garden.plants.length) return null;

  const dismiss = () => { setHidden(true); AsyncStorage.setItem(DISMISSED, '1').catch(() => undefined); };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { await saveProfile({ name: name.trim() }); }
    catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };

  if (!open) return <Animated.View entering={FadeIn.delay(300).duration(300)} exiting={FadeOut.duration(160)}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
    <Tap label={t("Add your name. It shows up here on Today.")} onPress={() => setOpen(true)} ring={radius.input} style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Glyph name="person" size={18} tone={c.ink2} />
      <T v="subhead" tone="ink2">{t("What should we call you?")}</T>
      <T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Add name")}</T>
    </Tap>
    <Tap label={t("Not now")} onPress={dismiss} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={16} tone={c.ink3} /></Tap>
  </Animated.View>;

  return <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(200)}>
    <Glass level="control" r={radius.card} shadow={false} style={{ padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headline">{t("What should we call you?")}</T>
          <T v="subhead" tone={error ? 'ink' : 'ink2'}>{error || t('Optional. It shows up here on Today.')}</T>
        </View>
        <Tap label={t("Not now")} onPress={dismiss} ring={22} style={{ width: 44, height: 44, marginTop: -10, marginRight: -10, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={18} /></Tap>
      </View>
      <Field label={t("Your name")} value={name} onChangeText={setName} maxLength={40} autoFocus onSubmitEditing={() => void save()} />
      <Btn size="regular" title={t("Save name")} busy={busy} disabled={!name.trim()} hint={t("Type a name to save it.")} onPress={() => void save()} />
    </Glass>
  </Animated.View>;
}
