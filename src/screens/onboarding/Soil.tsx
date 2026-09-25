/**
 * The "dive into the soil" transition. The opening camera sinks into the pot, soil
 * fills the screen and roots grow down through it (ROOTera); the next screen then
 * lifts the soil away to reveal a seed in the middle. Two halves of one gesture,
 * so the first and second screens read as one continuous place.
 */
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../ds/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Root paths in a 100 x 100 box, drawn from the top centre downwards. */
const ROOTS = [
  { d: 'M50 0 C50 18 47 30 44 44 C41 58 43 72 38 100', w: 2.4, len: 105 },
  { d: 'M50 6 C53 22 58 34 62 48 C66 62 64 80 70 100', w: 2, len: 100 },
  { d: 'M47 26 C40 34 30 38 22 50 C16 60 14 74 10 88', w: 1.4, len: 80 },
  { d: 'M56 30 C64 38 74 42 80 54 C85 64 88 76 92 90', w: 1.4, len: 78 },
  { d: 'M44 50 C38 58 34 66 32 80', w: 1, len: 34 },
  { d: 'M61 55 C66 62 69 70 70 82', w: 1, len: 30 },
];

function Root({ d, w, len, delay, tint, grow }: { d: string; w: number; len: number; delay: number; tint: string; grow: boolean }) {
  const p = useSharedValue(grow ? 0 : 1);
  useEffect(() => { if (grow) p.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [grow]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return <AnimatedPath d={d} stroke={tint} strokeWidth={w} strokeLinecap="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={props} />;
}

/** Full-screen soil with roots. `grow` draws the roots; otherwise they are already there. */
export function SoilLayer({ grow, opacity, lift }: { grow: boolean; opacity?: SharedValue<number>; lift?: SharedValue<number> }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const style = useAnimatedStyle(() => ({
    opacity: opacity ? opacity.value : 1,
    transform: [{ translateY: lift ? -lift.value * height : 0 }],
  }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.soil[3], zIndex: 20 }, style]}>
    <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
      {ROOTS.map((r, i) => <Root key={i} {...r} delay={i * 110} tint={c.soil[1]} grow={grow} />)}
    </Svg>
  </Animated.View>;
}

/** Second half of the dive: the soil lifts off the new screen. */
export function SoilReveal({ onDone }: { onDone?: () => void }) {
  const { reduceMotion } = useTheme();
  const lift = useSharedValue(0);
  const [gone, setGone] = React.useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) { onDone?.(); return; }
    lift.value = withDelay(150, withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) }));
    const t = setTimeout(() => { setGone(true); onDone?.(); }, 950);
    return () => clearTimeout(t);
  }, []);
  return gone ? null : <SoilLayer grow={false} lift={lift} />;
}
