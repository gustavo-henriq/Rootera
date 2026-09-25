import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { BlurTargetView, BlurView } from 'expo-blur';
import { PlantKind } from './model';
import { color, radius } from './theme';
import { GroundShadow, PlantArt, Txt, useReducedMotion } from './ui';

const out = Easing.bezier(.22, 1, .36, 1);
const gravity = Easing.bezier(.55, 0, 1, .45);

/** Onboarding: the pot drops first, the plant follows and its leaves sway from the impact. */
export function PlantAssembly({ size = 250 }: { size?: number }) {
  const reduce = useReducedMotion();
  const pot = useSharedValue(reduce ? 0 : -420);
  const plant = useSharedValue(reduce ? 0 : -460);
  const squash = useSharedValue(1);
  const sway = useSharedValue(0);
  const shadow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { pot.value = 0; plant.value = 0; shadow.value = 1; return; }
    pot.value = withTiming(0, { duration: 420, easing: gravity });
    shadow.value = withTiming(1, { duration: 420, easing: gravity });
    squash.value = withDelay(420, withSequence(withTiming(.94, { duration: 70 }), withSpring(1, { damping: 9, stiffness: 260 })));
    plant.value = withDelay(560, withTiming(0, { duration: 380, easing: gravity }));
    sway.value = withDelay(940, withSequence(withTiming(-5, { duration: 90 }), withSpring(0, { damping: 5, stiffness: 140, mass: .8 })));
    return () => [pot, plant, squash, sway, shadow].forEach(cancelAnimation);
  }, [reduce]);
  const potStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pot.value }, { scaleY: squash.value }] }));
  const plantStyle = useAnimatedStyle(() => ({ transform: [{ translateY: plant.value }, { translateY: size * .45 }, { rotate: `${sway.value}deg` }, { translateY: -size * .45 }] }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: shadow.value, transform: [{ scale: .6 + .4 * shadow.value }] }));
  const w = size * .71;
  return <View accessible accessibilityLabel="An aloe settling into its pot" style={{ width: size, height: size * 1.12, alignSelf: 'center', justifyContent: 'flex-end' }}>
    <Animated.View style={[{ position: 'absolute', bottom: 0, alignSelf: 'center' }, shadowStyle]}><GroundShadow width={w * 1.05} /></Animated.View>
    <Animated.Image source={require('../assets/plants/aloe-foliage.png')} resizeMode="contain" style={[{ position: 'absolute', bottom: size * .045, alignSelf: 'center', width: w, height: size }, plantStyle]} />
    <Animated.Image source={require('../assets/plants/aloe-pot.png')} resizeMode="contain" style={[{ position: 'absolute', bottom: size * .045, alignSelf: 'center', width: w, height: size, transformOrigin: 'bottom' }, potStyle]} />
  </View>;
}

const notices: { kind: PlantKind; plant: string; title: string; text: string }[] = [
  { kind: 'aloe', plant: 'Aloe', title: 'Worth a soil check', text: 'Last watered 9 days ago. In your last cycles it was dry around day 10.' },
  { kind: 'peace-lily', plant: 'Peace Lily', title: 'Hold off on water', text: 'You found the soil moist yesterday. Another check tomorrow will tell.' },
  { kind: 'monstera', plant: 'Monstera', title: 'A pattern is forming', text: 'After 3 cycles, the soil was first dry about 6 days after watering.' },
];

