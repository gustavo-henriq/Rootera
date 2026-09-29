/**
 * How Rootera learns, told as a plant growing. The seed sprouts on its own; then each
 * source appears as a glowing button around the plant. Tapping it draws its line to
 * the plant, grows the plant one stage and shows what that source adds underneath.
 * Tapping an earlier source brings its explanation back. After the third, the plant
 * blooms into "Rootera suggests".
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useCompact, useTheme } from '../../ds/theme';
import { fonts, radius, space } from '../../ds/tokens';
import { SourceMark, T, Tap } from '../../ds/components';
import { Ground } from '../../ds/plant';
import { t } from '../../i18n';
import { pivot } from '../../ds/motion';

/** One image per stage (seed, sprout, young plant, bud, bloom), all on the same canvas. */
export const flowerStages: number[] = [
  require('../../../assets/flower/1-seed.webp'),
  require('../../../assets/flower/2-sprout.webp'),
  require('../../../assets/flower/3-leaves.webp'),
  require('../../../assets/flower/4-bud.webp'),
  require('../../../assets/flower/5-bloom.webp'),
];
const RATIO = 994 / 1130;

const SOURCES = [
  { key: 'observed' as const, title: 'You observe', text: 'A soil check, a watering, how the leaves look. Kept exactly as you describe it.' },
  { key: 'told' as const, title: 'You tell us', text: 'Its light, its pot, where it lives. Optional, and you can change it later.' },
  { key: 'species' as const, title: 'Species notes', text: 'What the species usually likes. A starting point, never a rule for your plant.' },
];

/* ------------------------------------------------------------------ the plant */

function StageImage({ src, on, w, h }: { src: number; on: boolean; w: number; h: number }) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? 420 : 320 }); }, [on]);
  // Cross-fade with a small rise; no scale from zero (it flickers on iOS).
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: pivot(w, h, .5, 1, [{ scale: .96 + .04 * p.value }]) }));
  return <Animated.Image source={src} resizeMode="contain" style={[{ position: 'absolute', width: w, height: h }, style]} />;
}

function Flower({ stage, size }: { stage: number; size: number }) {
  const w = size * RATIO;
  const label = ['A seed in a pot', 'A sprout', 'A young plant', 'A plant with a bud', 'The plant in flower'][Math.min(stage, 4)];
  return <View accessible accessibilityRole="image" accessibilityLabel={t(label)} style={{ width: w, height: size }}>
    {/* The contact shadow is drawn in code (it follows the theme); the art has none baked in. */}
    <Ground width={w * .72} style={{ position: 'absolute', bottom: -size * .07 }} />
    {flowerStages.map((src, i) => <StageImage key={i} src={src} on={i === Math.min(stage, flowerStages.length - 1)} w={w} h={size} />)}
  </View>;
}

/* ------------------------------------------------------------------ sources */

function Glow({ on }: { on: boolean }) {
  const { c, reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!on) { p.value = withTiming(0, { duration: 200 }); return; }
    if (reduceMotion) { p.value = .6; return; }
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [on, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: on ? .14 + .26 * p.value : 0, transform: [{ scale: 1 + .05 * p.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -6, bottom: -6, left: -6, right: -6, borderRadius: radius.control + 6, backgroundColor: c.leafMark }, style]} />;
}

