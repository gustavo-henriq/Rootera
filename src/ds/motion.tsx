/**
 * Motion primitives. Springs on the UI thread, transform/opacity only, and a
 * Reduce Motion path that shows the final state immediately.
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useTheme } from './theme';
import { springs } from './tokens';

type Step = { translateX: number } | { translateY: number } | { scale: number } | { scaleX: number } | { scaleY: number } | { rotate: string };

/**
 * Scale or rotate a box of w x h about a point given as fractions of its size (0,0 = top
 * left, .5,1 = bottom centre), without `transformOrigin`. The box moves so the point is at
 * its centre, transforms, and moves back: the same result on every platform, without
 * depending on how each native renderer applies transformOrigin to animated images (on the
 * iPhone the logo sprout and growing plants looked wrong). Call it inside useAnimatedStyle.
 */
export function pivot(w: number, h: number, ox: number, oy: number, steps: Step[]): Step[] {
  'worklet';
  const dx = (ox - .5) * w, dy = (oy - .5) * h;
  return [{ translateX: dx }, { translateY: dy }, ...steps, { translateX: -dx }, { translateY: -dy }];
}

/** List items rise in one after another, once per mount. */
export function Stagger({ index, children, style }: React.PropsWithChildren<{ index: number; style?: StyleProp<ViewStyle> }>) {
  const { reduceMotion } = useTheme();
  return <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 55).springify().damping(18).stiffness(160)} style={style}>{children}</Animated.View>;
}

export function Pop({ delay = 0, children, style }: React.PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const { reduceMotion } = useTheme();
  return <Animated.View entering={reduceMotion ? undefined : ZoomIn.delay(delay).springify().damping(12).stiffness(190)} style={style}>{children}</Animated.View>;
}

/** One gentle settle when a plant appears; never loops. */
export function Settle({ children, delay = 100 }: React.PropsWithChildren<{ delay?: number }>) {
  const { reduceMotion } = useTheme();
  const r = useSharedValue(0), y = useSharedValue(reduceMotion ? 0 : 14);
  const box = useSharedValue({ w: 0, h: 0 });
  useEffect(() => {
    if (reduceMotion) return;
    y.value = withDelay(delay, withSpring(0, springs.smooth));
    r.value = withDelay(delay + 180, withSequence(withTiming(-2.4, { duration: 150 }), withSpring(0, springs.bouncy)));
  }, [reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, ...pivot(box.value.w, box.value.h, .5, 1, [{ rotate: `${r.value}deg` }])] }));
  return <Animated.View onLayout={e => { box.value = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }} style={style}>{children}</Animated.View>;
}

function Drop({ x, delay, fall }: { x: number; delay: number; fall: number }) {
  const { c } = useTheme();
  const y = useSharedValue(-30), o = useSharedValue(0), s = useSharedValue(1);
  useEffect(() => {
    o.value = withDelay(delay, withSequence(withTiming(1, { duration: 60 }), withDelay(440, withTiming(0, { duration: 140 }))));
    y.value = withDelay(delay, withTiming(fall, { duration: 500, easing: Easing.bezier(.5, 0, .9, .5) }));
    s.value = withDelay(delay + 480, withTiming(1.8, { duration: 150 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scaleX: s.value }, { scaleY: 2 - s.value * .6 }, { rotate: '45deg' }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: 9, height: 13, borderRadius: 6, borderTopLeftRadius: 1, backgroundColor: c.water, opacity: .8 }, style]} />;
}

/** Watering confirmation over the plant: a few drops fall into the pot. */
export function WaterDrops({ width, height, run }: { width: number; height: number; run: number }) {
  const { reduceMotion } = useTheme();
  if (reduceMotion || !run) return null;
  return <View key={run} pointerEvents="none" style={StyleSheet.absoluteFill}>
    {[.4, .52, .6, .46, .56].map((f, i) => <Drop key={i} x={f * width} delay={i * 110} fall={height * (.55 + (i % 2) * .06)} />)}
  </View>;
}

function Leaf({ angle, delay, tint }: { angle: number; delay: number; tint: string }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })); }, []);
  const style = useAnimatedStyle(() => {
    const d = 40 + 130 * p.value;
    return { opacity: p.value < .7 ? 1 : 1 - (p.value - .7) / .3, transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d + 60 * p.value * p.value }, { rotate: `${angle * 57 + 360 * p.value}deg` }, { scale: .6 + .5 * p.value }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: '50%', top: '45%', width: 14, height: 22, marginLeft: -7, borderTopLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: tint }, style]} />;
}

/** A one-off burst of leaves for a real milestone (Rootera+ on, a first pattern found). */
export function LeafBurst({ run }: { run: number }) {
  const { c, reduceMotion } = useTheme();
  if (reduceMotion || !run) return null;
  return <View key={run} pointerEvents="none" style={StyleSheet.absoluteFill}>
    {Array.from({ length: 16 }, (_, i) => <Leaf key={i} angle={(i / 16) * Math.PI * 2 - Math.PI / 2} delay={(i % 4) * 40} tint={i % 2 ? c.leaf : c.leafMark} />)}
  </View>;
}
