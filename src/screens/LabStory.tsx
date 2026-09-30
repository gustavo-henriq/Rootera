/**
 * The Shipaton lab's opening story, drawn on the lab's dark stage (see Lab.tsx) with SVG
 * shapes moved by Reanimated. With Reduce Motion each scene shows its end state.
 *
 * 1. The watering becomes the weather (one continuous scene, played once, then held):
 *    a watering can pours on the plant; its outline turns into a rain cloud that keeps
 *    the rain going; the rain stops, the cloud lightens and drifts away, and the sun it
 *    was hiding comes out. Three captions follow the same timeline.
 * 2. Three cycles to know the plant: still analysing, getting specific, the pattern; the
 *    window narrows as the circles fill.
 *
 * The can-to-cloud change is a real change of shape: both outlines are sampled into the
 * same number of points, and on every frame the outline is drawn from points moved from
 * one to the other (an animated SVG prop, like the gauges in onboarding/shared.tsx).
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { pivot } from '../ds/motion';
import { PlantArt } from '../ds/plant';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { T, Tap } from '../ds/components';
import { t } from '../i18n';

export const STAGE = { text: '#F4F6F2', dim: 'rgba(244,246,242,.64)', faint: 'rgba(244,246,242,.38)', line: 'rgba(255,255,255,.14)', leaf: '#B6E07C', water: '#86BCCB', sun: '#F2D16B',
  soil: { dry: '#CDB690', moist: '#8A6242', wet: '#4A3322' } };

/* ------------------------------------------------------------------ scene 1: the watering becomes the weather */

type Pt = [number, number];
const W = 290, H = 270;
// The plant stands in the middle; the can comes from the left; the sky has room above.
const PLANT = { x: 70, y: 104, size: 150 };
// Measured on the monstera art (354 x 440, contained in the square): the soil's centre is at
// 68% of the height and the plant's centre line; drops end there, never over the pot.
const SOIL = { x: PLANT.x + 76, y: PLANT.y + 101 };
const CAN = { x: 10, y: 54, w: 110, h: 70 };
const PIVOT: Pt = [36, 42];   // the can turns around its body
const TIP: Pt = [105, 17];    // the spout's mouth, in the can's box
const TILT = 32;              // degrees, clockwise: the spout goes down
const RAIN_GREY = '#8FA3AE', LIGHT_GREY = '#D3DAD6';
// The cloud path's box (x 6-90, y 18-58), scaled and centred over the plant.
const CLOUD_K = 1.4;
const CLOUD_AT = { x: SOIL.x - (84 * CLOUD_K) / 2, y: 50 };
const SUN = { x: SOIL.x, y: 80, r: 24 };
// The sun's warm light: an oval that fades out before the scene's edges (a parent may clip them).
const GLOW = { rx: 120, ry: SUN.y };

// The timeline, in ms: slow enough to follow, played once and held on the sun.
const TL = {
  tilt: [300, 1700], pour: [1400, 5200], back: [5100, 6100],
  morph: [6300, 8700], handle: [6300, 7000],
  rain: [8100, 11700], clear: [11500, 12700], drift: [12500, 15300], sun: [12100, 13300], end: 15800,
};
const CAPTION_AT = [0, 6200, 12500];

/* The two outlines, sampled the same way (clockwise from the top-left). */
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 8): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt; });
const linePts = (a: Pt, b: Pt, n = 6): Pt[] => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as Pt);
const bezPts = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
  const u = i / n, v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]] as Pt;
});

