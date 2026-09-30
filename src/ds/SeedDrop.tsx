/**
 * The Rootera "something new starts growing" moment. A seed arrives from the side,
 * turns as it falls into the pot, soil puffs, the seed settles into the soil and a
 * sprout comes up. Reused wherever a plant begins: the opening, registering a plant,
 * and (later) a plant reaching a new stage. Pass `kind` to grow into that species.
 *
 * Every layer is a full frame on the same canvas and changes by cross-fade. Nothing
 * is scaled from zero: on iOS a zero scale is a degenerate transform and the layer
 * flickers or vanishes for a few frames.
 */
import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { PlantKind } from '../model';
import { plantArt } from './plant';
import { useTheme } from './theme';
import { springs } from './tokens';
import { pivot } from './motion';
import { t } from '../i18n';

const EMPTY = require('../../assets/flower/0-empty.webp');
const SEEDED = require('../../assets/flower/1-seed.webp');
const SPROUTED = require('../../assets/flower/2-sprout.webp');
const SEED = require('../../assets/flower/seed-sprite.webp');
const RATIO = 994 / 1130; // frame canvas
export const SEED_RATIO = RATIO;
/** Where the soil surface sits in the frame, as a fraction of its height. */
export const SEED_SOIL = 555 / 1130;
export const SEED_AT = { x: .497, y: .498 }; // the seed's resting place in the seeded frame
const SEED_W = 97 / 994;

/** Timeline in ms, exported so screens can sync text and sound to the impact. */
export const SEED_TIMING = { flight: 1250, impact: 1250, sprout: 1700, settled: 2600, bloom: 3000, done: 3700 };

