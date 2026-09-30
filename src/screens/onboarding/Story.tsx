/**
 * How Rootera learns, told by roots, playing on its own (no taps). After the dive into the
 * soil, a seed sends one root down at a time; a sprout opens at the tip and the card for
 * that source comes out of it: what you observe, what you tell us, the species notes.
 * After the third, "Rootera suggests" closes the story and Continue appears.
 *
 * The cards hold their places from the start (invisible), so nothing moves as they arrive,
 * and the roots are drawn to where the cards really are (measured), at any text size.
 * A root grows by redrawing its outline on every frame (an animated SVG prop, as in
 * onboarding/shared.tsx). With Reduce Motion everything is there at once.
 */
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { cancelAnimation, Easing, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../../ds/theme';
import { radius, space } from '../../ds/tokens';
import { SourceMark, T } from '../../ds/components';
import { enter, pivot } from '../../ds/motion';
import { t } from '../../i18n';

const SOURCES = [
  { key: 'observed' as const, title: 'You observe', text: 'Soil checks, waterings, leaves.' },
  { key: 'told' as const, title: 'You tell us', text: 'Its light, pot and spot.' },
  { key: 'species' as const, title: 'Species notes', text: 'A starting point, not a rule.' },
];

/* The roots' column, left of the cards: the seed, the roots and the sprouts at their tips. */
const COL = 60;
const SEED = { x: 20, y: 8 };
const TIP_X = 32;
const WIDTH = [4.2, 3.6, 3];        // each root at the seed; all end fine at the tip
const SWAY = [9, -8, 12];           // so the three roots part and cross like real ones
const WIGGLE = [2.5, 4, 5];         // and wander a little on the way down

/* The timeline, in ms from when the title has arrived. */
const SEED_IN = 240;                // the seed shows first
const STEP = 800;                   // then one root after another
const GROW = 560;                   // a root's growth
const SPROUT = 380;                 // the sprout opens as the tip arrives
const CARD = 500;                   // and its card comes out right after
const rootAt = (i: number) => SEED_IN + i * STEP;
const ENDING = rootAt(2) + CARD + 450;   // "Rootera suggests"
const DONE = ENDING + 350;              // Continue

const band = (v: number, a: number, b: number) => { 'worklet'; return Math.min(1, Math.max(0, (v - a) / (b - a))); };
const out3 = (u: number) => { 'worklet'; return 1 - Math.pow(1 - u, 3); };
/** Overshoots a little and settles: the sprout pops open. */
const backOut = (u: number) => { 'worklet'; const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

/** A root's centre line from the seed to the tip beside card `i` (flat x, y list). */
function rootLine(i: number, tipY: number) {
  const p0 = [SEED.x, SEED.y + 3], p1 = [SEED.x + SWAY[i], SEED.y + (tipY - SEED.y) * .45], p2 = [SEED.x - 10 + 2 * i, tipY - 16], p3 = [TIP_X, tipY];
  const pts: number[] = [];
  for (let k = 0; k <= 40; k++) {
    const u = k / 40, v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    const wander = WIGGLE[i] * Math.sin(u * Math.PI * (3 + i)) * 4 * u * v;
    pts.push(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0] + wander, a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]);
  }
  return pts;
}

/** The root's outline grown to `p` (0-1): thick at the seed, fine at the growing tip. */
function rootPath(pts: number[], p: number, w0: number) {
  'worklet';
  const n = pts.length / 2 - 1, m = p * n;
  if (m < .05) return 'M0 0';
  const k = Math.min(n - 1, Math.floor(m)), f = m - k;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= k; i++) { xs.push(pts[2 * i]); ys.push(pts[2 * i + 1]); }
  xs.push(pts[2 * k] + (pts[2 * k + 2] - pts[2 * k]) * f);
  ys.push(pts[2 * k + 1] + (pts[2 * k + 3] - pts[2 * k + 1]) * f);
  const L = xs.length;
  let left = '', right = '';
  for (let i = 0; i < L; i++) {
    const a = Math.max(0, i - 1), b = Math.min(L - 1, i + 1);
    let tx = xs[b] - xs[a], ty = ys[b] - ys[a];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const half = (w0 * Math.pow(1 - i / (L - 1 || 1), .8) + .4) / 2;
    left += (i ? ' L' : 'M') + (xs[i] - ty * half).toFixed(1) + ' ' + (ys[i] + tx * half).toFixed(1);
    right = ' L' + (xs[i] + ty * half).toFixed(1) + ' ' + (ys[i] - tx * half).toFixed(1) + right;
  }
  return left + right + ' Z';
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Root({ clock, i, pts, color }: { clock: SharedValue<number>; i: number; pts: number[]; color: string }) {
  const props = useAnimatedProps(() => ({ d: rootPath(pts, out3(band(clock.value, rootAt(i), rootAt(i) + GROW)), WIDTH[i]) }), [pts]);
  return <AnimatedPath animatedProps={props} d="M0 0" fill={color} />;
}

