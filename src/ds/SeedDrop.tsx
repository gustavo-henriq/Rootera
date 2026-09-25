/**
 * The Rootera "something new starts growing" moment. A seed arrives from the side,
 * turns 90 degrees as it falls into the pot, soil puffs, then a sprout pushes up
 * out of the soil and settles. Reused wherever a plant begins: the opening splash,
 * registering a plant, and (later) a plant reaching a new stage.
 * Pass `kind` to have the sprout grow into that species' illustration.
 */
import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { PlantKind } from '../model';
import { plantArt } from './plant';
import { useTheme } from './theme';
import { springs } from './tokens';

const POT = require('../../assets/plants/aloe-pot.png');
const SPROUT = require('../../assets/plants/sprout-grow.png');
const RATIO = 406 / 560; // pot canvas
const SOIL = 368 / 560; // soil line inside the canvas

/** Timeline in ms, exported so screens can sync text and sound to the impact. */
export const SEED_TIMING = { flight: 1250, impact: 1250, sprout: 1500, settled: 2600, bloom: 3000, done: 3700 };

function Speck({ dx, delay, run, colour }: { dx: number; delay: number; run: number; colour: string }) {
  const p = useSharedValue(0);
  useEffect(() => { if (run) p.value = withDelay(delay, withSequence(withTiming(0, { duration: 1 }), withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }))); }, [run]);
  const style = useAnimatedStyle(() => ({ opacity: p.value > 0 && p.value < 1 ? 1 - p.value : 0, transform: [{ translateX: dx * p.value }, { translateY: -30 * p.value + 38 * p.value * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colour }, style]} />;
}

export function SeedDrop({ size = 240, run, kind, onImpact, onDone, from = 'left' }: { size?: number; run: number; kind?: PlantKind; onImpact?: () => void; onDone?: () => void; from?: 'left' | 'right' }) {
  const { c, reduceMotion } = useTheme();
  const w = size * RATIO;
  const soilY = size * SOIL;
  const side = from === 'left' ? -1 : 1;
  const x = useSharedValue(side * size * 1.1), y = useSharedValue(soilY - size * .95);
  const spin = useSharedValue(0), seedS = useSharedValue(1), seedO = useSharedValue(0);
  const potS = useSharedValue(1);
  const sprout = useSharedValue(0), sway = useSharedValue(0), bloom = useSharedValue(0);

  useEffect(() => {
    if (!run) return;
    const t = SEED_TIMING;
    if (reduceMotion) {
      seedO.value = 0; sprout.value = kind ? 0 : 1; bloom.value = kind ? 1 : 0;
      onImpact?.(); onDone?.();
      return;
    }
    x.value = side * size * 1.1; y.value = soilY - size * .95; spin.value = 0; seedS.value = 1; seedO.value = 1;
    sprout.value = 0; sway.value = 0; bloom.value = 0; potS.value = 1;
    // Horizontal motion decelerates while the fall accelerates: the path starts level
    // and bends 90 degrees downward into the pot, like a seed tossed from the side.
    x.value = withTiming(0, { duration: t.flight, easing: Easing.out(Easing.cubic) });
    y.value = withTiming(soilY - 8, { duration: t.flight, easing: Easing.in(Easing.cubic) });
    spin.value = withTiming(side * -300, { duration: t.flight, easing: Easing.out(Easing.quad) });
    seedS.value = withDelay(t.impact, withTiming(0, { duration: 180 }));
    potS.value = withDelay(t.impact, withSequence(withTiming(.94, { duration: 80 }), withSpring(1, springs.bouncy)));
    // The sprout pushes out slowly, overshoots a little and sways once as it settles.
    sprout.value = withDelay(t.sprout, withSpring(1, { damping: 14, stiffness: 70, mass: 1.1 }));
    sway.value = withDelay(t.sprout + 500, withSequence(withTiming(-5, { duration: 420, easing: Easing.inOut(Easing.sin) }), withTiming(3, { duration: 460, easing: Easing.inOut(Easing.sin) }), withSpring(0, { damping: 12, stiffness: 60 })));
    if (kind) bloom.value = withDelay(t.bloom, withSpring(1, springs.smooth));
    const impact = setTimeout(() => onImpact?.(), t.impact);
    const done = setTimeout(() => onDone?.(), kind ? t.done : t.settled + 400);
    return () => { clearTimeout(impact); clearTimeout(done); [x, y, spin, seedS, seedO, potS, sprout, sway, bloom].forEach(cancelAnimation); };
  }, [run]);

  const seedStyle = useAnimatedStyle(() => ({ opacity: seedO.value * seedS.value, transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${spin.value}deg` }, { scale: seedS.value }] }));
  const potStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value, transform: [{ scaleY: potS.value }, { scaleX: 2 - potS.value }] }));
  const sproutStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value, transform: [{ scaleY: sprout.value }, { scaleX: .55 + .45 * sprout.value }, { rotate: `${sway.value}deg` }] }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ translateY: (1 - bloom.value) * 10 }, { scale: .9 + .1 * bloom.value }] }));

  return <View style={{ width: w, height: size }} accessible accessibilityLabel={kind ? 'A seed lands in the pot and your plant grows' : 'A seed lands in a pot and sprouts'}>
    <View style={{ position: 'absolute', bottom: -size * .03, left: w * .12, right: w * .12, height: size * .06, borderRadius: size, backgroundColor: c.hairline }} />
    {kind && <Animated.View style={[{ position: 'absolute', left: -w * .2, right: -w * .2, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'bottom' }, bloomStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" style={{ width: size * 1.02, height: size * 1.02 }} />
    </Animated.View>}
    <Animated.Image source={POT} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size, transformOrigin: 'bottom' }, potStyle]} />
    {/* Drawn in front of the pot: the stem grows out of the soil, never behind the rim. */}
    <Animated.Image source={SPROUT} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size, transformOrigin: `50% ${SOIL * 100}%` }, sproutStyle]} />
    <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 3, top: soilY - 6 }}>
      {[-46, -24, 20, 40, -8].map((dx, i) => <Speck key={i} dx={dx} delay={SEED_TIMING.impact + i * 22} run={run} colour={c.soil[2 + (i % 2)]} />)}
    </View>
    <Animated.View style={[{ position: 'absolute', left: w / 2 - 8, top: 0, width: 16, height: 22, borderRadius: 11, backgroundColor: c.soil[2] }, seedStyle]} />
  </View>;
}