/** A connector from a source to the plant, drawn when that source is tapped. */
function Line({ on, from, to }: { on: boolean; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const { c, reduceMotion } = useTheme();
  const p = useSharedValue(.02);
  useEffect(() => { p.value = reduceMotion ? (on ? 1 : .02) : withTiming(on ? 1 : .02, { duration: 380, easing: Easing.out(Easing.cubic) }); }, [on]);
  const vertical = from.x === to.x;
  const len = vertical ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  const style = useAnimatedStyle(() => ({ opacity: on ? 1 : 0, transform: vertical
    ? pivot(1.5, len, .5, from.y > to.y ? 1 : 0, [{ scaleY: p.value }])
    : pivot(len, 1.5, from.x < to.x ? 0 : 1, .5, [{ scaleX: p.value }]) }));
  const box = vertical
    ? { left: from.x - .75, top: Math.min(from.y, to.y), width: 1.5, height: len }
    : { top: from.y - .75, left: Math.min(from.x, to.x), height: 1.5, width: len };
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', backgroundColor: c.ink2 }, box as any, style]} />;
}

function Node({ source, waiting, focused, onPress, wrap }: { source: typeof SOURCES[number]; waiting: boolean; focused: boolean; onPress: () => void; wrap?: boolean }) {
  const { c } = useTheme();
  return <Animated.View entering={FadeIn.duration(360)}>
    <Glow on={waiting} />
    <Tap label={t(source.title)} selected={focused} onPress={onPress} ring={radius.control}
      style={{ minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.control, borderWidth: focused || waiting ? 1.5 : 1, borderColor: focused || waiting ? c.ink : c.ink3, backgroundColor: c.raised, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SourceMark kind={source.key} />
      <T v="subhead" lines={wrap ? undefined : 2} style={{ fontFamily: fonts.medium, flexShrink: 1 }}>{t(source.title)}</T>
    </Tap>
  </Animated.View>;
}

/* ------------------------------------------------------------------ the story */

export function Story({ width, start, advance = 0, onComplete }: { width: number; start: number; advance?: number; onComplete: () => void }) {
  const { c, reduceMotion } = useTheme();
  const compact = useCompact();
  const [stage, setStage] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, reduceMotion ? 0 : ms)); };
  const waiting = shown > done;

  useEffect(() => {
    // After the title has arrived, the seed sprouts by itself, then the first source appears.
    later(() => setStage(1), start);
    later(() => setShown(1), start + 700);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // A tap anywhere on the screen (counted by the onboarding): open the waiting source, or,
  // while the next one is still on its way, bring it in now.
  useEffect(() => {
    if (!advance) return;
    if (stage === 0) { setStage(1); setShown(1); return; }
    if (waiting) tap(done);
    else if (shown < SOURCES.length && shown === done) setShown(done + 1);
  }, [advance]);

  const tap = (i: number) => {
    setFocus(i);
    if (i !== done) return; // an earlier source: just bring its explanation back
    const next = done + 1;
    setDone(next);
    setStage(next + 1);
    if (next < SOURCES.length) later(() => setShown(next + 1), 650);
    else later(onComplete, 900);
  };

  // Two sources above the plant, species notes below it, lines meeting at the plant.
  const nodeW = 132, H = 320, size = 180;
  const plantTop = 40, plantBottom = plantTop + size;
  const pos = [{ x: 0, y: 30 }, { x: width - nodeW, y: 30 }, { x: (width - nodeW) / 2, y: H - 48 }];
  const lines = [
    { from: { x: nodeW, y: 52 }, to: { x: width / 2 - size * .12, y: 52 } },
    { from: { x: width - nodeW, y: 52 }, to: { x: width / 2 + size * .12, y: 52 } },
    { from: { x: width / 2, y: H - 48 }, to: { x: width / 2, y: plantBottom - 6 } },
  ];
  const bloomed = done >= SOURCES.length;
  return <View style={{ gap: space[4] }}>
    {compact
      // Large text: the plant on top, the sources as full-width buttons underneath (no fixed boxes).
      ? <View style={{ alignItems: 'center', gap: space[3] }}>
          <Flower stage={stage} size={150} />
          {bloomed && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: c.successSoft }}>
            <SourceMark kind="suggested" /><T v="caption" tone="leafText">{t("Rootera suggests")}</T>
          </View>}
          {SOURCES.slice(0, shown).map((s, i) => <View key={s.key} style={{ alignSelf: 'stretch' }}>
            <Node source={s} waiting={waiting && i === done} focused={focus === i} onPress={() => tap(i)} wrap />
          </View>)}
        </View>
      : <View style={{ width, height: H }}>
      <View style={{ position: 'absolute', left: (width - size * RATIO) / 2, top: plantTop }}><Flower stage={stage} size={size} /></View>
      {bloomed && <Animated.View entering={FadeIn.delay(450).duration(420)} style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: c.successSoft }}>
          <SourceMark kind="suggested" /><T v="caption" tone="leafText">{t("Rootera suggests")}</T>
        </View>
      </Animated.View>}
      {SOURCES.map((s, i) => <Line key={'l' + s.key} on={i < done} {...lines[i]} />)}
      {SOURCES.slice(0, shown).map((s, i) => <View key={s.key} style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, width: nodeW }}>
        <Node source={s} waiting={waiting && i === done} focused={focus === i} onPress={() => tap(i)} />
      </View>)}
    </View>}
    <View style={{ minHeight: 100, gap: space[2] }} accessibilityLiveRegion="polite">
      {focus !== null
        ? <Animated.View key={focus} entering={reduceMotion ? undefined : FadeInDown.duration(300)} style={{ gap: 4 }}>
            <T v="headline">{t(SOURCES[focus].title)}</T>
            <T v="body" tone="ink2">{t(SOURCES[focus].text)}</T>
          </Animated.View>
        : null}
      {bloomed && <Animated.View entering={FadeInDown.delay(450).duration(420)}>
        <T v="subhead" tone="ink2">{t("Every suggestion shows which of these it came from.")}</T>
      </Animated.View>}
    </View>
  </View>;
}
