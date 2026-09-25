/**
 * How Rootera learns, told as a plant growing. The seed sprouts on its own; then
 * each source appears as a glowing button. Tapping it reveals what that source adds
 * and grows the plant one stage, until it blooms into "Rootera suggests".
 * The explanation under each button starts blurred: a preview of what the tap gives,
 * while screen readers get the full sentence straight away.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { plantArt } from '../../ds/plant';
import { useTheme } from '../../ds/theme';
import { fonts, radius, space } from '../../ds/tokens';
import { SourceMark, T, Tap } from '../../ds/components';
import { Glyph } from '../../ds/icons';

const POT = require('../../../assets/plants/aloe-pot.png');
const SPROUT = require('../../../assets/plants/sprout-grow.png');
const RATIO = 406 / 560;
const SOIL = 368 / 560;

/**
 * Final art, one image per stage (seed, sprout, young plant, bud, bloom), all on the
 * same canvas so they can cross-fade. While it is empty the placeholder below is used:
 * the pot, a sprout growing in steps, then a peace lily in flower.
 */
export const flowerStages: number[] = [
  require('../../../assets/flower/1-seed.png'),
  require('../../../assets/flower/2-sprout.png'),
  require('../../../assets/flower/3-leaves.png'),
  require('../../../assets/flower/4-bud.png'),
  require('../../../assets/flower/5-bloom.png'),
];
const PLACEHOLDER_SPROUT = [0, .42, .72, 1];

const SOURCES = [
  { key: 'observed' as const, title: 'You observe', text: 'A soil check, a watering, how the leaves look. Kept exactly as you describe it.' },
  { key: 'told' as const, title: 'You tell us', text: 'Its light, its pot, where it lives. Optional, and you can change it later.' },
  { key: 'species' as const, title: 'Species notes', text: 'What the species usually likes. A starting point, never a rule for your plant.' },
];
const LAST = SOURCES.length + 1; // seed, sprout, one stage per source

/* ------------------------------------------------------------------ the plant */

function StageImage({ src, on, size }: { src: number; on: boolean; size: number }) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? 420 : 300 }); }, [on]);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: .94 + .06 * p.value }] }));
  return <Animated.Image source={src} resizeMode="contain" style={[{ position: 'absolute', width: size, height: size, transformOrigin: 'bottom' }, style]} />;
}

function Flower({ stage, size }: { stage: number; size: number }) {
  const { c, reduceMotion } = useTheme();
  const w = size * RATIO;
  const sprout = useSharedValue(0), bloom = useSharedValue(0), seed = useSharedValue(1), sway = useSharedValue(0);

  useEffect(() => {
    if (flowerStages.length) return;
    const s = PLACEHOLDER_SPROUT[Math.min(stage, PLACEHOLDER_SPROUT.length - 1)];
    const b = stage >= LAST ? 1 : 0;
    if (reduceMotion) { sprout.value = s; bloom.value = b; seed.value = stage ? 0 : 1; return; }
    seed.value = withTiming(stage ? 0 : 1, { duration: 200 });
    // Each stage is a quick push up with a little overshoot: it answers the tap in well under a second.
    sprout.value = withSpring(s, { damping: 11, stiffness: 140, mass: .8 });
    bloom.value = withTiming(b, { duration: 600, easing: Easing.out(Easing.cubic) });
    if (stage) sway.value = withSequence(withTiming(-4, { duration: 220 }), withTiming(2, { duration: 240 }), withSpring(0, { damping: 10, stiffness: 90 }));
  }, [stage]);

  const sproutStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value, transform: [{ scaleY: sprout.value }, { scaleX: .5 + .5 * sprout.value }, { rotate: `${sway.value}deg` }] }));
  const potStyle = useAnimatedStyle(() => ({ opacity: 1 - bloom.value }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: .9 + .1 * bloom.value }] }));
  const seedStyle = useAnimatedStyle(() => ({ opacity: seed.value, transform: [{ scale: .6 + .4 * seed.value }] }));

  const label = ['A seed in a pot', 'A sprout', 'A young plant', 'A growing plant', 'The plant in flower'][Math.min(stage, 4)];
  return <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center' }}>
    {!flowerStages.length && <View style={{ position: 'absolute', bottom: -size * .02, width: w * .76, height: size * .05, borderRadius: size, backgroundColor: c.hairline }} />}
    {flowerStages.length
      ? flowerStages.map((src, i) => <StageImage key={i} src={src} on={i === Math.min(stage, flowerStages.length - 1)} size={size} />)
      : <>
          <Animated.View style={[{ position: 'absolute', width: size * 1.02, height: size * 1.02, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'bottom' }, bloomStyle]}>
            <Image source={plantArt['peace-lily']} resizeMode="contain" style={{ width: size * 1.02, height: size * 1.02 }} />
          </Animated.View>
          <Animated.Image source={POT} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size }, potStyle]} />
          <Animated.Image source={SPROUT} resizeMode="contain" style={[{ position: 'absolute', width: w, height: size, transformOrigin: `50% ${SOIL * 100}%` }, sproutStyle]} />
          <Animated.View style={[{ position: 'absolute', top: size * SOIL - 12, width: 12, height: 16, borderRadius: 8, backgroundColor: c.soil[2] }, seedStyle]} />
        </>}
  </View>;
}

/* ------------------------------------------------------------------ one source */

function Glow({ on }: { on: boolean }) {
  const { c, reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!on) { p.value = withTiming(0, { duration: 200 }); return; }
    if (reduceMotion) { p.value = .6; return; }
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [on, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: .14 + .26 * p.value, transform: [{ scale: 1 + .05 * p.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -6, bottom: -6, left: -6, right: -6, borderRadius: radius.control + 6, backgroundColor: c.leafMark }, style]} />;
}

