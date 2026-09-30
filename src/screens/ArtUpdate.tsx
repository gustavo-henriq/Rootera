/**
 * "An update for your plant arrived": shown once when a plant that lived in the plain pot
 * (its species had no illustration yet) gets its own drawing and species notes. The server
 * does the upgrade (service.upgrade_art) and flags it; seeing this clears the flag.
 * Waits while the profile sheet is up, so only one sheet shows at a time.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, T } from '../ds/components';
import { Ground, PlantArt } from '../ds/plant';
import { LeafBurst } from '../ds/motion';
import { useProfileAsking } from './ProfileInvite';
import { t } from '../i18n';

export function ArtUpdate() {
  const { garden, updatePlant } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const profileAsking = useProfileAsking();
  const [closed, setClosed] = useState<string[]>([]);
  const plant = garden.plants.find(p => p.art_new && !closed.includes(p.id));
  if (!plant || !garden.onboarded || profileAsking) return null;

  const seen = (open: boolean) => {
    setClosed(x => [...x, plant.id]);
    updatePlant(plant.id, { art_seen: true }).catch(() => undefined);
    if (open) navigation.navigate('Plant', { id: plant.id });
  };

  return <Modal transparent visible animationType="none" onRequestClose={() => seen(false)} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Close')} onPress={() => seen(false)} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)}
        style={{ width: '100%', maxWidth: 440, backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome, padding: space.gutter, paddingBottom: insets.bottom + space[5], gap: space[4], alignItems: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.delay(250).springify().damping(12)}><PlantArt kind={plant.kind} size={150} /></Animated.View>
          <Ground width={120} style={{ marginTop: -12 }} />
          <LeafBurst run={1} />
        </View>
        <View style={{ gap: space[1], alignItems: 'center' }}>
          <T v="title2" center accessibilityRole="header">{t('An update for your plant arrived!')}</T>
          <T v="subhead" tone="ink2" center>{t('{name} has its own drawing now, and Rootera knows its species.', { name: plant.name })}</T>
        </View>
        <View style={{ alignSelf: 'stretch', gap: space[2] }}>
          <Btn title={t('See the plant')} onPress={() => seen(true)} />
          <Btn kind="plain" title={t('Great')} onPress={() => seen(false)} style={{ alignSelf: 'center' }} />
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
