/** Pieces shared by the onboarding steps: seed progress, the glass atmosphere, experience tiles. */
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Experience, experienceHint, experienceLabel, PlantKind } from '../../model';
import { plantArt } from '../../ds/plant';
import { useTheme } from '../../ds/theme';
import { radius, space } from '../../ds/tokens';
import { Glass, T, Tap } from '../../ds/components';
import { Glyph } from '../../ds/icons';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const SEED = 'M12 3C19 8.5 20.5 21 12 29C3.5 21 5 8.5 12 3Z';

/** Progress is a seed filling up from the bottom; on the last step it sprouts. */
export function SeedProgress({ step, total }: { step: number; total: number }) {
  const { c, reduceMotion } = useTheme();
  const fill = useSharedValue(step / total);
  useEffect(() => { fill.value = reduceMotion ? step / total : withTiming(step / total, { duration: 600, easing: Easing.out(Easing.cubic) }); }, [step]);
  const props = useAnimatedProps(() => ({ y: 32 - 28 * fill.value, height: 28 * fill.value + 1 }));
  const done = step >= total;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${total}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 28, height: 36, alignItems: 'center', justifyContent: 'flex-end' }}>
    <Svg width={24} height={32} viewBox="0 0 24 32">
      <Defs><ClipPath id="seed"><Path d={SEED} /></ClipPath></Defs>
      <Path d={SEED} fill={c.sunken} />
      <AnimatedRect x={0} width={24} fill={c.leafMark} clipPath="url(#seed)" animatedProps={props} />
      <Path d={SEED} fill="none" stroke={c.ink2} strokeWidth={1.4} />
      {done && <Path d="M12 3V-1M12 1C12 -1 10 -3 8 -3M12 1C12 -1 14 -3 16 -3" stroke={c.leafMark} strokeWidth={1.6} strokeLinecap="round" fill="none" />}
    </Svg>
    </View>
    {/* The seed fills as a feeling of progress; the count says exactly where you are. */}
    <T v="caption" tone="ink2" style={{ fontVariant: ['tabular-nums'] }}>{Math.min(step, total)} of {total}</T>
  </View>;
}

function Drift({ tint, size, from, to, ms }: { tint: string; size: number; from: [number, number]; to: [number, number]; ms: number }) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    p.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [reduceMotion]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: from[0] + (to[0] - from[0]) * p.value }, { translateY: from[1] + (to[1] - from[1]) * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: tint }, s]} />;
}

/** Slow colour fields that give the glass tiles something to refract. Onboarding only. */
export function Atmosphere() {
  const { scheme, reduceTransparency } = useTheme();
  if (reduceTransparency) return null;
  const [a, b] = scheme === 'dark' ? ['#1F3A22', '#2D3B14'] : ['#D6EFE0', '#EAF5BF'];
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: .9 }]}>
    <Drift tint={a} size={340} from={[-140, -40]} to={[-60, 40]} ms={11000} />
    <Drift tint={b} size={300} from={[170, 420]} to={[110, 340]} ms={13000} />
    <BlurView intensity={70} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
  </View>;
}

const FEW = require('../../../assets/scenes/few.png');
const GARDEN = require('../../../assets/scenes/garden-group.png');

export const experiences: { value: Experience; label: string; hint: string; art: PlantKind[]; scene?: number }[] = [
  { value: 'first', label: experienceLabel.first, hint: experienceHint.first, art: ['pilea'] },
  { value: 'some', label: experienceLabel.some, hint: experienceHint.some, art: [], scene: FEW },
  { value: 'many', label: experienceLabel.many, hint: experienceHint.many, art: [], scene: GARDEN },
];

export function GlassChoice({ on, onPress, label, hint, art, scene, wide }: { on: boolean; onPress: () => void; label: string; hint: string; art: PlantKind[]; scene?: number; wide?: boolean }) {
  const { c } = useTheme();
  return <Tap role="radio" selected={on} label={`${label}. ${hint}`} onPress={onPress} ring={radius.card} style={{ flex: wide ? undefined : 1 }}>
    <Glass level="control" r={radius.card} shadow={on} style={{ minHeight: 176, borderWidth: 1.5, borderColor: on ? c.ink : 'transparent', overflow: 'hidden' }}>
      {/* A whole garden: the crowd of plants gets the full width of the card. */}
      {wide && scene && <Image source={scene} resizeMode="contain" style={{ width: '100%', height: 132, marginTop: space[3] }} />}
      <View style={{ flex: 1, padding: space[4], gap: space[2], justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {!wide && <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {scene
            ? <Image source={scene} resizeMode="contain" style={{ width: 76, height: 76, marginLeft: -4 }} />
            : art.map((k, i) => <Image key={k} source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 62 : 58, height: i === 1 ? 62 : 58, marginHorizontal: -6 }} />)}
        </View>}
        <View style={{ gap: 2 }}>
          <T v="headline">{label}</T>
          <T v="footnote" tone="ink2">{hint}</T>
        </View>
      </View>
      {on && <View style={{ position: 'absolute', top: 12, right: 12 }}><Glyph name="check" size={18} /></View>}
    </Glass>
  </Tap>;
}