/** Two leaves on a short stem; it opens from its base, at the root's tip. */
function Sprout({ clock, at, x, y, color }: { clock: SharedValue<number>; at: number; x: number; y: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const u = band(clock.value, at, at + 340);
    // No scale from zero (it flickers on iOS): it starts small and fades in.
    return { opacity: band(clock.value, at, at + 120), transform: pivot(22, 22, 3 / 22, 19 / 22, [{ scale: .3 + .7 * backOut(u) }]) };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - 3, top: y - 19, width: 22, height: 22 }, style]}>
    <Svg width={22} height={22}>
      <Path d="M3 19 C5 15 7 12 9 9" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M9 9 C6 8 3 5 3 1 C7 1 9 4 9 9 Z" fill={color} />
      <Path d="M9 9 C11 5 15 3 20 4 C19 9 14 11 9 9 Z" fill={color} />
    </Svg>
  </Animated.View>;
}

function Card({ clock, at, source, onLayout }: { clock: SharedValue<number>; at: number; source: typeof SOURCES[number]; onLayout: (e: LayoutChangeEvent) => void }) {
  const { c } = useTheme();
  // It comes out of the sprout: a short slide from the left while it fades in.
  const style = useAnimatedStyle(() => {
    const e = out3(band(clock.value, at, at + 280));
    return { opacity: e, transform: [{ translateX: -14 * (1 - e) }] };
  });
  return <Animated.View onLayout={onLayout} style={style}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.control, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.raised }}>
      <SourceMark kind={source.key} size={10} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{t(source.title)}</T>
        <T v="subhead" tone="ink2">{t(source.text)}</T>
      </View>
    </View>
  </Animated.View>;
}

export function Story({ start, onComplete }: { start: number; onComplete: () => void }) {
  const { c, scheme, reduceMotion } = useTheme();
  const clock = useSharedValue(reduceMotion ? DONE : 0);
  const [tips, setTips] = useState<(number | null)[]>([null, null, null]);
  const [height, setHeight] = useState(0);
  const [ended, setEnded] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) { const done = setTimeout(onComplete, 0); return () => clearTimeout(done); }
    // It starts as the title's last words arrive.
    const at = Math.max(0, start - 250);
    clock.value = withDelay(at, withTiming(DONE, { duration: DONE, easing: Easing.linear }));
    const timers = [setTimeout(() => setEnded(true), at + ENDING), setTimeout(onComplete, at + DONE)];
    return () => { cancelAnimation(clock); timers.forEach(clearTimeout); };
  }, []);

  const lines = useMemo(() => tips.every(y => y !== null) ? tips.map((y, i) => rootLine(i, y!)) : null, [tips]);
  const place = (i: number) => (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    setTips(prev => { const next = [...prev]; next[i] = Math.round(y + h / 2); return next; });
  };
  const seed = useAnimatedStyle(() => ({ opacity: band(clock.value, 0, SEED_IN) }));
  const rootColor = scheme === 'dark' ? c.soil[1] : c.soil[2];

  return <View style={{ gap: space[5] }}>
    <View onLayout={e => setHeight(e.nativeEvent.layout.height)} style={{ paddingLeft: COL, paddingTop: space[6], gap: space[8] }}>
      {lines && height > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: COL, height }}>
        <Svg width={COL} height={height}>{lines.map((pts, i) => <Root key={i} clock={clock} i={i} pts={pts} color={rootColor} />)}</Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, seed]}>
          <Svg width={COL} height={20}><Ellipse cx={SEED.x} cy={SEED.y} rx={6.5} ry={4.6} transform={`rotate(-18 ${SEED.x} ${SEED.y})`} fill={c.soil[1]} /></Svg>
        </Animated.View>
        {tips.map((y, i) => <Sprout key={i} clock={clock} at={rootAt(i) + SPROUT} x={TIP_X} y={y!} color={c.leaf} />)}
      </View>}
      {SOURCES.map((s, i) => <Card key={s.key} clock={clock} at={rootAt(i) + CARD} source={s} onLayout={place(i)} />)}
    </View>
    {ended && <Animated.View entering={reduceMotion ? undefined : enter.rise()} style={{ gap: space[2], alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: c.successSoft }}>
        <SourceMark kind="suggested" /><T v="caption" tone="leafText">{t("Rootera suggests")}</T>
      </View>
      <T v="subhead" tone="ink2">{t("Every suggestion shows its source.")}</T>
    </Animated.View>}
  </View>;
}