/** Evenly spaced points along a closed outline, starting at its top-left. */
function resample(pts: Pt[], n: number): Pt[] {
  const ring = [...pts, pts[0]];
  const len = [0];
  for (let i = 1; i < ring.length; i++) len.push(len[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  const total = len[len.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k * total) / n;
    while (len[j] < d) j++;
    const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
    out.push([ring[j - 1][0] + (ring[j][0] - ring[j - 1][0]) * f, ring[j - 1][1] + (ring[j][1] - ring[j - 1][1]) * f]);
  }
  const xs = out.map(p => p[0]), ys = out.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let start = 0, best = Infinity;
  out.forEach((p, i) => { const s = (p[0] - x0) / (x1 - x0) + (p[1] - y0) / (y1 - y0); if (s < best) { best = s; start = i; } });
  return [...out.slice(start), ...out.slice(0, start)];
}

/** A smooth closed path through the points (quadratic curves between midpoints). */
function smooth(pts: Pt[]): string {
  'worklet';
  const n = pts.length, f = (v: number) => v.toFixed(1);
  let d = 'M' + f((pts[n - 1][0] + pts[0][0]) / 2) + ' ' + f((pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    d += ' Q' + f(p[0]) + ' ' + f(p[1]) + ' ' + f((p[0] + q[0]) / 2) + ' ' + f((p[1] + q[1]) / 2);
  }
  return d + ' Z';
}

const N = 96;
// The can: a rounded body with the spout, in its own 110 x 70 box (the handle is drawn apart).
const CAN_LOCAL = resample([
  ...linePts([18, 22], [54, 22]), ...arcPts(54, 30, 8, -90, 0), ...linePts([62, 30], [62, 33], 1),
  ...linePts([62, 33], [104, 14]), ...linePts([104, 14], [106, 20], 2), ...linePts([106, 20], [62, 43]),
  ...linePts([62, 43], [62, 54], 3), ...arcPts(54, 54, 8, 0, 90), ...linePts([54, 62], [18, 62]),
  ...arcPts(18, 54, 8, 90, 180), ...linePts([10, 54], [10, 30]), ...arcPts(18, 30, 8, 180, 270),
], N);
const CAN_SCENE: Pt[] = CAN_LOCAL.map(([x, y]) => [CAN.x + x, CAN.y + y]);
// The cloud: the same outline as the lab's cloud, placed over the plant.
const CLOUD_SCENE: Pt[] = resample([
  ...bezPts([22, 58], [8, 58], [6, 40], [20, 38]), ...bezPts([20, 38], [20, 22], [42, 18], [48, 30]),
  ...bezPts([48, 30], [56, 18], [78, 22], [76, 40]), ...bezPts([76, 40], [90, 40], [90, 58], [76, 58]),
  ...linePts([76, 58], [22, 58], 12),
].map(([x, y]) => [CLOUD_AT.x + (x - 6) * CLOUD_K, CLOUD_AT.y + (y - 18) * CLOUD_K] as Pt), N);
const CLOUD_PATH = smooth(CLOUD_SCENE);
const CAN_PATH = smooth(CAN_LOCAL);
const CAN_OUTLINE = smooth(CAN_SCENE);
/** The outline on its way from the can (0) to the cloud (1): every point eased across, lifted a little. */
function morphAt(u: number) {
  'worklet';
  const lift = 12 * Math.sin(Math.PI * u);
  const pts: Pt[] = [];
  for (let i = 0; i < CAN_SCENE.length; i++) {
    const a = CAN_SCENE[i], b = CLOUD_SCENE[i];
    pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - lift]);
  }
  return smooth(pts);
}

/* The timeline's shapes of time. */
const band = (v: number, a: number, b: number) => { 'worklet'; return Math.min(1, Math.max(0, (v - a) / (b - a))); };
const sm = (u: number) => { 'worklet'; return u * u * (3 - 2 * u); };
/** The can's tilt (0-1): in slowly, held while pouring, back slowly. */
function tiltAt(ms: number) {
  'worklet';
  return ms < TL.back[0] ? sm(band(ms, TL.tilt[0], TL.tilt[1])) : 1 - sm(band(ms, TL.back[0], TL.back[1]));
}
/** Where the spout's mouth is, in the scene, at a given tilt. */
function tipAt(tilt: number): Pt {
  'worklet';
  const a = (tilt * TILT * Math.PI) / 180, vx = TIP[0] - PIVOT[0], vy = TIP[1] - PIVOT[1];
  return [CAN.x + PIVOT[0] + vx * Math.cos(a) - vy * Math.sin(a), CAN.y + PIVOT[1] + vx * Math.sin(a) + vy * Math.cos(a)];
}
/**
 * A repeating fall inside a window: where this drop is in its current fall (0-1), or -1 when
 * it isn't falling. A fall that started inside the window finishes after it (the water
 * already in the air lands), so the stream starts and stops gently.
 */