function Speck({ dx, delay, run, colour }: { dx: number; delay: number; run: number; colour: string }) {
  const p = useSharedValue(0);
  useEffect(() => { if (run) p.value = withDelay(delay, withSequence(withTiming(0, { duration: 1 }), withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }))); }, [run]);
  const style = useAnimatedStyle(() => ({ opacity: p.value > 0 && p.value < 1 ? 1 - p.value : 0, transform: [{ translateX: dx * p.value }, { translateY: -30 * p.value + 38 * p.value * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colour }, style]} />;
}

export function SeedDrop({ size = 240, run, kind, skip, onImpact, onDone, from = 'left' }: { size?: number; run: number; kind?: PlantKind; skip?: boolean; onImpact?: () => void; onDone?: () => void; from?: 'left' | 'right' }) {
  const { c, reduceMotion } = useTheme();
  const w = size * RATIO;
  const seedW = w * SEED_W, seedH = seedW * 62 / 97;
  const restX = w * SEED_AT.x - seedW / 2, restY = size * SEED_AT.y - seedH / 2;
  const side = from === 'left' ? -1 : 1;
  const x = useSharedValue(side * size * 1.1), y = useSharedValue(-size * .45);
  const spin = useSharedValue(0), seedO = useSharedValue(0);
  const pot = useSharedValue(1);
  const seeded = useSharedValue(0), sprouted = useSharedValue(0), push = useSharedValue(1), bloom = useSharedValue(0);
  // Impact and done are reported once each, whether the animation plays out or a tap skips it.
  const impacted = useRef(false), finished = useRef(false);
  const impact = () => { if (!impacted.current) { impacted.current = true; onImpact?.(); } };
  const finish = () => { if (!finished.current) { finished.current = true; onDone?.(); } };

  useEffect(() => {
    if (!skip) return;
    [x, y, spin, seedO, pot, seeded, sprouted, push, bloom].forEach(cancelAnimation);
    x.value = 0; y.value = 0; seedO.value = 0; pot.value = 1; push.value = 1;
    seeded.value = 1; sprouted.value = kind ? 0 : 1; bloom.value = kind ? 1 : 0;
    impact(); finish();
  }, [skip]);

  useEffect(() => {
    if (!run || skip) return;
    const t = SEED_TIMING;
    if (reduceMotion) {
      seedO.value = 0; seeded.value = 1; sprouted.value = kind ? 0 : 1; bloom.value = kind ? 1 : 0;
      impact(); finish();
      return;
    }
    x.value = side * size * 1.1; y.value = -size * .45; spin.value = side * 300; seedO.value = 1;
    seeded.value = 0; sprouted.value = 0; bloom.value = 0; pot.value = 1; push.value = 1;
    // Horizontal motion decelerates while the fall accelerates: the path starts level
    // and bends 90 degrees downward into the pot, like a seed tossed from the side.
    x.value = withTiming(0, { duration: t.flight, easing: Easing.out(Easing.cubic) });
    y.value = withTiming(0, { duration: t.flight, easing: Easing.in(Easing.cubic) });
    spin.value = withTiming(-12, { duration: t.flight, easing: Easing.out(Easing.quad) });
    // The flying seed hands over to the one drawn in the soil.
    seedO.value = withDelay(t.impact, withTiming(0, { duration: 160 }));
    seeded.value = withDelay(t.impact, withTiming(1, { duration: 160 }));
    pot.value = withDelay(t.impact, withSequence(withTiming(.95, { duration: 80 }), withSpring(1, springs.bouncy)));
    // The sprout arrives as a cross-fade with a small push from the soil line.
    sprouted.value = withDelay(t.sprout, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    push.value = withDelay(t.sprout, withSequence(withTiming(.94, { duration: 1 }), withSpring(1, { damping: 9, stiffness: 120 })));
    if (kind) bloom.value = withDelay(t.bloom, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    const impactTimer = setTimeout(impact, t.impact);
    const doneTimer = setTimeout(finish, kind ? t.done : t.settled + 400);
    return () => { clearTimeout(impactTimer); clearTimeout(doneTimer); [x, y, spin, seedO, pot, seeded, sprouted, push, bloom].forEach(cancelAnimation); };
  }, [run]);

  const seedStyle = useAnimatedStyle(() => ({ opacity: seedO.value, transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${spin.value}deg` }] }));
  const potStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value, transform: pivot(w, size, .5, 1, [{ scaleY: pot.value }, { scaleX: 2 - pot.value }]) }));
  const seededStyle = useAnimatedStyle(() => ({ opacity: seeded.value * (1 - sprouted.value) }));
  const sproutStyle = useAnimatedStyle(() => ({ opacity: sprouted.value, transform: pivot(w, size, .5, SEED_SOIL, [{ scaleY: push.value }]) }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ translateY: (1 - bloom.value) * 10 }, { scale: .92 + .08 * bloom.value }] }));

  const frame = { position: 'absolute' as const, width: w, height: size };
  return <View style={{ width: w, height: size }} accessible accessibilityLabel={kind ? t('A seed lands in the pot and your plant grows') : t('A seed lands in a pot and sprouts')}>
    {kind && <Animated.View style={[{ position: 'absolute', left: -w * .1, right: -w * .1, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' }, bloomStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" style={{ width: size * 1.02, height: size * 1.02 }} />
    </Animated.View>}
    <Animated.View style={[frame, potStyle]}>
      <Image source={EMPTY} resizeMode="contain" style={frame} />
      <Animated.Image source={SEEDED} resizeMode="contain" style={[frame, seededStyle]} />
      <Animated.Image source={SPROUTED} resizeMode="contain" style={[frame, sproutStyle]} />
    </Animated.View>
    <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 3, top: size * SEED_SOIL - 4 }}>
      {[-46, -24, 20, 40, -8].map((dx, i) => <Speck key={i} dx={dx} delay={SEED_TIMING.impact + i * 22} run={run} colour={c.soil[2 + (i % 2)]} />)}
    </View>
    <Animated.Image source={SEED} resizeMode="contain" style={[{ position: 'absolute', left: restX, top: restY, width: seedW, height: seedH }, seedStyle]} />
  </View>;
}
