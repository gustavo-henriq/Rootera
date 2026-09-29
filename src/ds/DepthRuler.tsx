/**
 * How deep to check, drawn instead of explained: a pot in cross-section and a hand coming
 * down, index finger first, until the fingertip reaches the depth that matters for this
 * species (the top few centimetres, about halfway, or the whole pot). Beginners get the
 * "how" at a glance; the text says the same.
 *
 * The drawing keeps room above the pot, so the whole hand is visible as it comes down
 * (a lone finger cut at the top edge did not read as a hand).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTheme } from './theme';
import { space } from './tokens';
import { T } from './components';
import { t } from '../i18n';

type Dryness = 'top' | 'half' | 'full' | 'unknown' | undefined;
const DEPTH: Record<string, { at: number; label: string }> = {
  top: { at: .22, label: 'The top 2 to 3 cm' },
  half: { at: .45, label: 'About 5 cm, a third of the way down' },
  full: { at: .85, label: 'All the way down (a wooden skewer helps)' },
  unknown: { at: .35, label: 'A few centimetres down' },
};

// A hand seen from the side, in a 64 x 92 box: the wrist comes in from the top right (in a
// leaf-green cuff), the thumb sticks out, three fingers are curled and the index points
// straight down. The fingertip is at (34, 90).
const HAND = 'M40 6 L62 6 C61 18 60 28 55 37 C51 43 45 47 40 50 L39 84 Q39 90 34 90 Q29 90 29 84 L29 57 C26 57 23 55 22 52 C19 52 17 49 17 46 C14 45 13 42 14 39 C9 38 5 34 4 29 C3 26 6 24 9 26 C13 28 16 29 19 28 C24 21 31 13 40 6 Z';
const CUFF = 'M38 0 L64 0 L63 9 L37 9 Z';
const CREASES = 'M29 57 C31 55 33 53 36 52 M22 52 C24 50 26 49 29 49 M17 46 C19 44 21 43 24 43';
const HAND_W = 46, HAND_H = HAND_W * 92 / 64, TIP_X = 34 / 64, TIP = 90 / 92;

export function DepthRuler({ dryness }: { dryness: Dryness }) {
  const { c, reduceMotion } = useTheme();
  const d = DEPTH[dryness ?? 'unknown'] ?? DEPTH.unknown;
  const W = 120, HEAD = 70, H = 96, top = 14, soilTop = 22, bottom = 90;
  const depthY = HEAD + soilTop + (bottom - soilTop) * d.at;
  // The fingertip starts just above the rim and ends at the checking depth.
  const startTip = HEAD + top - 8;
  const p = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => { if (!reduceMotion) p.value = withDelay(250, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })); }, [dryness]);
  const hand = useAnimatedStyle(() => ({ transform: [{ translateY: startTip + (depthY - startTip) * p.value - HAND_H * TIP }] }));
  return <View accessible accessibilityRole="image" accessibilityLabel={t('Check depth: {v}', { v: t(d.label) })} style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
    <View style={{ width: W, height: HEAD + H }}>
      <Svg width={W} height={HEAD + H} viewBox={`0 0 ${W} ${HEAD + H}`}>
        <Path d={`M16 ${HEAD + top} L104 ${HEAD + top} L94 ${HEAD + bottom} L26 ${HEAD + bottom} Z`} fill={c.clay} opacity={.9} />
        <Path d={`M20 ${HEAD + soilTop} L100 ${HEAD + soilTop} L93 ${HEAD + bottom - 4} L27 ${HEAD + bottom - 4} Z`} fill={c.soil[3]} />
        <Rect x={12} y={HEAD + top - 5} width={96} height={8} rx={2} fill={c.clay} />
        <Line x1={24} x2={96} y1={depthY} y2={depthY} stroke={c.leafMark} strokeWidth={2} strokeDasharray="4 3" />
      </Svg>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: W / 2 - HAND_W * TIP_X, top: 0, width: HAND_W, height: HAND_H }, hand]}>
        <Svg width={HAND_W} height={HAND_H} viewBox="0 0 64 92">
          <Path d={HAND} fill="#F1CFAE" stroke={c.ink2} strokeWidth={2} strokeLinejoin="round" />
          <Path d={CREASES} fill="none" stroke={c.ink2} strokeWidth={1.4} strokeLinecap="round" />
          <Path d={CUFF} fill={c.leafMark} stroke={c.ink2} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <T v="footnote" tone="ink2">{t("How deep to check")}</T>
      <T v="subhead">{t(d.label)}</T>
    </View>
  </View>;
}
