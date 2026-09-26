/**
 * How deep to check, drawn instead of explained: a pot in cross-section with a finger
 * going down to the depth that matters for this species (the top few centimetres, about
 * halfway, or the whole pot). Beginners get the "how" at a glance; the text says the same.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTheme } from './theme';
import { space } from './tokens';
import { T } from './components';

type Dryness = 'top' | 'half' | 'full' | 'unknown' | undefined;
const DEPTH: Record<string, { at: number; label: string }> = {
  top: { at: .22, label: 'The top 2 to 3 cm' },
  half: { at: .45, label: 'About 5 cm, a third of the way down' },
  full: { at: .85, label: 'All the way down (a wooden skewer helps)' },
  unknown: { at: .35, label: 'A few centimetres down' },
};

export function DepthRuler({ dryness }: { dryness: Dryness }) {
  const { c, reduceMotion } = useTheme();
  const d = DEPTH[dryness ?? 'unknown'] ?? DEPTH.unknown;
  const W = 120, H = 96, top = 14, soilTop = 22, bottom = 90;
  const depthY = soilTop + (bottom - soilTop) * d.at;
  const p = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => { if (!reduceMotion) p.value = withDelay(250, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })); }, [dryness]);
  // The finger slides down from above the rim to the checking depth.
  const finger = useAnimatedStyle(() => ({ transform: [{ translateY: (depthY - 4) * p.value - 18 }] }));
  return <View accessible accessibilityRole="image" accessibilityLabel={`Check depth: ${d.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={`M16 ${top} L104 ${top} L94 ${bottom} L26 ${bottom} Z`} fill={c.clay} opacity={.9} />
        <Path d={`M20 ${soilTop} L100 ${soilTop} L93 ${bottom - 4} L27 ${bottom - 4} Z`} fill={c.soil[3]} />
        <Rect x={12} y={top - 5} width={96} height={8} rx={2} fill={c.clay} />
        <Line x1={24} x2={96} y1={depthY} y2={depthY} stroke={c.leafMark} strokeWidth={2} strokeDasharray="4 3" />
      </Svg>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: W / 2 - 7, top: 0, width: 14, height: 34, borderRadius: 7, backgroundColor: c.soil[0], borderWidth: 1.5, borderColor: c.ink2 }, finger]} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <T v="footnote" tone="ink2">How deep to check</T>
      <T v="subhead">{d.label}</T>
    </View>
  </View>;
}
