/**
 * The wordmark comes alive. Something inside the first O pulls it upward in a few hard
 * tugs, each one stronger: the O stretches up from its base and resists, while the tip of
 * the sprout pokes out of its top like a thorn. On the last tug the sprout breaks free,
 * shakes, and the O snaps back to its normal shape.
 * `full` is the first-launch version; `short` runs on every later launch (< 1 s).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from './theme';
import { pivot } from './motion';
import { t } from '../i18n';

const LETTERS = require('../../assets/logo/letters.webp');
const O = require('../../assets/logo/o.webp');
const SPROUT = require('../../assets/logo/sprout.webp');
// Measured on the 720 x 215 art: the O spans x 127-225, y 93-182; the sprout sits on its top.
const RATIO = 215 / 720;
const O_X = 176 / 720; // centre of the O
const O_TOP = 93 / 215, O_BOTTOM = 182 / 215;
const STEM_X = 185 / 720;
const STEM_BASE_Y = 95 / 215; // where the sprout meets the O

/** The tugs: how far the O is stretched (scaleY) and how big the thorn shows at each. */
const FULL = [{ stretch: 1.07, thorn: .2 }, { stretch: 1.12, thorn: .3 }, { stretch: 1.18, thorn: .42 }];
const SHORT = [{ stretch: 1.14, thorn: .34 }];

export function LogoSprout({ width = 260, run, variant = 'full', onDone }: { width?: number; run: number; variant?: 'full' | 'short'; onDone?: () => void }) {
  const { reduceMotion } = useTheme();
  const h = width * RATIO;
  const oHeight = (O_BOTTOM - O_TOP) * h;
  const letters = useSharedValue(0);
  const stretch = useSharedValue(1);
  const sprout = useSharedValue(0), shake = useSharedValue(0);

  useEffect(() => {
    if (!run) return;
    if (reduceMotion) { letters.value = 1; stretch.value = 1; sprout.value = 1; onDone?.(); return; }
    letters.value = 0; stretch.value = 1; sprout.value = 0; shake.value = 0;
    letters.value = withTiming(1, { duration: 500 });
    const tugs = variant === 'full' ? FULL : SHORT;
    const beat = variant === 'full' ? 440 : 260;
    // Each tug: a hard pull up (fast, easing out), then the O resists and sinks back part
    // of the way (slower). The thorn comes out with the pull and slips back a little.
    const pull = tugs.flatMap(g => [
      withTiming(g.stretch, { duration: beat * .35, easing: Easing.out(Easing.cubic) }),
      withTiming(1 + (g.stretch - 1) * .4, { duration: beat * .65, easing: Easing.inOut(Easing.quad) }),
    ]);
    const thorn = tugs.flatMap(g => [
      withTiming(g.thorn, { duration: beat * .35, easing: Easing.out(Easing.cubic) }),
      withTiming(g.thorn * .7, { duration: beat * .65, easing: Easing.inOut(Easing.quad) }),
    ]);
    const start = variant === 'full' ? 650 : 120;
    const burst = start + tugs.length * beat;
    // Release: the sprout breaks free and the O snaps back with a wobble.
    stretch.value = withDelay(start, withSequence(...pull, withTiming(1.22, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 6, stiffness: 300 })));
    sprout.value = withDelay(start, withSequence(...thorn, withSpring(1, { damping: 9, stiffness: 200 })));
    shake.value = withDelay(burst + 140, withSequence(withTiming(-12, { duration: 110 }), withTiming(9, { duration: 140 }), withTiming(-5, { duration: 130 }), withSpring(0, { damping: 6, stiffness: 160 })));
    // Finish on a timer: spring callbacks inside sequences are not reliable on every platform.
    const timer = setTimeout(() => onDone?.(), burst + 140 + 800);
    return () => { clearTimeout(timer); [letters, stretch, sprout, shake].forEach(cancelAnimation); };
  }, [run]);

  const lettersStyle = useAnimatedStyle(() => ({ opacity: letters.value, transform: [{ translateY: (1 - letters.value) * 6 }] }));
  // The O stretches upward from its base and gets a little thinner, like something pulled.
  const oStyle = useAnimatedStyle(() => ({
    opacity: letters.value,
    transform: pivot(width, h, O_X, O_BOTTOM, [{ scaleY: stretch.value }, { scaleX: 1 - (stretch.value - 1) * .45 }]),
  }));
  // The sprout rides on the O's top, which rises as the O stretches. Never scale to exactly
  // 0 (a degenerate transform flickers on iOS); it stays hidden until it starts to show.
  const sproutStyle = useAnimatedStyle(() => {
    const s = Math.max(.04, sprout.value);
    return {
      opacity: sprout.value > .04 ? 1 : 0,
      transform: [{ translateY: -oHeight * (stretch.value - 1) }, ...pivot(width, h, STEM_X, STEM_BASE_Y, [{ scaleY: s }, { scaleX: .45 + .55 * s }, { rotate: `${shake.value}deg` }])],
    };
  });

  const layer = { position: 'absolute' as const, width, height: h };
  return <View accessible accessibilityRole="image" accessibilityLabel={t('Rootera')} style={{ width, height: h }}>
    <Animated.Image source={LETTERS} resizeMode="contain" style={[layer, lettersStyle]} />
    <Animated.Image source={SPROUT} resizeMode="contain" style={[layer, sproutStyle]} />
    <Animated.Image source={O} resizeMode="contain" style={[layer, oStyle]} />
  </View>;
}
