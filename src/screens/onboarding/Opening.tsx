/**
 * Opening: a seed is tossed into the pot, the wordmark sprouts, a short line of
 * text appears, then "Get started" dives the camera into the soil.
 *
 * A tap anywhere skips ahead: the seed lands, the wordmark finishes, the text and the
 * button show at once. The text keeps its space from the start (hidden until its turn),
 * so nothing on the screen jumps when it arrives.
 */
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../ds/theme';
import { space } from '../../ds/tokens';
import { Btn } from '../../ds/components';
import { SEED_AT, SEED_RATIO, SeedDrop } from '../../ds/SeedDrop';
import { pivot } from '../../ds/motion';
import { LogoSprout } from '../../ds/LogoSprout';
import { revealDuration, TextReveal } from '../../ds/TextReveal';
import { SOIL_DIVE, SoilLayer } from './Soil';
import { t } from '../../i18n';

const POT_H = 280;
const POT_W = POT_H * SEED_RATIO;
const LINE = 'Stop guessing what your plant needs.';
const SUB = 'Rootera learns each plant from your care.';
/** The wordmark starts this much lower and glides up as the text arrives under it. */
const RISE = 64;
const BUTTON_DELAY = 1900;

export function Opening({ onContinue }: { onContinue: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [logoRun, setLogoRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [skipped, setSkipped] = useState(false);
  // The button takes taps only once it can be seen; until then a tap skips ahead.
  const [buttonOn, setButtonOn] = useState(false);
  const buttonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diving, setDiving] = useState(false);
  const [under, setUnder] = useState(false);
  const skippedRef = useRef(false);
  const rise = useSharedValue(0);
  const zoom = useSharedValue(1);
  const fade = useSharedValue(1);
  const soil = useSharedValue(0);
  // One opacity for the button (no entering animation on top of it: two animations on the
  // same opacity made it appear, vanish and come back).
  const button = useSharedValue(0);

  const logoStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: (1 - rise.value) * RISE }] }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: button.value * fade.value }));
  // The pot grows around its soil line, so the camera ends up inside the soil.
  const potStyle = useAnimatedStyle(() => ({ transform: pivot(POT_W, POT_H, SEED_AT.x, SEED_AT.y, [{ scale: zoom.value }]) }));

  const whenLogoDone = () => {
    const now = reduceMotion || skippedRef.current;
    // The wordmark glides up (no spring) to make room for the line below it.
    rise.value = now ? 1 : withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) });
    button.value = now ? 1 : withDelay(BUTTON_DELAY, withTiming(1, { duration: 400 }));
    if (now) setButtonOn(true);
    else buttonTimer.current = setTimeout(() => setButtonOn(true), BUTTON_DELAY);
    setReady(true);
  };

  // A tap anywhere: everything that is still arriving arrives now.
  const skip = () => {
    if (diving || buttonOn) return;
    skippedRef.current = true;
    setSkipped(true);
    setLogoRun(1);
    [rise, button].forEach(cancelAnimation);
    rise.value = 1; button.value = 1;
    if (buttonTimer.current) clearTimeout(buttonTimer.current);
    setButtonOn(true);
    setReady(true);
  };

  const dive = () => {
    if (diving) return;
    if (reduceMotion) { onContinue(); return; }
    setDiving(true);
    fade.value = withTiming(0, { duration: 180 });
    // The camera accelerates into the middle of the soil, where the seed went in.
    zoom.value = withTiming(SOIL_DIVE.potZoom, { duration: SOIL_DIVE.zoom, easing: Easing.in(Easing.cubic) });
    soil.value = withDelay(SOIL_DIVE.soilIn, withTiming(1, { duration: SOIL_DIVE.soilFade }));
    // The soil layer mounts once it takes over, so its descent starts from there; the next
    // screen takes over on the dive's last frame (it starts from that same frame).
    setTimeout(() => setUnder(true), SOIL_DIVE.soilIn);
    setTimeout(onContinue, SOIL_DIVE.soilIn + SOIL_DIVE.descend + 40);
  };

  return <Pressable accessible={false} onPress={skip} style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top, paddingBottom: insets.bottom + space[6], paddingHorizontal: space.gutter, overflow: 'hidden' }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center' }, logoStyle]}>
        <LogoSprout width={250} run={logoRun} variant="full" skip={skipped} onDone={whenLogoDone} />
        <View style={{ alignItems: 'center', gap: space[2], marginTop: space[5], maxWidth: 330 }}>
          <TextReveal text={t(LINE)} v="hero" center delay={250} run={ready ? 1 : 0} skip={skipped} />
          <TextReveal text={t(SUB)} v="callout" tone="ink2" center delay={revealDuration(t(LINE))} perWord={35} run={ready ? 1 : 0} skip={skipped} />
        </View>
      </Animated.View>
      <Animated.View style={[{ marginTop: -space[4], width: POT_W, height: POT_H }, potStyle]}>
        <SeedDrop size={POT_H} run={1} skip={skipped} onImpact={() => setLogoRun(1)} />
      </Animated.View>
    </View>
    <Animated.View style={buttonStyle} pointerEvents={buttonOn ? 'auto' : 'none'}>
      <Btn title={t("Get started")} onPress={dive} />
    </Animated.View>
    {under && <SoilLayer grow opacity={soil} />}
  </Pressable>;
}
