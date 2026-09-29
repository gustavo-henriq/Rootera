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
import Animated, { cancelAnimation, Easing, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { pivot } from '../ds/motion';
import { PlantArt } from '../ds/plant';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { T } from '../ds/components';
import { t } from '../i18n';

export const STAGE = { text: '#F4F6F2', dim: 'rgba(244,246,242,.64)', faint: 'rgba(244,246,242,.38)', line: 'rgba(255,255,255,.14)', leaf: '#B6E07C', water: '#86BCCB', sun: '#F2D16B',
  soil: { dry: '#CDB690', moist: '#8A6242', wet: '#4A3322' } };

/* ------------------------------------------------------------------ scene 1: the watering */

// One timeline drives everything, so the can and the water can't drift apart. A loop of
// 3.6 s: the can tilts (0-.2), pours (.2-.7), straightens (.7-.85), rests (.85-1).
const LOOP = 3600;
const TILT = 38; // degrees, clockwise: the spout goes down
// The can is drawn in a 110 x 70 box, placed at CAN; it turns around its body (PIVOT).
const CAN = { x: 14, y: 18, w: 110, h: 70 };
const PIVOT = { x: 36, y: 42 };
const TIP = { x: 105, y: 17 }; // the spout's mouth, in the can's box
const SOIL_Y = 166; // where the water meets the soil, in the scene
const DROPS = 5;

/** The can's tilt (0-1) at a point of the loop. */
function tiltAt(p: number) {
  'worklet';
  if (p < .2) return p / .2;
  if (p < .7) return 1;
  if (p < .85) return 1 - (p - .7) / .15;
  return 0;
}

function Drop({ p, k }: { p: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const tilt = tiltAt(p.value);
    // The spout's mouth, turned with the can.
    const a = (tilt * TILT * Math.PI) / 180;
    const vx = TIP.x - PIVOT.x, vy = TIP.y - PIVOT.y;
    const x = CAN.x + PIVOT.x + vx * Math.cos(a) - vy * Math.sin(a);
    const y = CAN.y + PIVOT.y + vx * Math.sin(a) + vy * Math.cos(a);
    // Each drop falls from the mouth to the soil, staggered; only while the can pours.
    const pouring = p.value > .22 && p.value < .72;
    const f = ((p.value * 9 + k / DROPS) % 1);
    return {
      opacity: pouring ? 1 - f * .3 : 0,
      transform: [{ translateX: x - 3 + f * 3 }, { translateY: y + f * (SOIL_Y - y) }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 6, height: 11, borderRadius: 3, backgroundColor: STAGE.water }, style]} />;
}

export function WateringScene() {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(reduceMotion ? .5 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    p.value = withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, []);
  const can = useAnimatedStyle(() => ({ transform: pivot(CAN.w, CAN.h, PIVOT.x / CAN.w, PIVOT.y / CAN.h, [{ rotate: `${tiltAt(p.value) * TILT}deg` }]) }));
  // The soil darkens while the water goes in, and dries back a little during the rest.
  const soil = useAnimatedStyle(() => ({ opacity: p.value < .25 ? .35 : p.value < .75 ? .35 + .65 * ((p.value - .25) / .5) : 1 - .65 * ((p.value - .75) / .25) }));
  // The plant drinks: a small squash from the pot's base as the pouring ends.
  const plant = useAnimatedStyle(() => {
    const d = p.value > .7 && p.value < .85 ? Math.sin(((p.value - .7) / .15) * Math.PI) : 0;
    return { transform: pivot(150, 150, .5, 1, [{ scaleY: 1 - .05 * d }, { scaleX: 1 + .02 * d }]) };
  });
  return <View accessible accessibilityRole="image" accessibilityLabel={t('A watering can pours water on the plant')} style={{ width: 240, height: 230, alignSelf: 'center' }}>
    <Animated.View style={[{ position: 'absolute', left: 60, top: 60, width: 150, height: 150 }, plant]}>
      <PlantArt kind="monstera" size={150} />
    </Animated.View>
    {/* The soil at the top of the pot darkens as it takes the water. */}
    <Animated.View style={[{ position: 'absolute', left: 104, top: SOIL_Y - 4, width: 62, height: 8, borderRadius: 4, backgroundColor: STAGE.soil.wet }, soil]} />
    {Array.from({ length: DROPS }, (_, k) => <Drop key={k} p={p} k={k} />)}
    {/* The can: a body, a spout and a handle. */}
    <Animated.View style={[{ position: 'absolute', left: CAN.x, top: CAN.y, width: CAN.w, height: CAN.h }, can]}>
      <Svg width={CAN.w} height={CAN.h} viewBox="0 0 110 70">
        <Rect x={10} y={22} width={52} height={40} rx={8} fill={STAGE.leaf} />
        <Path d="M60 34 L104 14 L106 20 L62 44 Z" fill={STAGE.leaf} />
        <Path d="M20 22 C20 6 52 6 52 22" stroke={STAGE.leaf} strokeWidth={5} fill="none" />
      </Svg>
    </Animated.View>
  </View>;
}

/* ------------------------------------------------------------------ scene 2: one cycle */

const SKY = ['rain', 'cloud', 'sun'] as const;
const SKY_LABEL = { rain: 'Wet', cloud: 'Moist', sun: 'Dry' } as const;

function Cloud({ color }: { color: string }) {
  return <Path d="M22 58 C8 58 6 40 20 38 C20 22 42 18 48 30 C56 18 78 22 76 40 C90 40 90 58 76 58 Z" fill={color} />;
}

export function CycleScene() {
  const { reduceMotion } = useTheme();
  const [phase, setPhase] = useState(reduceMotion ? 2 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setPhase(p => (p + 1) % 3), 1500);
    return () => clearInterval(timer);
  }, []);
  const sky = SKY[phase];
  // The layers dry from the top down: rain = all wet, cloud = top dry, sun = dry to the middle.
  const layers = sky === 'rain' ? ['wet', 'wet', 'wet'] : sky === 'cloud' ? ['moist', 'moist', 'wet'] : ['dry', 'dry', 'moist'];
  const fall = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    fall.value = withRepeat(withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) }), -1, false);
    spin.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(fall); cancelAnimation(spin); };
  }, []);
  const rain = useAnimatedStyle(() => ({ transform: [{ translateY: fall.value * 16 }], opacity: 1 - fall.value * .6 }));
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return <View accessible accessibilityRole="image" accessibilityLabel={t('After a watering the soil goes from wet to moist to dry: one cycle')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[6], height: 200 }}>
    <View style={{ width: 100, alignItems: 'center', gap: space[2] }}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        {sky === 'sun'
          ? <>
              <Animated.View style={[{ position: 'absolute', width: 96, height: 96 }, rays]}>
                <Svg width={96} height={96} viewBox="0 0 96 96">
                  {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <Line key={i} x1={48 + Math.cos(a) * 30} y1={48 + Math.sin(a) * 30} x2={48 + Math.cos(a) * 42} y2={48 + Math.sin(a) * 42} stroke={STAGE.sun} strokeWidth={4} strokeLinecap="round" />; })}
                </Svg>
              </Animated.View>
              <Svg width={96} height={96} viewBox="0 0 96 96"><Circle cx={48} cy={48} r={22} fill={STAGE.sun} /></Svg>
            </>
          : <Svg width={96} height={80} viewBox="0 0 96 80"><G transform="translate(3 0)"><Cloud color={sky === 'rain' ? '#9FB3BD' : '#C9D0CC'} /></G></Svg>}
        {sky === 'rain' && <Animated.View style={[{ position: 'absolute', top: 70, flexDirection: 'row', gap: 12 }, rain]}>
          {[0, 1, 2].map(i => <View key={i} style={{ width: 5, height: 12, borderRadius: 3, backgroundColor: STAGE.water }} />)}
        </Animated.View>}
      </View>
      <T v="headline" style={{ color: STAGE.text }}>{t(SKY_LABEL[sky])}</T>
    </View>
    {/* The pot's three layers, in step with the sky. */}
    <View style={{ gap: 4 }}>
      {layers.map((l, i) => <View key={i} style={{ width: 90, height: 26, borderRadius: radius.inner, backgroundColor: STAGE.soil[l as 'wet'] }} />)}
      <T v="caption" style={{ color: STAGE.faint, marginTop: 4 }}>{t('Surface, middle, bottom')}</T>
    </View>
  </View>;
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
