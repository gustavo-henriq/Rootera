/**
 * How deep to check, drawn instead of explained: a pot in cross-section and a hand coming
 * down, index finger first, until the fingertip reaches the depth being asked about.
 * Beginners get the "how" at a glance; the text says the same.
 *
 * Used two ways: with a species `dryness` (how deep that plant is judged), or with an
 * explicit `depth` for the three-layer check, where the hand moves from layer to layer and
 * each answered layer is painted in the pot (`bands`: top, middle, bottom).
 *
 * The drawing keeps room above the pot, so the whole hand is visible as it comes down
 * (a lone finger cut at the top edge did not read as a hand).
 */
import { useEffect } from 'react';
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
export type Band = 'dry' | 'moist' | 'wet' | 'unreached' | null | undefined;

// A hand seen from the side, in a 64 x 92 box: the wrist comes in from the top right (in a
// leaf-green cuff), the thumb sticks out, three fingers are curled and the index points
// straight down. The fingertip is at (34, 90).
const HAND = 'M40 6 L62 6 C61 18 60 28 55 37 C51 43 45 47 40 50 L39 84 Q39 90 34 90 Q29 90 29 84 L29 57 C26 57 23 55 22 52 C19 52 17 49 17 46 C14 45 13 42 14 39 C9 38 5 34 4 29 C3 26 6 24 9 26 C13 28 16 29 19 28 C24 21 31 13 40 6 Z';
const CUFF = 'M38 0 L64 0 L63 9 L37 9 Z';
const CREASES = 'M29 57 C31 55 33 53 36 52 M22 52 C24 50 26 49 29 49 M17 46 C19 44 21 43 24 43';
const HAND_W = 46, HAND_H = HAND_W * 92 / 64, TIP_X = 34 / 64, TIP = 90 / 92;
const W = 120, HEAD = 70, H = 96, TOP = 14, SOIL_TOP = 22, BOTTOM = 90;

export function DepthRuler({ dryness, depth, heading, label, bands }: { dryness?: Dryness; depth?: number; heading?: string; label?: string; bands?: [Band, Band, Band] }) {
  const { c, reduceMotion } = useTheme();
  const d = DEPTH[dryness ?? 'unknown'] ?? DEPTH.unknown;
  const at = depth ?? d.at;
  const depthY = HEAD + SOIL_TOP + (BOTTOM - SOIL_TOP) * at;
  // The fingertip starts just above the rim and travels to each depth it is asked for.
  const startTip = HEAD + TOP - 8;
  const tip = useSharedValue(reduceMotion ? depthY : startTip);
  useEffect(() => {
    tip.value = reduceMotion ? depthY : withDelay(tip.value === startTip ? 250 : 0, withTiming(depthY, { duration: 700, easing: Easing.inOut(Easing.cubic) }));
  }, [depthY]);
  const hand = useAnimatedStyle(() => ({ transform: [{ translateY: tip.value - HAND_H * TIP }] }));
  // The soil inside the pot, split in three equal layers (the pot narrows toward the bottom).
  const inner = (y: number) => { const f = (y - SOIL_TOP) / (BOTTOM - 4 - SOIL_TOP); return [20 + 7 * f, 100 - 7 * f]; };
  const layer = (i: number) => {
    const y0 = SOIL_TOP + (BOTTOM - 4 - SOIL_TOP) * i / 3, y1 = SOIL_TOP + (BOTTOM - 4 - SOIL_TOP) * (i + 1) / 3;
    const [a0, b0] = inner(y0), [a1, b1] = inner(y1);
    return `M${a0} ${HEAD + y0} L${b0} ${HEAD + y0} L${b1} ${HEAD + y1} L${a1} ${HEAD + y1} Z`;
  };
  const fill = (b: Band) => b === 'dry' ? c.soil[0] : b === 'moist' ? c.soil[2] : b === 'wet' ? c.soil[3] : null;
  const text = label ?? t(d.label);
  return <View accessible accessibilityRole="image" accessibilityLabel={t('Check depth: {v}', { v: text })} style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
    <View style={{ width: W, height: HEAD + H }}>
      <Svg width={W} height={HEAD + H} viewBox={`0 0 ${W} ${HEAD + H}`}>
        <Path d={`M16 ${HEAD + TOP} L104 ${HEAD + TOP} L94 ${HEAD + BOTTOM} L26 ${HEAD + BOTTOM} Z`} fill={c.clay} opacity={.9} />
        <Path d={`M20 ${HEAD + SOIL_TOP} L100 ${HEAD + SOIL_TOP} L93 ${HEAD + BOTTOM - 4} L27 ${HEAD + BOTTOM - 4} Z`} fill={c.soil[3]} opacity={bands ? .45 : 1} />
        {bands?.map((b, i) => fill(b) ? <Path key={i} d={layer(i)} fill={fill(b)!} /> : null)}
        {/* Wet layers carry a little standing water. */}
        {bands?.map((b, i) => b === 'wet' ? <Path key={'w' + i} d={layer(i)} fill={c.water} opacity={.35} /> : null)}
        {bands && [1, 2].map(i => { const y = SOIL_TOP + (BOTTOM - 4 - SOIL_TOP) * i / 3; const [a, b] = inner(y); return <Line key={i} x1={a} x2={b} y1={HEAD + y} y2={HEAD + y} stroke={c.canvas} strokeWidth={1} opacity={.6} />; })}
        <Rect x={12} y={HEAD + TOP - 5} width={96} height={8} rx={2} fill={c.clay} />
        {!bands && <Line x1={24} x2={96} y1={depthY} y2={depthY} stroke={c.leafMark} strokeWidth={2} strokeDasharray="4 3" />}
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
      <T v="footnote" tone="ink2">{heading ?? t("How deep to check")}</T>
      <T v="subhead">{text}</T>
    </View>
  </View>;
}