/** The explanation, blurred until its source is tapped. */
function Explanation({ text, clear }: { text: string; clear: boolean }) {
  const { scheme, reduceTransparency, reduceMotion } = useTheme();
  const veil = useSharedValue(clear ? 0 : 1);
  useEffect(() => { veil.value = reduceMotion ? (clear ? 0 : 1) : withTiming(clear ? 0 : 1, { duration: 450, easing: Easing.out(Easing.cubic) }); }, [clear]);
  const textStyle = useAnimatedStyle(() => ({ opacity: reduceTransparency ? 1 - .82 * veil.value : 1 }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  return <View style={{ flex: 1 }}>
    <Animated.View style={textStyle}><T v="body" tone={clear ? 'ink' : 'ink2'}>{text}</T></Animated.View>
    {!reduceTransparency && <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, { margin: -4 }, veilStyle]}>
      <BlurView intensity={28} tint={scheme === 'dark' ? 'dark' : 'light'} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
    </Animated.View>}
  </View>;
}

/** A connector from a source to the plant, drawn when that source is tapped. */
function Line({ on, from, to }: { on: boolean; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const { c, reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => { p.value = reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 380, easing: Easing.out(Easing.cubic) }); }, [on]);
  const vertical = from.x === to.x;
  const len = vertical ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  const style = useAnimatedStyle(() => vertical ? { transform: [{ scaleY: p.value }] } : { transform: [{ scaleX: p.value }] });
  const box = vertical
    ? { left: from.x - .75, top: Math.min(from.y, to.y), width: 1.5, height: len, transformOrigin: from.y > to.y ? 'bottom' : 'top' }
    : { top: from.y - .75, left: Math.min(from.x, to.x), height: 1.5, width: len, transformOrigin: from.x < to.x ? 'left' : 'right' };
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', backgroundColor: c.ink2 }, box as any, style]} />;
}

function Node({ source, state, onPress }: { source: typeof SOURCES[number]; state: 'waiting' | 'done'; onPress: () => void }) {
  const { c } = useTheme();
  const waiting = state === 'waiting';
  return <Animated.View entering={FadeIn.duration(360)}>
    <Glow on={waiting} />
    <Tap label={waiting ? `${source.title}. Tap to see what it adds.` : `${source.title}. ${source.text}`} onPress={waiting ? onPress : undefined} ring={radius.control}
      style={{ minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.control, borderWidth: 1, borderColor: c.ink, backgroundColor: c.raised, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SourceMark kind={source.key} />
      <T v="subhead" style={{ fontFamily: fonts.medium, flex: 1 }}>{source.title}</T>
    </Tap>
  </Animated.View>;
}

/* ------------------------------------------------------------------ the story */

export function Story({ width, start, onComplete }: { width: number; start: number; onComplete: () => void }) {
  const { c, reduceMotion } = useTheme();
  const [stage, setStage] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, reduceMotion ? 0 : ms)); };
  const dim = useSharedValue(1);
  const waiting = shown > done;
  useEffect(() => { dim.value = withTiming(waiting ? .55 : 1, { duration: 320 }); }, [waiting]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  useEffect(() => {
    // After the title has arrived, the seed sprouts by itself, then the first source appears.
    later(() => setStage(1), start);
    later(() => setShown(1), start + 700);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const tap = (i: number) => {
    if (i !== done) return;
    const next = done + 1;
    setDone(next);
    setStage(next + 1);
    if (next < SOURCES.length) later(() => setShown(next + 1), 650);
    else later(onComplete, 900);
  };

  // Same diagram as before: two sources above the plant, species notes below it.
  const nodeW = 116, H = 320, size = 170;
  const plantTop = 44, plantBottom = plantTop + size;
  const pos = [{ x: 0, y: 30 }, { x: width - nodeW, y: 30 }, { x: (width - nodeW) / 2, y: H - 48 }];
  const lines = [
    { from: { x: nodeW, y: 52 }, to: { x: width / 2 - size * .12, y: 52 } },
    { from: { x: width - nodeW, y: 52 }, to: { x: width / 2 + size * .12, y: 52 } },
    { from: { x: width / 2, y: H - 48 }, to: { x: width / 2, y: plantBottom } },
  ];
  const bloomed = done >= SOURCES.length;
  // The line under the diagram follows the taps: a blurred preview while a source waits, then its sentence.
  const focus = waiting ? shown - 1 : Math.max(0, done - 1);
  return <View style={{ gap: space[4] }}>
    <View style={{ width, height: H }}>
      <Animated.View style={[{ position: 'absolute', left: (width - size) / 2, top: plantTop }, dimStyle]}><Flower stage={stage} size={size} /></Animated.View>
      {bloomed && <Animated.View entering={FadeIn.delay(450).duration(420)} style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: c.successSoft }}>
          <SourceMark kind="suggested" /><T v="caption" tone="leafText">Rootera suggests</T>
        </View>
      </Animated.View>}
      {SOURCES.map((s, i) => <Line key={'l' + s.key} on={i < done} {...lines[i]} />)}
      {SOURCES.slice(0, shown).map((s, i) => <View key={s.key} style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, width: nodeW }}>
        <Node source={s} state={i < done ? 'done' : 'waiting'} onPress={() => tap(i)} />
      </View>)}
    </View>
    <View style={{ minHeight: 96, gap: space[2] }}>
      {shown > 0 && <Explanation key={focus} text={SOURCES[focus].text} clear={!waiting} />}
      {bloomed && <Animated.View entering={FadeInDown.delay(450).duration(420)}>
        <T v="subhead" tone="ink2">Every suggestion shows which of these it came from.</T>
      </Animated.View>}
    </View>
  </View>;
}
