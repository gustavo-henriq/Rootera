/**
 * Opening: a seed is tossed into the pot, the wordmark sprouts, a short line of
 * text appears, then "Get started" dives the camera into the soil.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../ds/theme';
import { space } from '../../ds/tokens';
import { Btn } from '../../ds/components';
import { SEED_AT, SeedDrop } from '../../ds/SeedDrop';
import { LogoSprout } from '../../ds/LogoSprout';
import { revealDuration, TextReveal } from '../../ds/TextReveal';
import { SOIL_DIVE, SoilLayer } from './Soil';
import { t } from '../../i18n';

const LINE = 'Stop guessing what your plant needs.';
const SUB = 'Rootera learns one plant at a time: its spot, its pot and the care you give it.';

export function Opening({ onContinue }: { onContinue: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [logoRun, setLogoRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [diving, setDiving] = useState(false);
  const [under, setUnder] = useState(false);
  const rise = useSharedValue(0);
  const zoom = useSharedValue(1);
  const fade = useSharedValue(1);
  const soil = useSharedValue(0);

  const logoStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: -rise.value * 64 }] }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  // The pot grows around its soil line, so the camera ends up inside the soil.
  const potStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  const whenLogoDone = () => {
    // The wordmark glides up (no spring) to make room for the line below it.
    rise.value = reduceMotion ? 1 : withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) });
    setReady(true);
  };

  const dive = () => {
    if (diving) return;
    if (reduceMotion) { onContinue(); return; }
    setDiving(true);
    fade.value = withTiming(0, { duration: 260 });
    // The camera accelerates into the middle of the soil, where the seed went in.
    zoom.value = withDelay(100, withTiming(40, { duration: SOIL_DIVE.zoom, easing: Easing.in(Easing.cubic) }));
    soil.value = withDelay(SOIL_DIVE.soilIn, withTiming(1, { duration: SOIL_DIVE.soilFade }));
    // The soil layer mounts once it takes over, so its descent starts from there.
    setTimeout(() => setUnder(true), SOIL_DIVE.soilIn);
    setTimeout(onContinue, SOIL_DIVE.soilIn + SOIL_DIVE.descend - 150);
  };

  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top, paddingBottom: insets.bottom + space[6], paddingHorizontal: space.gutter, overflow: 'hidden' }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', minHeight: 170 }, logoStyle]}>
        <LogoSprout width={250} run={logoRun} variant="full" onDone={whenLogoDone} />
        {ready && <View style={{ alignItems: 'center', gap: space[2], marginTop: space[5], maxWidth: 330 }}>
          <TextReveal text={t(LINE)} v="hero" center delay={250} />
          <TextReveal text={t(SUB)} v="callout" tone="ink2" center delay={revealDuration(t(LINE))} perWord={35} />
        </View>}
      </Animated.View>
      <Animated.View style={[{ marginTop: -space[4], transformOrigin: `${SEED_AT.x * 100}% ${SEED_AT.y * 100}%` }, potStyle]}>
        <SeedDrop size={280} run={1} onImpact={() => setLogoRun(1)} />
      </Animated.View>
    </View>
    {ready && <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(1900).duration(400)} style={fadeStyle}>
      <Btn title={t("Get started")} onPress={dive} />
    </Animated.View>}
    {under && <SoilLayer grow opacity={soil} />}
  </View>;
}