function Notification({ index, active, reduce }: { index: number; active: number; reduce: boolean }) {
  const n = notices[index];
  const age = active - index;
  const target = useRef<View>(null);
  const y = useSharedValue(reduce ? 0 : 140);
  const opacity = useSharedValue(reduce ? 1 : 0);
  const scale = useSharedValue(1);
  const shade = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const visible = age >= 0;
    y.value = withTiming(visible ? -Math.min(age, 2) * 62 : 140, { duration: 420, easing: out });
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    scale.value = withTiming(1 - Math.max(0, age) * .045, { duration: 420, easing: out });
    shade.value = withTiming(Math.max(0, age) * .09, { duration: 420 });
  }, [age, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }, { scale: scale.value }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.value }));
  return <Animated.View
    accessibilityElementsHidden={age < 0} importantForAccessibility={age < 0 ? 'no-hide-descendants' : 'auto'}
    style={[reduce ? { marginBottom: 10 } : { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: index }, s.note, style]}
  >
    <View style={s.noteHead}>
      <Image source={require('../assets/plants/sprout.png')} style={{ width: 16, height: 11 }} resizeMode="contain" />
      <Txt v="label" style={{ flex: 1 }}>Rootera · {n.plant}</Txt>
      <Txt v="label">{index === 2 ? 'now' : `${(2 - index) * 2}h ago`}</Txt>
    </View>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <BlurTargetView ref={target}>
          <Txt v="smallStrong" style={{ fontSize: 15 }}>{n.title}</Txt>
          <Txt v="small" style={{ fontSize: 13, lineHeight: 18 }}>{n.text}</Txt>
        </BlurTargetView>
        {!reduce && age > 0 && <BlurView pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={age === 1 ? 6 : 12} tint="light" style={StyleSheet.absoluteFill} />}
      </View>
      <PlantArt kind={n.kind} size={50} />
    </View>
    {!reduce && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.olive, borderRadius: radius.lg }, shadeStyle]} />}
  </Animated.View>;
}

/** Three example nudges. Each new one arrives from below and pushes the older ones up and back. */
export function NotificationStack() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(reduce ? 2 : 0);
  useEffect(() => {
    if (reduce) { setActive(2); return; }
    setActive(0);
    const a = setTimeout(() => setActive(1), 1700);
    const b = setTimeout(() => setActive(2), 3400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [reduce]);
  return <View style={{ height: reduce ? undefined : 250, width: '100%', justifyContent: 'flex-end' }}>
    {notices.map((_, i) => <Notification key={i} index={i} active={active} reduce={reduce} />)}
  </View>;
}

/** One gentle settle when a plant page opens; never loops. */
export function Settle({ children, delay = 120 }: React.PropsWithChildren<{ delay?: number }>) {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  const y = useSharedValue(reduce ? 0 : 10);
  useEffect(() => {
    if (reduce) return;
    y.value = withDelay(delay, withTiming(0, { duration: 380, easing: out }));
    r.value = withDelay(delay + 200, withSequence(withTiming(-2.2, { duration: 160 }), withSpring(0, { damping: 6, stiffness: 120 })));
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ transformOrigin: 'bottom' }, style]}>{children}</Animated.View>;
}

/** Content that fades in once, used for step changes and confirmations. */
export function Reveal({ children, style, delay = 0 }: React.PropsWithChildren<{ style?: any; delay?: number }>) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : FadeIn.duration(260).delay(delay)} style={style}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  note: { backgroundColor: 'rgba(251,252,245,0.97)', borderRadius: radius.lg, borderCurve: 'continuous', padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong, shadowColor: '#2C3320', shadowOpacity: .08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

/* ---------- Richer motion used across the app. All of it respects Reduce Motion. ---------- */

/** List items rise in one after another, once per mount. */
export function Stagger({ index, children, style }: React.PropsWithChildren<{ index: number; style?: any }>) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 8) * 70).springify().damping(16).stiffness(140)} style={style}>{children}</Animated.View>;
}

/** Counts up to a real value (never to an invented one). */
export function CountUp({ value, style }: { value: number; style?: any }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    let frame = 0; const frames = 22; let raf: any;
    const tick = () => { frame++; setShown(Math.round(value * (1 - Math.pow(1 - frame / frames, 3)))); if (frame < frames) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <Txt style={style}>{shown}</Txt>;
}

/** A leader line that draws itself from the label towards the plant. */
export function DrawLine({ x, y, length, vertical, delay, tone, reverse }: { x: number; y: number; length: number; vertical?: boolean; delay: number; tone: string; reverse?: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => { if (!reduce) p.value = withDelay(delay, withTiming(1, { duration: 420, easing: out })); }, [reduce]);
  const style = useAnimatedStyle(() => vertical
    ? { height: length * p.value, top: reverse ? y + length * (1 - p.value) : y }
    : { width: length * p.value, left: reverse ? x + length * (1 - p.value) : x });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', backgroundColor: tone }, vertical ? { left: x, width: 1.5 } : { top: y, height: 1.5 }, style]} />;
}

/** Fades and lifts in after a delay; used for annotation labels. */
export function Appear({ delay = 0, children, style }: React.PropsWithChildren<{ delay?: number; style?: any }>) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : FadeInUp.delay(delay).duration(360)} style={style}>{children}</Animated.View>;
}