function fallAt(ms: number, from: number, to: number, offset: number, duration: number) {
  'worklet';
  const rel = ms - from - offset;
  if (rel < 0) return -1;
  const n = Math.floor(rel / duration);
  return from + offset + n * duration > to ? -1 : (rel - n * duration) / duration;
}

const POUR_FALL = 1100, POUR_DROPS = 8;
function PourDrop({ ms, k }: { ms: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const f = fallAt(ms.value, TL.pour[0], TL.pour[1], (k * POUR_FALL) / POUR_DROPS, POUR_FALL);
    if (f < 0) return { opacity: 0 };
    // It left the spout when this fall began, from where the mouth was then.
    const [x0, y0] = tipAt(tiltAt(ms.value - f * POUR_FALL));
    // A short arc: steady forward, falling faster and faster, into the soil.
    const x = x0 + (SOIL.x - 4 - x0) * f, y = y0 + (SOIL.y - y0) * (.2 * f + .8 * f * f);
    return { opacity: f < .88 ? .95 : .95 * (1 - (f - .88) / .12), transform: [{ translateX: x - 2.5 }, { translateY: y - 4 }, { scaleY: 1 + .5 * f }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: 5, height: 8, borderRadius: 3, backgroundColor: STAGE.water }, style]} />;
}

