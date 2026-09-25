/**
 * The Rootera "something new starts growing" moment: a seed falls into a pot, soil
 * puffs, a sprout pushes up and shakes. Reused wherever a plant begins: the opening
 * splash, registering a plant, and (later) a plant reaching a new stage.
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
const gravity = Easing.bezier(.5, 0, .9, .5);

function Speck({ dx, delay, run, colour }: { dx: number; delay: number; run: number; colour: string }) {
  const p = useSharedValue(0);
  useEffect(() => { if (run) p.value = withDelay(delay, withSequence(withTiming(0, { duration: 1 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }))); }, [run]);
  const style = useAnimatedStyle(() => ({ opacity: p.value > 0 && p.value < 1 ? 1 - p.value : 0, transform: [{ translateX: dx * p.value }, { translateY: -34 * p.value + 40 * p.value * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colour }, style]} />;
}

export function SeedDrop({ size = 240, run, kind, onImpact, onDone }: { size?: number; run: number; kind?: PlantKind; onImpact?: () => void; onDone?: () => void }) {
  const { c, reduceMotion } = useTheme();
  // Nothing falls until the pot is on screen, or the seed would land in thin air.
  const [potReady, setPotReady] = React.useState(false);
  const go = potReady ? run : 0;
  const w = size * RATIO;
  const soilY = size * SOIL;
  const seedY = useSharedValue(-size), seedS = useSharedValue(1), seedO = useSharedValue(0);
  const potS = useSharedValue(1);
  const sprout = useSharedValue(0), shake = useSharedValue(0), bloom = useSharedValue(0);

  useEffect(() => {
    if (!go) return;
    if (reduceMotion) {
      seedO.value = 0; sprout.value = kind ? 0 : 1; bloom.value = kind ? 1 : 0;
      onImpact?.(); onDone?.();
      return;
    }
    seedY.value = -size; seedS.value = 1; seedO.value = 1; sprout.value = 0; shake.value = 0; bloom.value = 0; potS.value = 1;
    const fall = 560;
    seedY.value = withTiming(soilY - 10, { duration: fall, easing: gravity });
    const impact = setTimeout(() => onImpact?.(), fall);
    seedS.value = withDelay(fall, withTiming(0, { duration: 140 }));
    potS.value = withDelay(fall, withSequence(withTiming(.93, { duration: 70 }), withSpring(1, springs.bouncy)));
    sprout.value = withDelay(fall + 160, withSpring(1, { damping: 9, stiffness: 150 }));
    shake.value = withDelay(fall + 560, withSequence(withTiming(-9, { duration: 90 }), withTiming(7, { duration: 110 }), withSpring(0, { damping: 5, stiffness: 180 })));
    if (kind) bloom.value = withDelay(fall + 1250, withSpring(1, springs.smooth));
    const t = setTimeout(() => onDone?.(), fall + (kind ? 1900 : 1300));
    return () => { clearTimeout(t); clearTimeout(impact); [seedY, seedS, seedO, potS, sprout, shake, bloom].forEach(cancelAnimation); };
  }, [go]);

  const seedStyle = useAnimatedStyle(() => ({ opacity: seedO.value, transform: [{ translateY: seedY.value }, { scale: seedS.value }] }));
  const potStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: potS.value }, { scaleX: 2 - potS.value }] }));
  const sproutStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value, transform: [{ scaleY: sprout.value }, { scaleX: .6 + .4 * sprout.value }, { rotate: `${shake.value}deg` }] }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: .85 + .15 * bloom.value }] }));

  return <View style={{ width: w, height: size }} accessible accessibilityLabel={kind ? 'A seed lands in the pot and your plant grows' : 'A seed lands in a pot and sprouts'}>
    <View style={{ position: 'absolute', bottom: -size * .03, left: w * .12, right: w * .12, height: size * .06, borderRadius: size, backgroundColor: c.hairline }} />
    <Animated.Image source={SPROUT} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size, transformOrigin: `50% ${SOIL * 100}%` }, sproutStyle]} />
    {kind && <Animated.View style={[{ position: 'absolute', left: -w * .2, right: -w * .2, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'bottom' }, bloomStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" style={{ width: size * 1.02, height: size * 1.02 }} />
    </Animated.View>}
    <Animated.Image source={POT} onLoad={() => setPotReady(true)} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size, transformOrigin: 'bottom' }, potStyle]} />
    <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 3, top: soilY - 6 }}>
      {[-46, -24, 20, 40, -8].map((dx, i) => <Speck key={i} dx={dx} delay={560 + i * 18} run={go} colour={c.soil[2 + (i % 2)]} />)}
    </View>
    <Animated.View style={[{ position: 'absolute', left: w / 2 - 9, top: 0, width: 18, height: 24, borderRadius: 12, backgroundColor: c.soil[2] }, seedStyle]} />
  </View>;
}
