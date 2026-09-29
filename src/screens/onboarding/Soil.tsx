/**
 * The "dive into the soil" transition. The opening camera sinks into the pot, soil
 * fills the screen and the camera follows the roots as they grow down through it
 * (ROOTera); the next screen then comes up out of the soil. Two halves of one gesture,
 * so the first and second screens read as one place.
 *
 * Everything moves by transforms only (no animated heights or SVG stroke props, which
 * are not reliable on every native renderer): the roots are drawn in full on a tall
 * canvas, a soil-coloured cover slides down off them (so their tips grow), and the
 * canvas rises at the same pace (so the camera travels with the tips).
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../ds/theme';

/** Timeline of the dive, in ms from the tap on "Get started". */
// The pot art is 440 x 500 px, so it is only zoomed about 3x; the soil (drawn as vectors,
// sharp at any size) takes over early and carries the rest of the dive.
export const SOIL_DIVE = { zoom: 560, potZoom: 3.2, soilIn: 300, soilFade: 220, descend: 1250 };
/** The next screen comes up out of the soil in this long. */
export const SOIL_OUT = 420;

/** The roots canvas is this many screens tall; the camera travels down it. */
const TALL = 1.6;
/** Root paths in a 100 x 100 box (stretched over the tall canvas), from the top centre down. */
const ROOTS = [
  { d: 'M50 0 C50 12 47 22 45 34 C42 50 46 64 41 80 C38 90 40 96 39 100', w: 3.2 },
  { d: 'M50 3 C53 16 58 26 61 38 C65 52 62 68 68 84 C70 92 72 96 73 100', w: 2.6 },
  { d: 'M47 18 C40 26 30 30 23 42 C17 52 15 64 11 78', w: 1.8 },
  { d: 'M56 22 C64 30 74 34 80 46 C85 56 88 68 91 80', w: 1.8 },
  { d: 'M45 40 C38 48 33 58 30 72', w: 1.2 },
  { d: 'M61 44 C67 52 70 62 71 74', w: 1.2 },
  { d: 'M23 42 C18 47 12 49 5 54', w: 1 },
  { d: 'M80 46 C86 50 91 50 97 54', w: 1 },
  { d: 'M42 66 C36 72 30 78 26 90', w: .9 },
  { d: 'M67 70 C73 76 78 84 80 94', w: .9 },
];

/** Deterministic pebbles, so the soil has texture and the descent has something to pass. */
function pebbles(n: number) {
  let s = 7;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 100, rx: .5 + r() * 1.4, ry: .3 + r() * .7, tone: r() > .5 ? 1 : 2 }));
}

/** Full-screen soil with roots. `grow` grows the roots and descends with them; otherwise it shows the end of the dive. */
export function SoilLayer({ grow, opacity, out }: { grow: boolean; opacity?: SharedValue<number>; out?: SharedValue<number> }) {
  const { c, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const tall = height * TALL;
  const p = useSharedValue(grow && !reduceMotion ? 0 : 1);
  const stones = useMemo(() => pebbles(70), []);
  useEffect(() => {
    if (!grow || reduceMotion) return;
    // Fast at first (the dive carries its speed in), settling as the roots reach the bottom.
    p.value = withTiming(1, { duration: SOIL_DIVE.descend, easing: Easing.out(Easing.cubic) });
  }, [grow]);
  // Coming out: the soil thins away and rises a little, like surfacing.
  const layer = useAnimatedStyle(() => ({
    opacity: (opacity ? opacity.value : 1) * (out ? 1 - out.value : 1),
    transform: [{ translateY: out ? -out.value * 60 : 0 }],
  }));
  // The camera: the canvas rises as the tips grow, so the tips move down the screen.
  const camera = useAnimatedStyle(() => ({ transform: [{ translateY: -p.value * (tall - height) }] }));
  // The cover slides down off the roots, a little ahead of the camera.
  const cover = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * (tall + 80) }] }));
  // Pebbles pass faster than the roots: parallax sells the depth.
  const stoneStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -p.value * (tall - height) * 1.35 }] }));
  const soil = c.soil[3];
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: soil, zIndex: 20, overflow: 'hidden' }, layer]}>
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height: tall }, camera]}>
      <Svg width={width} height={tall} viewBox="0 0 100 100" preserveAspectRatio="none">
        {ROOTS.map((r, i) => <Path key={i} d={r.d} stroke={c.soil[0]} strokeWidth={r.w} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={i < 2 ? .95 : .8} />)}
      </Svg>
      {/* The soil still in front of the roots: a soft edge, then solid. */}
      <Animated.View style={[{ position: 'absolute', top: -80, left: 0, width, height: tall + 160 }, cover]}>
        <Svg width={width} height={80}>
          <Defs><LinearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={soil} stopOpacity={0} /><Stop offset="1" stopColor={soil} stopOpacity={1} /></LinearGradient></Defs>
          <Rect x={0} y={0} width={width} height={80} fill="url(#edge)" />
        </Svg>
        <View style={{ flex: 1, backgroundColor: soil }} />
      </Animated.View>
    </Animated.View>
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height: tall * 1.35 }, stoneStyle]}>
      <Svg width={width} height={tall * 1.35} viewBox="0 0 100 100" preserveAspectRatio="none">
        {stones.map((s, i) => <Ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry * width / (tall * 1.35) * 1.6} fill={c.soil[s.tone]} opacity={.4} />)}
      </Svg>
    </Animated.View>
  </Animated.View>;
}

/** Second half of the dive: the new screen comes up out of the soil. */
export function SoilReveal({ onDone }: { onDone?: () => void }) {
  const { reduceMotion } = useTheme();
  const out = useSharedValue(0);
  const [gone, setGone] = React.useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) { onDone?.(); return; }
    out.value = withDelay(60, withTiming(1, { duration: SOIL_OUT, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => { setGone(true); onDone?.(); }, SOIL_OUT + 100);
    return () => clearTimeout(t);
  }, []);
  return gone ? null : <SoilLayer grow={false} out={out} />;
}
