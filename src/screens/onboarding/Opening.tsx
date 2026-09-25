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
import { SeedDrop } from '../../ds/SeedDrop';
import { LogoSprout } from '../../ds/LogoSprout';
import { revealDuration, TextReveal } from '../../ds/TextReveal';
import { SoilLayer } from './Soil';

const LINE = 'Stop guessing what your plant needs.';
const SUB = 'Rootera learns one plant at a time: its spot, its pot and the care you give it.';
const SOIL_POINT = 368 / 560; // soil line inside the pot artwork, see SeedDrop

export function Opening({ onContinue }: { onContinue: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [logoRun, setLogoRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [diving, setDiving] = useState(false);
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
    zoom.value = withDelay(120, withTiming(16, { duration: 820, easing: Easing.in(Easing.cubic) }));
    soil.value = withDelay(640, withTiming(1, { duration: 280 }));
    // Roots finish growing before the next screen lifts the soil away.
    setTimeout(onContinue, 640 + 280 + 1150);
  };

  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top, paddingBottom: insets.bottom + space[6], paddingHorizontal: space.gutter, overflow: 'hidden' }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', minHeight: 170 }, logoStyle]}>
        <LogoSprout width={250} run={logoRun} variant="full" onDone={whenLogoDone} />
        {ready && <View style={{ alignItems: 'center', gap: space[2], marginTop: space[5], maxWidth: 330 }}>
          <TextReveal text={LINE} v="hero" center delay={250} />
          <TextReveal text={SUB} v="callout" tone="ink2" center delay={revealDuration(LINE)} perWord={35} />
        </View>}
      </Animated.View>
      <Animated.View style={[{ marginTop: space[6], transformOrigin: `50% ${SOIL_POINT * 100}%` }, potStyle]}>
        <SeedDrop size={200} run={1} onImpact={() => setLogoRun(1)} />
      </Animated.View>
    </View>
    {ready && <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(1900).duration(400)} style={fadeStyle}>
      <Btn title="Get started" onPress={dive} />
    </Animated.View>}
    {diving && <SoilLayer grow opacity={soil} />}
  </View>;
}