/** Pops in with a small overshoot. */
export function Pop({ delay = 0, children, style }: React.PropsWithChildren<{ delay?: number; style?: any }>) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : ZoomIn.delay(delay).springify().damping(11).stiffness(180)} style={style}>{children}</Animated.View>;
}

function Drop({ x, delay, height }: { x: number; delay: number; height: number }) {
  const y = useSharedValue(-40); const o = useSharedValue(0); const s = useSharedValue(1);
  useEffect(() => {
    o.value = withDelay(delay, withSequence(withTiming(1, { duration: 80 }), withDelay(420, withTiming(0, { duration: 160 }))));
    y.value = withDelay(delay, withTiming(height, { duration: 520, easing: gravity }));
    s.value = withDelay(delay + 500, withTiming(1.8, { duration: 160 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scaleX: s.value }, { scaleY: 2 - s.value * .6 }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: 9, height: 13, borderRadius: 6, borderTopLeftRadius: 1, backgroundColor: '#6FB3C6', transform: [{ rotate: '45deg' }] }, style]} />;
}

/** Watering confirmation over the plant: a few drops fall into the pot. */
export function WaterDrops({ width, height, run }: { width: number; height: number; run: number }) {
  const reduce = useReducedMotion();
  if (reduce || !run) return null;
  const xs = [.38, .5, .6, .44, .56].map(f => f * width);
  return <View key={run} pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
    {xs.map((x, i) => <Drop key={i} x={x} delay={i * 110} height={height * (.55 + (i % 2) * .06)} />)}
  </View>;
}

function Leaf({ angle, delay }: { angle: number; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration: 1100, easing: out })); }, []);
  const style = useAnimatedStyle(() => {
    const d = 40 + 130 * p.value;
    return { opacity: p.value < .7 ? 1 : 1 - (p.value - .7) / .3, transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d + 60 * p.value * p.value }, { rotate: `${angle * 57 + 360 * p.value}deg` }, { scale: .6 + .5 * p.value }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: '50%', top: '45%', width: 14, height: 22, marginLeft: -7, borderTopLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: Math.random() > .5 ? color.leaf : '#9ED36A' }, style]} />;
}

/** A one-off burst of leaves for a real milestone (Rootera+ turned on, first pattern). */
export function LeafBurst({ run }: { run: number }) {
  const reduce = useReducedMotion();
  if (reduce || !run) return null;
  return <View key={run} pointerEvents="none" style={StyleSheet.absoluteFill}>
    {Array.from({ length: 16 }, (_, i) => <Leaf key={i} angle={(i / 16) * Math.PI * 2 - Math.PI / 2} delay={(i % 4) * 40} />)}
  </View>;
}

function Blob({ tint, size, from, to, duration }: { tint: string; size: number; from: [number, number]; to: [number, number]; duration: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: from[0] + (to[0] - from[0]) * p.value }, { translateY: from[1] + (to[1] - from[1]) * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: tint, opacity: .75 }, style]} />;
}

/** Slow drifting colour fields behind the onboarding glass. Only on onboarding. */
export function Atmosphere() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Blob tint="#D9F2E6" size={360} from={[-120, -60]} to={[-40, 20]} duration={9000} />
    <Blob tint="#E9F7B8" size={300} from={[160, 380]} to={[90, 300]} duration={11000} />
    <Blob tint="#CFEBDD" size={260} from={[200, 40]} to={[240, 120]} duration={13000} />
    <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
  </View>;
}
