/**
 * The wordmark comes alive: the sprout pushes the first O up a few times, as if
 * trying to break through, then bursts out and shakes while the O springs back.
 * `full` is the first-launch version; `short` runs on every later launch (< 1 s).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from './theme';

const LETTERS = require('../../assets/logo/letters.png');
const O = require('../../assets/logo/o.png');
const SPROUT = require('../../assets/logo/sprout.png');
const RATIO = 215 / 720;
const STEM_BASE_Y = 95 / 215; // where the sprout meets the O
const STEM_X = 185 / 720;

export function LogoSprout({ width = 260, run, variant = 'full', onDone }: { width?: number; run: number; variant?: 'full' | 'short'; onDone?: () => void }) {
  const { reduceMotion } = useTheme();
  const h = width * RATIO;
  const letters = useSharedValue(0);
  const oY = useSharedValue(0), oSquash = useSharedValue(1);
  const sprout = useSharedValue(0), shake = useSharedValue(0);

  useEffect(() => {
    if (!run) return;
    if (reduceMotion) { letters.value = 1; sprout.value = 1; onDone?.(); return; }
    letters.value = 0; sprout.value = 0; shake.value = 0; oY.value = 0; oSquash.value = 1;
    letters.value = withTiming(1, { duration: 260 });
    // Each push lifts the O a little higher and squashes it, then it settles back.
    const pushes = variant === 'full' ? [-5, -8, -12] : [-9];
    const beat = variant === 'full' ? 230 : 170;
    const lift = pushes.flatMap(p => [withTiming(p, { duration: beat * .45 }), withTiming(p * .25, { duration: beat * .55 })]);
    const squash = pushes.flatMap(() => [withTiming(.9, { duration: beat * .45 }), withTiming(1, { duration: beat * .55 })]);
    const start = variant === 'full' ? 320 : 120;
    oY.value = withDelay(start, withSequence(...lift, withSpring(0, { damping: 7, stiffness: 260 })));
    oSquash.value = withDelay(start, withSequence(...squash, withSpring(1, { damping: 7, stiffness: 260 })));
    const burst = start + pushes.length * beat;
    sprout.value = withDelay(burst, withSpring(1, { damping: 8, stiffness: 190 }));
    shake.value = withDelay(burst + 120, withSequence(withTiming(-14, { duration: 80 }), withTiming(10, { duration: 100 }), withTiming(-6, { duration: 90 }), withSpring(0, { damping: 5, stiffness: 200 })));
    // Finish on a timer: spring callbacks inside sequences are not reliable on every platform.
    const t = setTimeout(() => onDone?.(), burst + 120 + 520);
    return () => { clearTimeout(t); [letters, oY, oSquash, sprout, shake].forEach(cancelAnimation); };
  }, [run]);

  const lettersStyle = useAnimatedStyle(() => ({ opacity: letters.value, transform: [{ translateY: (1 - letters.value) * 6 }] }));
  const oStyle = useAnimatedStyle(() => ({ opacity: letters.value, transform: [{ translateY: oY.value }, { scaleY: oSquash.value }, { scaleX: 2 - oSquash.value }] }));
  // The sprout rides on top of the O, so it rises with every push before it breaks out.
  const sproutStyle = useAnimatedStyle(() => ({ transform: [{ translateY: oY.value }, { scaleY: sprout.value }, { scaleX: .5 + .5 * sprout.value }, { rotate: `${shake.value}deg` }] }));

  const layer = { position: 'absolute' as const, width, height: h };
  return <View accessible accessibilityRole="image" accessibilityLabel="Rootera" style={{ width, height: h }}>
    <Animated.Image source={LETTERS} resizeMode="contain" style={[layer, lettersStyle]} />
    <Animated.Image source={SPROUT} resizeMode="contain" style={[layer, { transformOrigin: `${STEM_X * 100}% ${STEM_BASE_Y * 100}%` }, sproutStyle]} />
    <Animated.Image source={O} resizeMode="contain" style={[layer, { transformOrigin: `${STEM_X * 100}% ${STEM_BASE_Y * 100 + 50 * (1 - STEM_BASE_Y)}%` }, oStyle]} />
  </View>;
}
