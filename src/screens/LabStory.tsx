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
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
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

function Drop({ x, delay, run }: { x: number; delay: number; run: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (!run) { y.value = 0; return; }
    y.value = withDelay(delay, withRepeat(withTiming(1, { duration: 620, easing: Easing.in(Easing.quad) }), -1, false));
    return () => cancelAnimation(y);
  }, [run]);
  const style = useAnimatedStyle(() => ({ opacity: run ? (y.value < .85 ? 1 : (1 - y.value) / .15) : 0, transform: [{ translateY: y.value * 70 }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: 58, width: 6, height: 10, borderRadius: 3, backgroundColor: STAGE.water }, style]} />;
}

export function WateringScene() {
  const { reduceMotion } = useTheme();
  const tilt = useSharedValue(reduceMotion ? 1 : 0);
  const wet = useSharedValue(reduceMotion ? 1 : 0);
  const drink = useSharedValue(1);
  const [pouring, setPouring] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    tilt.value = withDelay(300, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) }));
    const start = setTimeout(() => setPouring(true), 900);
    wet.value = withDelay(1300, withTiming(1, { duration: 1600 }));
    drink.value = withDelay(2600, withSequence(withTiming(.94, { duration: 220 }), withTiming(1.04, { duration: 240 }), withTiming(1, { duration: 300 })));
    const stop = setTimeout(() => setPouring(false), 3200);
    return () => { clearTimeout(start); clearTimeout(stop); };
  }, []);
  const can = useAnimatedStyle(() => ({ transform: [{ translateX: -10 + 10 * tilt.value }, { rotate: `${-32 * tilt.value}deg` }] }));
  const soil = useAnimatedStyle(() => ({ opacity: .35 + .65 * wet.value }));
  // Squashes from the bottom of the pot (pivot, not transformOrigin, which iOS ignored).
  const plant = useAnimatedStyle(() => ({ transform: pivot(150, 150, .5, 1, [{ scaleY: drink.value }]) }));
  return <View accessible accessibilityRole="image" accessibilityLabel={t('A watering can pours water on the plant')} style={{ width: 240, height: 230, alignSelf: 'center' }}>
    {/* The can, drawn as a body, a spout and a handle. */}
    <Animated.View style={[{ position: 'absolute', left: 4, top: 6, width: 110, height: 70 }, can]}>
      <Svg width={110} height={70} viewBox="0 0 110 70">
        <Rect x={10} y={22} width={52} height={40} rx={8} fill={STAGE.leaf} />
        <Path d="M60 34 L104 14 L106 20 L62 44 Z" fill={STAGE.leaf} />
        <Path d="M20 22 C20 6 52 6 52 22" stroke={STAGE.leaf} strokeWidth={5} fill="none" />
      </Svg>
    </Animated.View>
    {[0, 1, 2, 3].map(i => <Drop key={i} x={112 + (i % 2) * 8} delay={i * 150} run={pouring} />)}
    <Animated.View style={[{ position: 'absolute', left: 60, top: 70, width: 150, height: 150 }, plant]}>
      <PlantArt kind="monstera" size={150} />
    </Animated.View>
    {/* The soil darkens as the water goes in. */}
    <Animated.View style={[{ position: 'absolute', left: 95, top: 212, width: 80, height: 10, borderRadius: 4, backgroundColor: STAGE.soil.wet }, soil]} />
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