const RAIN_FALL = 950, RAIN_DROPS = 12;
function RainDrop({ ms, k }: { ms: SharedValue<number>; k: number }) {
  const x0 = CLOUD_AT.x + 16 + k * ((84 * CLOUD_K - 32) / (RAIN_DROPS - 1)) + ((k * 7) % 5) - 2;
  const y0 = CLOUD_AT.y + 38 * CLOUD_K - 2 + ((k * 5) % 4);
  // Some drops stop on the leaves, others reach the soil.
  const y1 = SOIL.y - 4 - ((k * 13) % 34);
  const offset = (k * 311) % RAIN_FALL;
  const style = useAnimatedStyle(() => {
    const f = fallAt(ms.value, TL.rain[0], TL.rain[1], offset, RAIN_FALL);
    if (f < 0) return { opacity: 0 };
    const y = y0 + (y1 - y0) * (.3 * f + .7 * f * f);
    return { opacity: f < .85 ? .8 : .8 * (1 - (f - .85) / .15), transform: [{ translateX: x0 - 5 * f }, { translateY: y }, { rotate: '8deg' }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: 3, height: 10, borderRadius: 2, backgroundColor: STAGE.water }, style]} />;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const FULL = { position: 'absolute', left: 0, top: 0, width: W, height: H } as const;

/** The can turning into the cloud: one outline reshaped on every frame, its green going grey. */
function Morph({ ms }: { ms: SharedValue<number> }) {
  const shown = useAnimatedStyle(() => ({ opacity: ms.value >= TL.morph[0] && ms.value <= TL.morph[1] ? 1 : 0 }));
  const grey = useAnimatedStyle(() => ({ opacity: sm(band(ms.value, TL.morph[0], TL.morph[1])) }));
  const shape = useAnimatedProps(() => ({ d: morphAt(sm(band(ms.value, TL.morph[0], TL.morph[1]))) }));
  const greyShape = useAnimatedProps(() => ({ d: morphAt(sm(band(ms.value, TL.morph[0], TL.morph[1]))) }));
  return <Animated.View pointerEvents="none" style={[FULL, shown]}>
    <Svg width={W} height={H}><AnimatedPath d={CAN_OUTLINE} animatedProps={shape} fill={STAGE.leaf} /></Svg>
    {/* The same outline in the rain's grey fades in on top: the colour changes, the edge stays single. */}
    <Animated.View style={[FULL, grey]}>
      <Svg width={W} height={H}><AnimatedPath d={CAN_OUTLINE} animatedProps={greyShape} fill={RAIN_GREY} /></Svg>
    </Animated.View>
  </Animated.View>;
}

const CAPTIONS = [
  { title: 'A watering makes all the difference', line: 'Rootera starts counting from the watering you record.' },
  { title: 'Rootera learns with each cycle', line: 'And with the real weather: rain, cloud and sun change how long the soil takes to dry.' },
  { title: 'No need to work it out yourself', line: 'Your checks and your local weather do the sums.' },
];

function Caption({ ms, i }: { ms: SharedValue<number>; i: number }) {
  const a = CAPTION_AT[i], b = CAPTION_AT[i + 1];
  const style = useAnimatedStyle(() => {
    const v = ms.value;
    const inn = i === 0 ? 1 : sm(band(v, a, a + 700));
    const out = b === undefined ? 1 : 1 - sm(band(v, b - 500, b));
    return { opacity: v < a ? 0 : Math.min(inn, out), transform: [{ translateY: 10 * (1 - inn) }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, gap: space[3] }, style]}>
    <T v="hero" style={{ color: STAGE.text }}>{t(CAPTIONS[i].title)}</T>
    <T v="callout" style={{ color: STAGE.dim }}>{t(CAPTIONS[i].line)}</T>
  </Animated.View>;
}

export function WaterWeatherScene() {
  const { reduceMotion } = useTheme();
  const ms = useSharedValue(reduceMotion ? TL.end : 0);
  const spin = useSharedValue(0);
  const [done, setDone] = useState(reduceMotion);
  const play = () => {
    setDone(false);
    ms.value = 0;
    ms.value = withTiming(TL.end, { duration: TL.end, easing: Easing.linear });
  };
  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
    play();
    return () => { cancelAnimation(ms); cancelAnimation(spin); };
  }, []);
  // "See again" shows once the scene has played through.
  useEffect(() => {
    if (done || reduceMotion) return;
    const timer = setTimeout(() => setDone(true), TL.end);
    return () => clearTimeout(timer);
  }, [done]);

  const can = useAnimatedStyle(() => ({
    opacity: ms.value < TL.morph[0] ? 1 : 0,
    transform: pivot(CAN.w, CAN.h, PIVOT[0] / CAN.w, PIVOT[1] / CAN.h, [{ rotate: `${tiltAt(ms.value) * TILT}deg` }]),
  }));
  const handle = useAnimatedStyle(() => ({
    opacity: ms.value < TL.handle[0] ? 1 : 1 - sm(band(ms.value, TL.handle[0], TL.handle[1])),
    transform: pivot(CAN.w, CAN.h, PIVOT[0] / CAN.w, PIVOT[1] / CAN.h, [{ rotate: `${tiltAt(ms.value) * TILT}deg` }]),
  }));
  // The cloud takes over from the last frame and lightens as the rain stops. Then it drifts
  // off whole to the right, uncovering the sun, and leaves the frame (a fading cloud would
  // turn dark on this stage). On a wide screen it fades once it's far enough.
  const cloud = useAnimatedStyle(() => {
    const u = band(ms.value, TL.drift[0], TL.drift[1]);
    const away = sm(u);
    return { opacity: ms.value <= TL.morph[1] ? 0 : 1 - sm(band(u, .75, 1)), transform: [{ translateX: 300 * away }, { translateY: -6 * away }] };
  });
  const lighter = useAnimatedStyle(() => ({ opacity: sm(band(ms.value, TL.clear[0], TL.clear[1])) }));
  // The sun lights up behind the cloud (a sun fading in on its own would look dark here), so
  // it's already bright when the cloud moves off. Then the warm glow grows; the rays turn slowly.
  const sun = useAnimatedStyle(() => {
    const s = sm(band(ms.value, TL.sun[0], TL.sun[1]));
    return { opacity: s, transform: [{ translateY: 16 * (1 - s) }, { scale: .8 + .2 * s }] };
  });
  const glow = useAnimatedStyle(() => ({ opacity: .6 * sm(band(ms.value, TL.sun[0] + 400, TL.end)) }));
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return <View style={{ gap: space[5] }}>
    <View accessible accessibilityRole="image" accessibilityLabel={t('A watering can waters the plant and turns into a rain cloud; then the sky clears and the sun comes out')}
      style={{ width: W, height: H, alignSelf: 'center' }}>
      {/* The warm light of the sun, behind everything. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: SUN.x - GLOW.rx, top: SUN.y - GLOW.ry, width: 2 * GLOW.rx, height: 2 * GLOW.ry }, glow]}>
        <Svg width={2 * GLOW.rx} height={2 * GLOW.ry}>
          <Defs><RadialGradient id="sunglow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={STAGE.sun} stopOpacity={.45} /><Stop offset="1" stopColor={STAGE.sun} stopOpacity={0} /></RadialGradient></Defs>
          <Rect width={2 * GLOW.rx} height={2 * GLOW.ry} fill="url(#sunglow)" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: SUN.x - 50, top: SUN.y - 50, width: 100, height: 100 }, sun]}>
        <Animated.View style={[{ position: 'absolute', width: 100, height: 100 }, rays]}>
          <Svg width={100} height={100}>
            {Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <Line key={i} x1={50 + Math.cos(a) * 32} y1={50 + Math.sin(a) * 32} x2={50 + Math.cos(a) * 43} y2={50 + Math.sin(a) * 43} stroke={STAGE.sun} strokeWidth={3.5} strokeLinecap="round" />; })}
          </Svg>
        </Animated.View>
        <Svg width={100} height={100}><Circle cx={50} cy={50} r={SUN.r} fill={STAGE.sun} /></Svg>
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', left: PLANT.x, top: PLANT.y }}><PlantArt kind="monstera" size={PLANT.size} /></View>
      {Array.from({ length: POUR_DROPS }, (_, k) => <PourDrop key={'p' + k} ms={ms} k={k} />)}
      {Array.from({ length: RAIN_DROPS }, (_, k) => <RainDrop key={'r' + k} ms={ms} k={k} />)}
      {/* The can (body and spout), and its handle, which fades as the can changes. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: CAN.x, top: CAN.y, width: CAN.w, height: CAN.h }, handle]}>
        <Svg width={CAN.w} height={CAN.h}><Path d="M20 22 C20 6 52 6 52 22" stroke={STAGE.leaf} strokeWidth={5} strokeLinecap="round" fill="none" /></Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: CAN.x, top: CAN.y, width: CAN.w, height: CAN.h }, can]}>
        <Svg width={CAN.w} height={CAN.h}><Path d={CAN_PATH} fill={STAGE.leaf} /></Svg>
      </Animated.View>
      <Morph ms={ms} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, cloud]}>
        <Svg width={W} height={H}><Path d={CLOUD_PATH} fill={RAIN_GREY} /></Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, lighter]}>
          <Svg width={W} height={H}><Path d={CLOUD_PATH} fill={LIGHT_GREY} /></Svg>
        </Animated.View>
      </Animated.View>
    </View>
    {reduceMotion
      ? <View style={{ gap: space[4] }}>{CAPTIONS.map(c => <View key={c.title} style={{ gap: space[1] }}>
          <T v="headline" style={{ color: STAGE.text }}>{t(c.title)}</T>
          <T v="subhead" style={{ color: STAGE.dim }}>{t(c.line)}</T>
        </View>)}</View>
      : <View style={{ gap: space[2] }}>
          <View style={{ height: 176 }}>{CAPTIONS.map((_, i) => <Caption key={i} ms={ms} i={i} />)}</View>
          {/* Room kept for "See again", so nothing moves when it appears. */}
          <View style={{ height: 44 }}>
            {done && <Animated.View entering={FadeIn.duration(500)} style={{ alignSelf: 'flex-start' }}>
              <Tap label={t('See again')} onPress={play} ring={radius.inner} style={{ minHeight: 44, justifyContent: 'center' }}>
                <T v="subhead" style={{ color: STAGE.leaf, fontFamily: fonts.medium }}>{t('See again')}</T>
              </Tap>
            </Animated.View>}
          </View>
        </View>}
  </View>;
}

/* ------------------------------------------------------------------ scene 2: three cycles */

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
