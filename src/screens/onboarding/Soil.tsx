/**
 * The "dive into the soil" transition. The opening camera sinks into the pot, soil
 * fills the screen and the camera keeps descending while roots grow down through it
 * (ROOTera); the next screen then lifts the soil away to reveal the seed in its pot.
 * Two halves of one gesture, so the first and second screens read as one place.
 *
 * Roots are revealed by a growing clip rather than by animating SVG stroke props,
 * which are not reliable on every native renderer.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../../ds/theme';

/** Timeline of the dive, in ms from the tap on "Get started". */
// The pot art is 440 x 500 px, so it is only zoomed about 3x; the soil (drawn as vectors,
// sharp at any size) fades in early and carries the rest of the dive. Zooming the picture
// further (it used to go to 40x) showed its pixels.
export const SOIL_DIVE = { zoom: 900, potZoom: 3.2, soilIn: 420, soilFade: 380, descend: 1900 };

/** Root paths in a 100 x 100 box, drawn from the top centre downwards. */
const ROOTS = [
  { d: 'M50 0 C50 18 47 30 44 44 C41 58 43 72 38 100', w: 2.4 },
  { d: 'M50 6 C53 22 58 34 62 48 C66 62 64 80 70 100', w: 2 },
  { d: 'M47 26 C40 34 30 38 22 50 C16 60 14 74 10 88', w: 1.4 },
  { d: 'M56 30 C64 38 74 42 80 54 C85 64 88 76 92 90', w: 1.4 },
  { d: 'M44 50 C38 58 34 66 32 80', w: 1 },
  { d: 'M61 55 C66 62 69 70 70 82', w: 1 },
  { d: 'M22 50 C18 56 12 58 6 64', w: .8 },
  { d: 'M80 54 C86 58 90 58 96 62', w: .8 },
];

/** Deterministic pebbles, so the soil has texture and the descent has something to pass. */
function pebbles(n: number) {
  let s = 7;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 130 - 15, rx: .6 + r() * 1.6, ry: .4 + r() * 1, tone: r() > .5 ? 1 : 2 }));
}

/** Full-screen soil with roots. `grow` reveals the roots and descends; otherwise they are already there. */
export function SoilLayer({ grow, opacity, lift }: { grow: boolean; opacity?: SharedValue<number>; lift?: SharedValue<number> }) {
  const { c, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const reveal = useSharedValue(grow && !reduceMotion ? .02 : 1);
  const depth = useSharedValue(grow && !reduceMotion ? 0 : 1);
  const stones = useMemo(() => pebbles(46), []);
  useEffect(() => {
    if (!grow || reduceMotion) return;
    reveal.value = withDelay(250, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }));
    depth.value = withTiming(1, { duration: SOIL_DIVE.descend, easing: Easing.inOut(Easing.quad) });
  }, [grow]);
  const layer = useAnimatedStyle(() => ({
    opacity: opacity ? opacity.value : 1,
    transform: [{ translateY: lift ? -lift.value * height : 0 }],
  }));
  // Pebbles move faster than the roots: parallax sells the camera sinking.
  const stoneStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - depth.value) * height * .18 }] }));
  const rootStyle = useAnimatedStyle(() => ({ height: reveal.value * height, transform: [{ translateY: (1 - depth.value) * height * .06 }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.soil[3], zIndex: 20, overflow: 'hidden' }, layer]}>
    <Animated.View style={[StyleSheet.absoluteFill, stoneStyle]}>
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        {stones.map((p, i) => <Ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry * width / height * 1.6} fill={c.soil[p.tone]} opacity={.35} />)}
      </Svg>
    </Animated.View>
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, overflow: 'hidden' }, rootStyle]}>
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        {ROOTS.map((r, i) => <Path key={i} d={r.d} stroke={c.soil[1]} strokeWidth={r.w} strokeLinecap="round" fill="none" />)}
      </Svg>
    </Animated.View>
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
