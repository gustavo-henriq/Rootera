/**
 * The name is asked here, on Today, after the first plant, never as an onboarding
 * gate. One field, dismissible; "Not now" is remembered on this device.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { radius, space } from '../ds/tokens';
import { Btn, Field, Glass, T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';

const KEY = 'rootera:name-invite:dismissed';

export function NameInvite() {
  const { garden, saveProfile } = useStore();
  const [hidden, setHidden] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => setHidden(v === '1')).catch(() => setHidden(false)); }, []);
  if (hidden || garden.name || !garden.plants.length) return null;

  const dismiss = () => { setHidden(true); AsyncStorage.setItem(KEY, '1').catch(() => undefined); };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try { await saveProfile({ name: name.trim() }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  return <Animated.View entering={FadeInDown.delay(600).duration(420)} exiting={FadeOut.duration(200)}>
    <Glass level="control" r={radius.card} shadow={false} style={{ padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headline">What should we call you?</T>
          <T v="subhead" tone="ink2">{error || 'Optional. It shows up here on Today.'}</T>
        </View>
        <Tap label="Not now" onPress={dismiss} ring={22} style={{ width: 44, height: 44, marginTop: -10, marginRight: -10, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={18} /></Tap>
      </View>
      <Field label="Your name" value={name} onChangeText={setName} maxLength={40} onSubmitEditing={() => void save()} />
      <Btn size="regular" title="Save name" busy={busy} disabled={!name.trim()} onPress={() => void save()} />
    </Glass>
  </Animated.View>;
}
