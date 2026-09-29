/**
 * The Shipaton lab's opening story: three animated scenes that explain the method before
 * the simulation. Drawn on the lab's dark stage (see Lab.tsx), with shapes drawn in SVG
 * and moved by Reanimated; with Reduce Motion each scene shows its end state.
 *
 * 1. A watering makes all the difference: a can pours on the plant, the soil darkens.
 * 2. One cycle: after a watering the soil goes from wet to moist to dry. Rain, a cloud and
 *    the sun stand for the soil drying, in step with the three layers of the pot. They are
 *    not the weather (Rootera does not use the weather yet), and the scene says so.
 * 3. Three cycles to know the plant: the first two are observations mixed with the
 *    species estimate; from the third, the window comes from this plant alone, and it
 *    narrows as the circles fill.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { pivot } from '../ds/motion';
import { PlantArt } from '../ds/plant';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { T } from '../ds/components';
import { t } from '../i18n';

export const STAGE = { text: '#F4F6F2', dim: 'rgba(244,246,242,.64)', faint: 'rgba(244,246,242,.38)', line: 'rgba(255,255,255,.14)', leaf: '#B6E07C', water: '#86BCCB', sun: '#F2D16B',
  soil: { dry: '#CDB690', moist: '#8A6242', wet: '#4A3322' } };

/* ------------------------------------------------------------------ scene 1: the watering becomes the weather */

// One timeline (a 10 s loop) drives the whole scene, so nothing drifts apart:
//   .00-.06 the can tilts   .06-.30 it pours   .30-.36 it straightens
//   .36-.46 the can turns into a rain cloud   .46-.66 it rains on the plant
//   .66-.76 the rain stops: cloudy   .76-.86 the cloud gives way to the sun   .86-1 sun
// The soil in the pot follows: wet while watered and rained on, moist under the cloud,
// dry in the sun. The captions change with it (they are part of the scene).
const LOOP = 10000;
const TILT = 38; // degrees, clockwise: the spout goes down
const CAN = { x: 14, y: 18, w: 110, h: 70 };
const PIVOT = { x: 36, y: 42 };  // the can turns around its body
const TIP = { x: 105, y: 17 };   // the spout's mouth, in the can's box
const CLOUD = { x: 80, y: 6, w: 110, h: 70 };
const SOIL_Y = 166;              // where the water meets the soil
const W = 240, H = 230;

const band = (p: number, a: number, b: number) => { 'worklet'; return Math.min(1, Math.max(0, (p - a) / (b - a))); };
/** The can's tilt (0-1). */
function tiltAt(p: number) {
  'worklet';
  return p < .06 ? p / .06 : p < .30 ? 1 : p < .36 ? 1 - (p - .30) / .06 : 0;
}
/** How wet the soil is (1 wet, .5 moist, 0 dry). */
function wetAt(p: number) {
  'worklet';
  if (p < .08) return .15 + .85 * (p / .08) * 0;
  if (p < .66) return Math.min(1, .15 + (p - .08) / .1);
  if (p < .76) return 1 - .5 * band(p, .66, .76);
  if (p < .9) return .5 - .5 * band(p, .76, .9);
  return 0;
}

function CanDrop({ p, k }: { p: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const ang = (tiltAt(p.value) * TILT * Math.PI) / 180;
    const vx = TIP.x - PIVOT.x, vy = TIP.y - PIVOT.y;
    const x = CAN.x + PIVOT.x + vx * Math.cos(ang) - vy * Math.sin(ang);
    const y = CAN.y + PIVOT.y + vx * Math.sin(ang) + vy * Math.cos(ang);
    const on = p.value > .08 && p.value < .30;
    const f = (p.value * 30 + k / 5) % 1;
    return { opacity: on ? 1 - f * .3 : 0, transform: [{ translateX: x - 3 + f * 3 }, { translateY: y + f * (SOIL_Y - y) }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 6, height: 11, borderRadius: 3, backgroundColor: STAGE.water }, style]} />;
}

function RainDrop({ p, k }: { p: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const on = p.value > .46 && p.value < .66;
    const f = (p.value * 24 + k / 7) % 1;
    const x = CLOUD.x + 22 + (k % 7) * 11;
    const y0 = CLOUD.y + 56;
    return { opacity: on ? 1 - f * .4 : 0, transform: [{ translateX: x }, { translateY: y0 + f * (SOIL_Y - y0) }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 4, height: 10, borderRadius: 2, backgroundColor: STAGE.water }, style]} />;
}

const CAPTIONS = [
  { title: 'A watering makes all the difference', line: 'Rootera starts counting from the watering you record.' },
  { title: 'Rootera learns with each cycle', line: 'And with the real weather: rain, cloud and sun change how long the soil takes to dry.' },
  { title: 'No need to work it out yourself', line: 'Your checks and your local weather do the sums.' },
];

function Caption({ p, i }: { p: SharedValue<number>; i: number }) {
  // Each caption fades in with its part of the scene and out before the next.
  const [a, b] = [[0, .36], [.36, .76], [.76, 1.01]][i];
  const style = useAnimatedStyle(() => {
    const v = p.value;
    const fadeIn = i === 0 ? 1 : band(v, a, a + .04);
    const fadeOut = i === 2 ? 1 - band(v, .97, 1) : 1 - band(v, b - .03, b);
    return { opacity: v >= a - .001 && v < b ? Math.min(fadeIn, fadeOut) : 0 };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, gap: space[3] }, style]}>
    <T v="hero" style={{ color: STAGE.text }}>{t(CAPTIONS[i].title)}</T>
    <T v="callout" style={{ color: STAGE.dim }}>{t(CAPTIONS[i].line)}</T>
  </Animated.View>;
}

export function WaterWeatherScene() {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(reduceMotion ? .5 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    p.value = withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, []);
  // The can: tilts and pours, then shrinks toward the cloud's place as the cloud grows there.
  const can = useAnimatedStyle(() => {
    const m = band(p.value, .36, .46);
    const dx = (CLOUD.x + CLOUD.w / 2 - (CAN.x + CAN.w / 2)) * m, dy = (CLOUD.y + CLOUD.h / 2 - (CAN.y + CAN.h / 2)) * m;
    return {
      opacity: p.value < .36 ? 1 : p.value < .46 ? 1 - m : 0,
      transform: [{ translateX: dx }, { translateY: dy }, ...pivot(CAN.w, CAN.h, PIVOT.x / CAN.w, PIVOT.y / CAN.h, [{ rotate: `${tiltAt(p.value) * TILT}deg` }, { scale: 1 - .4 * m }])],
    };
  });
  // The cloud: grows out of the can, rains, lightens, then gives way to the sun.
  const cloud = useAnimatedStyle(() => {
    const m = band(p.value, .36, .46);
    const out = band(p.value, .76, .84);
    const fromX = (CAN.x + CAN.w / 2) - (CLOUD.x + CLOUD.w / 2), fromY = (CAN.y + CAN.h / 2) - (CLOUD.y + CLOUD.h / 2);
    return {
      opacity: p.value < .36 ? 0 : p.value < .76 ? m : 1 - out,
      transform: [{ translateX: fromX * (1 - m) + 30 * out }, { translateY: fromY * (1 - m) }, { scale: .6 + .4 * m }],
    };
  });
  const rainy = useAnimatedStyle(() => ({ opacity: p.value < .66 ? 1 : 1 - band(p.value, .66, .72) }));
  const sun = useAnimatedStyle(() => {
    const s = band(p.value, .78, .88);
    return { opacity: s, transform: [{ scale: .6 + .4 * s }, { rotate: `${p.value * 240}deg` }] };
  });
  const soil = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(wetAt(p.value), [0, .5, 1], [STAGE.soil.dry, STAGE.soil.moist, STAGE.soil.wet]) }));
  const soilWord = (i: number) => useAnimatedStyle(() => {
    const w = wetAt(p.value);
    const on = i === 0 ? w > .75 : i === 1 ? w > .25 && w <= .75 : w <= .25;
    return { opacity: on ? 1 : 0 };
  });
  const words = [soilWord(0), soilWord(1), soilWord(2)];
  return <View style={{ gap: space[5] }}>
    <View accessible accessibilityRole="image" accessibilityLabel={t('A watering can pours on the plant, turns into a rain cloud, then the sun comes out and the soil dries')} style={{ width: W, height: H, alignSelf: 'center' }}>
      <Animated.View style={[{ position: 'absolute', left: 60, top: 60, width: 150, height: 150 }]}>
        <PlantArt kind="monstera" size={150} />
      </Animated.View>
      {/* The soil at the top of the pot: wet, moist, dry. */}
      <Animated.View style={[{ position: 'absolute', left: 104, top: SOIL_Y - 4, width: 62, height: 8, borderRadius: 4 }, soil]} />
      {Array.from({ length: 5 }, (_, k) => <CanDrop key={'c' + k} p={p} k={k} />)}
      {Array.from({ length: 7 }, (_, k) => <RainDrop key={'r' + k} p={p} k={k} />)}
      <Animated.View style={[{ position: 'absolute', left: CAN.x, top: CAN.y, width: CAN.w, height: CAN.h }, can]}>
        <Svg width={CAN.w} height={CAN.h} viewBox="0 0 110 70">
          <Rect x={10} y={22} width={52} height={40} rx={8} fill={STAGE.leaf} />
          <Path d="M60 34 L104 14 L106 20 L62 44 Z" fill={STAGE.leaf} />
          <Path d="M20 22 C20 6 52 6 52 22" stroke={STAGE.leaf} strokeWidth={5} fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: CLOUD.x, top: CLOUD.y, width: CLOUD.w, height: CLOUD.h }, cloud]}>
        <Svg width={CLOUD.w} height={CLOUD.h} viewBox="-8 0 110 70"><Cloud color="#C9D0CC" /></Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, rainy]}>
          <Svg width={CLOUD.w} height={CLOUD.h} viewBox="-8 0 110 70"><Cloud color="#8FA3AE" /></Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: CLOUD.x + 7, top: CLOUD.y - 12, width: 96, height: 96 }, sun]}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <Line key={i} x1={48 + Math.cos(a) * 30} y1={48 + Math.sin(a) * 30} x2={48 + Math.cos(a) * 42} y2={48 + Math.sin(a) * 42} stroke={STAGE.sun} strokeWidth={4} strokeLinecap="round" />; })}
          <Circle cx={48} cy={48} r={22} fill={STAGE.sun} />
        </Svg>
      </Animated.View>
      {/* The soil's state, named. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: -6, alignItems: 'center', height: 20 }}>
        {(['Wet', 'Moist', 'Dry'] as const).map((w, i) => <Animated.View key={w} style={[{ position: 'absolute' }, words[i]]}>
          <T v="footnote" style={{ color: STAGE.dim }}>{t('Soil: {v}', { v: t(w).toLowerCase() })}</T>
        </Animated.View>)}
      </View>
    </View>
    <View style={{ height: 150 }}>
      {CAPTIONS.map((_, i) => <Caption key={i} p={p} i={i} />)}
    </View>
  </View>;
}

function Cloud({ color }: { color: string }) {
  return <Path d="M22 58 C8 58 6 40 20 38 C20 22 42 18 48 30 C56 18 78 22 76 40 C90 40 90 58 76 58 Z" fill={color} />;
}

/* ------------------------------------------------------------------ scene 3: three cycles */

export function CyclesScene() {
  const { reduceMotion } = useTheme();
  const [filled, setFilled] = useState(reduceMotion ? 3 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setFilled(f => (f >= 3 ? 0 : f + 1)), 1100);
    return () => clearInterval(timer);
  }, []);
  // The window narrows as cycles come in: wide estimate, then this plant's own.
  const width = useSharedValue(1);
  useEffect(() => { width.value = withTiming([1, .72, .5, .26][filled], { duration: 600, easing: Easing.inOut(Easing.cubic) }); }, [filled]);
  const band = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <View accessible accessibilityRole="image" accessibilityLabel={t('Three cycles: the window narrows onto this plant')} style={{ gap: space[5], paddingVertical: space[3] }}>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[5] }}>
      {[1, 2, 3].map(n => <View key={n} style={{ alignItems: 'center', gap: space[2] }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: STAGE.text, backgroundColor: n <= filled ? STAGE.text : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <T v="headline" style={{ color: n <= filled ? '#060807' : STAGE.text }}>{n}</T>
        </View>
        <T v="caption" style={{ color: STAGE.dim }}>{n === 1 ? t('Analyzing') : n === 2 ? t('Getting specific') : t('Pattern')}</T>
      </View>)}
    </View>
    <View style={{ gap: space[2] }}>
      <View style={{ height: 14, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: STAGE.line }} />
        <Animated.View style={[{ height: 14, borderRadius: radius.inner, backgroundColor: filled >= 3 ? STAGE.leaf : 'transparent', borderWidth: filled >= 3 ? 0 : 1.5, borderStyle: 'dashed', borderColor: STAGE.leaf }, band]} />
      </View>
      <T v="caption" center style={{ color: STAGE.faint }}>{filled >= 3 ? t('Window from this plant') : filled === 2 ? t('Window mixing the species and this plant') : t('Window from the species estimate')}</T>
    </View>
  </View>;
}
