/**
 * First run, in three movements:
 *  1. Opening: a seed drops into a pot and the wordmark sprouts (automatic).
 *  2. Getting to know you: how Rootera learns, experience, name, and the nudges you want.
 *  3. Your first plant: fill in its specimen plate; it becomes the first plant in the garden.
 * Every step answers a touch; progress is a plant growing. Nothing here is a paywall.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { catalog, Experience, newId, NudgeKind, Plant, PlantKind, Soil } from '../model';
import { plantArt } from '../ui';
import { useTheme } from '../ds/theme';
import { fonts, radius, space, springs } from '../ds/tokens';
import { Btn, Chip, Field, Glass, Segmented, SourceMark, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { SeedDrop } from '../ds/SeedDrop';
import { LogoSprout } from '../ds/LogoSprout';

/* ------------------------------------------------------------------ opening */

export function Opening({ onContinue }: { onContinue: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [logoRun, setLogoRun] = useState(0);
  const [ready, setReady] = useState(false);
  const rise = useSharedValue(0);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -rise.value * 64 }] }));
  const whenLogoDone = () => {
    rise.value = reduceMotion ? 1 : withSpring(1, springs.smooth);
    setReady(true);
  };
  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top, paddingBottom: insets.bottom + space[6], paddingHorizontal: space.gutter }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', minHeight: 170 }, logoStyle]}>
        <LogoSprout width={250} run={logoRun} variant="full" onDone={whenLogoDone} />
        {ready && <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(420).springify().damping(18)} style={{ alignItems: 'center', gap: space[2], marginTop: space[5], maxWidth: 330 }}>
          <T v="hero" center>Stop guessing what your plant needs.</T>
          <T v="callout" tone="ink2" center>Rootera learns one plant at a time: its spot, its pot and the care you give it.</T>
        </Animated.View>}
      </Animated.View>
      <View style={{ marginTop: space[6] }}>
        <SeedDrop size={200} run={1} onImpact={() => setLogoRun(1)} />
      </View>
    </View>
    {ready && <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(350).duration(300)}>
      <Btn title="Get started" onPress={onContinue} />
    </Animated.View>}
  </View>;
}

/* ------------------------------------------------------------------ shared */

function Growth({ step, total }: { step: number; total: number }) {
  const { c } = useTheme();
  // Progress is a plant growing: each step is a taller shoot.
  return <View accessible accessibilityLabel={`Step ${step} of ${total}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 22 }}>
    {Array.from({ length: total }, (_, i) => <View key={i} style={{ width: 4, height: 7 + i * 3.5, borderRadius: 2, backgroundColor: i < step ? c.leafMark : c.hairline }} />)}
  </View>;
}

function Drift({ tint, size, from, to, ms }: { tint: string; size: number; from: [number, number]; to: [number, number]; ms: number }) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    p.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [reduceMotion]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: from[0] + (to[0] - from[0]) * p.value }, { translateY: from[1] + (to[1] - from[1]) * p.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: tint }, s]} />;
}

/** Slow colour fields that give the glass tiles something to refract. Onboarding only. */
function Atmosphere() {
  const { scheme, reduceTransparency } = useTheme();
  if (reduceTransparency) return null;
  const [a, b] = scheme === 'dark' ? ['#1F3A22', '#2D3B14'] : ['#D6EFE0', '#EAF5BF'];
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: .9 }]}>
    <Drift tint={a} size={340} from={[-140, -40]} to={[-60, 40]} ms={11000} />
    <Drift tint={b} size={300} from={[170, 420]} to={[110, 340]} ms={13000} />
    <BlurView intensity={70} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
  </View>;
}

/* ------------------------------------------------------------------ 1. how it learns */

const learnNodes = [
  { key: 'observed' as const, title: 'You observe', text: 'A soil check, a watering, how the leaves look. Recorded exactly as you describe it.' },
  { key: 'told' as const, title: 'You tell us', text: 'Where it lives, its light, its pot. Optional, and you can change it later.' },
  { key: 'species' as const, title: 'Species notes', text: 'What that species usually likes. A starting point, never a rule for your plant.' },
];

function Learn({ width }: { width: number }) {
  const { c } = useTheme();
  const [seen, setSeen] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const plantSize = 150;
  const nodeW = 112;
  const H = 300;
  const all = seen.length === learnNodes.length;
  const pos = { observed: { x: 0, y: 40 }, told: { x: width - nodeW, y: 40 }, species: { x: (width - nodeW) / 2, y: H - 58 } };
  return <View style={{ gap: space[4] }}>
    <View style={{ width, height: H }}>
      <View style={{ position: 'absolute', left: (width - plantSize) / 2, top: 34, width: plantSize, height: plantSize }}>
        <Image source={plantArt.monstera} style={{ width: plantSize, height: plantSize }} resizeMode="contain" />
      </View>
      {all && <Animated.View entering={FadeInDown.springify().damping(14)} style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: c.raised }}>
          <SourceMark kind="suggested" /><T v="caption">Rootera suggests</T>
        </View>
      </Animated.View>}
      {learnNodes.map(n => {
        const on = seen.includes(n.key);
        const p = pos[n.key];
        return <React.Fragment key={n.key}>
          <Line on={on} from={n.key === 'species' ? { x: width / 2, y: p.y } : { x: n.key === 'observed' ? nodeW : width - nodeW, y: p.y + 22 }}
            to={n.key === 'species' ? { x: width / 2, y: 34 + plantSize } : { x: n.key === 'observed' ? (width - plantSize) / 2 + 20 : (width + plantSize) / 2 - 20, y: p.y + 22 }} />
          <View style={{ position: 'absolute', left: p.x, top: p.y, width: nodeW }}>
            <Tap label={`${n.title}. ${n.text}`} onPress={() => { setSeen(s => s.includes(n.key) ? s : [...s, n.key]); setLast(n.key); }} ring={radius.control}
              style={{ minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.control, borderWidth: 1, borderColor: on ? c.ink : c.ink3, borderStyle: on ? 'solid' : 'dashed', backgroundColor: on ? c.raised : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SourceMark kind={n.key} />
              <T v="subhead" style={{ fontFamily: fonts.medium, flex: 1 }}>{n.title}</T>
            </Tap>
          </View>
        </React.Fragment>;
      })}
    </View>
    <View style={{ minHeight: 72 }}>
      {last
        ? <Animated.View key={last} entering={FadeIn.duration(220)}><T v="body">{learnNodes.find(n => n.key === last)!.text}</T></Animated.View>
        : <T v="body" tone="ink2">Tap each source to see what it adds.</T>}
      {all && <Animated.View entering={FadeIn.delay(200)}><T v="subhead" tone="ink2" style={{ marginTop: space[2] }}>Every suggestion shows which of these it came from.</T></Animated.View>}
    </View>
  </View>;
}

function Line({ on, from, to }: { on: boolean; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const { c } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => { p.value = withSpring(on ? 1 : 0, springs.smooth); }, [on]);
  const vertical = from.x === to.x;
  const len = vertical ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  const style = useAnimatedStyle(() => vertical ? { transform: [{ scaleY: p.value }] } : { transform: [{ scaleX: p.value }] });
  const box = vertical
    ? { left: from.x - .75, top: Math.min(from.y, to.y), width: 1.5, height: len, transformOrigin: from.y > to.y ? 'bottom' : 'top' }
    : { top: from.y - .75, left: Math.min(from.x, to.x), height: 1.5, width: len, transformOrigin: from.x < to.x ? 'left' : 'right' };
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', backgroundColor: c.ink2 }, box as any, style]} />;
}

/* ------------------------------------------------------------------ 2. experience */

const experiences: { value: Experience; label: string; hint: string; art: PlantKind[] }[] = [
  { value: 'first', label: 'My first plant', hint: 'Explain how to check and what to look for.', art: ['pilea'] },
  { value: 'some', label: 'A few plants', hint: 'Short tips for each plant.', art: ['pilea', 'pothos'] },
  { value: 'many', label: 'Lots of plants, or a whole garden', hint: 'Straight to the point.', art: ['snake-plant', 'pothos', 'zz'] },
];

function GlassChoice({ on, onPress, label, hint, art, wide }: { on: boolean; onPress: () => void; label: string; hint: string; art: PlantKind[]; wide?: boolean }) {
  const { c } = useTheme();
  return <Tap role="radio" selected={on} label={`${label}. ${hint}`} onPress={onPress} ring={radius.card} style={{ flex: wide ? undefined : 1 }}>
    <Glass level="control" r={radius.card} shadow={on} style={{ minHeight: wide ? 120 : 176, borderWidth: on ? 1.5 : 0, borderColor: c.ink }}>
      <View style={{ flex: 1, padding: space[4], gap: space[2], flexDirection: wide ? 'row-reverse' : 'column', justifyContent: 'space-between', alignItems: wide ? 'flex-end' : 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {art.map((k, i) => <Image key={k} source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 62 : 48, height: i === 1 ? 62 : 48, marginHorizontal: -6 }} />)}
        </View>
        <View style={{ gap: 2, flex: wide ? 1 : undefined }}>
          <T v="headline">{label}</T>
          <T v="footnote" tone="ink2">{hint}</T>
        </View>
      </View>
      {on && <View style={{ position: 'absolute', top: 12, right: 12 }}><Glyph name="check" size={18} /></View>}
    </Glass>
  </Tap>;
}

/* ------------------------------------------------------------------ 4. nudges */

const nudgeCopy: Record<NudgeKind, { label: string; title: string; guided: string; concise: string }> = {
  soil_check: { label: 'When a soil check would help', title: 'Worth a soil check', guided: 'Last watered 5 days ago. Last time the soil was dry around day 6. Push a finger in and tell me what you feel.', concise: 'Last watered 5 days ago. Check the soil.' },
  pattern: { label: 'When a pattern appears', title: 'A pattern is forming', guided: 'Across 3 cycles, the soil was first dry about 6 days after watering. That depends on how often you check.', concise: 'Usually dry about 6 days after watering.' },
  leaves: { label: 'A reminder to look at the leaves', title: 'How do the leaves look?', guided: 'A quick look now and then helps spot changes early. Note anything new.', concise: 'Take a quick look at the leaves.' },
  weekly: { label: 'A weekly recap', title: 'Your week', guided: '4 soil checks and 2 waterings across your plants. The monstera dried a little faster than usual.', concise: '4 checks, 2 waterings this week.' },
};
const kinds = Object.keys(nudgeCopy) as NudgeKind[];

function shiftTime(t: string, minutes: number) {
  const [h, m] = t.split(':').map(Number);
  const total = (h * 60 + m + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function NudgePicker({ selected, onToggle, detail, onDetail, time, onTime }: { selected: NudgeKind[]; onToggle: (k: NudgeKind) => void; detail: 'Guided' | 'Concise'; onDetail: (d: 'Guided' | 'Concise') => void; time: string; onTime: (t: string) => void }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState<NudgeKind>(selected[0] ?? 'soil_check');
  const copy = nudgeCopy[focus];
  const morning = Number(time.slice(0, 2)) < 12;
  return <View style={{ gap: space[5] }}>
    <Animated.View key={focus + detail + time} entering={FadeIn.duration(220)}>
      <Glass level="control" r={radius.card} style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Glyph name="sprout" size={16} tone={c.leafMark} />
          <T v="caption" tone="ink2" style={{ flex: 1 }}>Rootera</T>
          <T v="caption" tone="ink2">{focus === 'soil_check' ? time : 'now'}</T>
        </View>
        <T v="headline">{copy.title}</T>
        <T v="subhead" tone="ink2">{detail === 'Guided' ? copy.guided : copy.concise}</T>
      </Glass>
    </Animated.View>

    <View>
      {kinds.map(k => {
        const on = selected.includes(k);
        return <Tap key={k} role="switch" selected={on} label={nudgeCopy[k].label} onPress={() => { onToggle(k); setFocus(k); }} ring={radius.inner} scaleTo={.99}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <View style={{ width: 22, height: 22, borderRadius: radius.inner, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {on && <Glyph name="check" size={15} tone={c.canvas} />}
          </View>
          <T v="body" style={{ flex: 1 }}>{nudgeCopy[k].label}</T>
        </Tap>;
      })}
    </View>

    <View style={{ gap: space[2] }}>
      <T v="footnote" tone="ink2">How they sound</T>
      <Segmented values={['Guided', 'Concise'] as const} value={detail} onChange={onDetail} labels={{ Guided: 'Walk me through it', Concise: 'Just tell me' }} />
    </View>

    <View style={{ gap: space[3] }}>
      <T v="footnote" tone="ink2">When they arrive</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <Tap label="Earlier" onPress={() => onTime(shiftTime(time, -15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">−</T></Tap>
        <T v="figure" accessibilityLabel={`Nudges at ${time}`} style={{ minWidth: 110, textAlign: 'center' }}>{time}</T>
        <Tap label="Later" onPress={() => onTime(shiftTime(time, 15))} ring={22} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><T v="title2">+</T></Tap>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {['07:00', '08:00', '09:00', '19:00'].map(t => <Chip key={t} label={t} selected={time === t} onPress={() => onTime(t)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
        <Glyph name="light" size={18} tone={morning ? c.leafText : c.clayText} />
        <T v="footnote" tone="ink2" style={{ flex: 1 }}>{morning
          ? 'Good choice. Mornings are best for watering, so soil-check and watering nudges will almost always arrive at this time.'
          : 'Mornings are usually best for watering. Soil-check and watering nudges will arrive at this time, so a morning hour is recommended.'}</T>
      </View>
    </View>
  </View>;
}

/* ------------------------------------------------------------------ 5. first plant */

type Slot = 'light' | 'pot' | 'soil';
const LIGHT: { label: string; value: string }[] = [{ label: 'Bright, indirect', value: 'Bright indirect light' }, { label: 'Low light', value: 'Low light' }, { label: 'Direct sun', value: 'Direct sun' }, { label: 'Not sure', value: 'Not sure' }];
const POT: { label: string; drainage: string; self: string }[] = [{ label: 'Has a drainage hole', drainage: 'Yes', self: 'No' }, { label: 'No drainage hole', drainage: 'No', self: 'No' }, { label: 'Self-watering pot', drainage: 'Not sure', self: 'Yes' }, { label: 'Not sure', drainage: 'Not sure', self: 'Not sure' }];
const SOIL: { label: string; value: Soil }[] = [{ label: 'Dry', value: 'dry' }, { label: 'Slightly moist', value: 'slightly_moist' }, { label: 'Moist', value: 'moist' }, { label: 'Very wet', value: 'wet' }, { label: 'Not sure', value: 'not_sure' }];
const SLOT_Q: Record<Slot, string> = { light: 'How much light does it get?', pot: 'What is it planted in?', soil: 'Push a finger into the soil. How does it feel?' };

function Callout({ side, top, label, value, active, source, onPress, anchor, width }: { side: 'left' | 'right'; top: number; label: string; value?: string; active: boolean; source: 'observed' | 'told'; onPress: () => void; anchor: number; width: number }) {
  const { c } = useTheme();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => { p.value = withSpring(value ? 1 : 0, springs.smooth); }, [value]);
  const boxW = 124;
  const lineStart = side === 'left' ? boxW : width - anchor;
  const len = side === 'left' ? anchor - boxW : width - boxW - anchor;
  const draw = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return <>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top + 26, left: side === 'left' ? boxW : anchor, width: Math.max(0, len), height: 1.5, backgroundColor: c.ink2, transformOrigin: side === 'left' ? 'left' : 'right' }, draw]} />
    <View style={{ position: 'absolute', top, [side]: 0, width: boxW }}>
      <Tap label={value ? `${label}: ${value}. Change` : `Add ${label.toLowerCase()}`} onPress={onPress} ring={radius.input}
        style={{ minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.input, borderWidth: active ? 1.5 : 1, borderStyle: value || active ? 'solid' : 'dashed', borderColor: active ? c.ink : value ? c.hairline : c.ink3, backgroundColor: value ? c.raised : 'transparent', alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
        <View style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
          <SourceMark kind={source} /><T v="caption" tone="ink2">{label}</T>
        </View>
        <T v={value ? 'subhead' : 'footnote'} tone={value ? 'ink' : 'ink2'} lines={2} style={{ textAlign: side, fontFamily: value ? fonts.medium : fonts.regular }}>{value ?? 'Tap to add'}</T>
      </Tap>
    </View>
  </>;
}

function FirstPlant({ width, kind, setKind, answers, setAnswer, open, setOpen }: {
  width: number; kind: PlantKind | null; setKind: (k: PlantKind) => void;
  answers: Partial<Record<Slot, number>>; setAnswer: (s: Slot, i: number) => void; open: Slot | 'plant'; setOpen: (s: Slot | 'plant') => void;
}) {
  const { c, reduceMotion } = useTheme();
  const reveal = useSharedValue(kind ? 1 : 0);
  const size = Math.min(210, width * .52);
  const left = (width - size) / 2;
  useEffect(() => { if (kind) reveal.value = reduceMotion ? 1 : withDelay(40, withSpring(1, springs.bouncy)); }, [kind]);
  const colour = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: (1 - reveal.value) * 14 }, { scale: .92 + .08 * reveal.value }] }));
  const valueOf = (s: Slot) => answers[s] === undefined ? undefined : s === 'light' ? LIGHT[answers[s]!].label : s === 'pot' ? POT[answers[s]!].label : SOIL[answers[s]!].label;
  const options = open === 'plant' ? [] : open === 'light' ? LIGHT.map(o => o.label) : open === 'pot' ? POT.map(o => o.label) : SOIL.map(o => o.label);
  return <View style={{ gap: space[4] }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingRight: space[4] }} style={{ marginHorizontal: -space.gutter, paddingLeft: space.gutter }}>
      {[...catalog.map(s => ({ kind: s.kind, name: s.name }))].map(s => {
        const on = kind === s.kind;
        return <Tap key={s.kind} role="radio" selected={on} label={s.name} onPress={() => { setKind(s.kind); if (open === 'plant') setOpen('light'); }} ring={radius.control}
          style={{ width: 84, alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: radius.control, backgroundColor: on ? c.raised : 'transparent', borderWidth: on ? 1.5 : 0, borderColor: c.ink }}>
          <Image source={plantArt[s.kind]} style={{ width: 56, height: 56 }} resizeMode="contain" />
          <T v="caption" tone={on ? 'ink' : 'ink2'} lines={1}>{s.name}</T>
        </Tap>;
      })}
    </ScrollView>

    <View style={{ width, height: size + 24 }}>
      <View style={{ position: 'absolute', left, top: 0, width: size, height: size }}>
        <View style={{ position: 'absolute', bottom: -8, left: size * .15, right: size * .15, height: 16, borderRadius: size, backgroundColor: c.hairline }} />
        <Image source={plantArt[kind ?? 'monstera']} resizeMode="contain" tintColor={c.sunken} style={{ position: 'absolute', width: size, height: size }} />
        {kind && <Animated.Image key={kind} source={plantArt[kind]} resizeMode="contain" style={[{ position: 'absolute', width: size, height: size }, colour]} />}
      </View>
      {kind && <>
        <Callout side="left" top={size * .08} label="Light" source="told" value={valueOf('light')} active={open === 'light'} onPress={() => setOpen('light')} anchor={left + size * .42} width={width} />
        <Callout side="right" top={size * .5} label="Soil" source="observed" value={valueOf('soil')} active={open === 'soil'} onPress={() => setOpen('soil')} anchor={left + size * .6} width={width} />
        <Callout side="left" top={size * .72} label="Pot" source="told" value={valueOf('pot')} active={open === 'pot'} onPress={() => setOpen('pot')} anchor={left + size * .36} width={width} />
      </>}
    </View>

    {kind && open !== 'plant' && <Animated.View key={open} entering={FadeIn.duration(200)} style={{ gap: space[3] }}>
      <T v="headline">{SLOT_Q[open]}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {options.map((o, i) => <Chip key={o} label={o} selected={answers[open] === i} onPress={() => setAnswer(open, i)} />)}
      </View>
      {open === 'soil' && <T v="footnote" tone="ink2">This is your first observation. Rootera compares every later check with it.</T>}
    </Animated.View>}
  </View>;
}

/* ------------------------------------------------------------------ flow */

const TOTAL = 5;

export function Onboarding({ navigation }: Props<'Welcome'>) {
  const { garden, saveProfile, addPlant, logCare } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [width, setWidth] = useState(0);
  const [experience, setExperience] = useState<Experience | ''>(garden.caregiver?.experience ?? '');
  const [name, setName] = useState(garden.name);
  const [nudges, setNudges] = useState<NudgeKind[]>(garden.nudges?.kinds ?? ['soil_check', 'pattern']);
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [kind, setKind] = useState<PlantKind | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<Slot, number>>>({});
  const [open, setOpen] = useState<Slot | 'plant'>('plant');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(0);
  const ids = useRef({ plant: newId('plant'), soil: newId('care'), soilAt: '' });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (step > 1 && !busy) { setStep(step - 1); return true; } return false; });
    return () => sub.remove();
  }, [step, busy]);

  // Experience sets the default tone; the person can still change it on the nudges step.
  const chooseExperience = (e: Experience) => { setExperience(e); setDetail(e === 'many' ? 'Concise' : 'Guided'); };
  const setAnswer = (s: Slot, i: number) => {
    setAnswers(a => ({ ...a, [s]: i }));
    const next = (['light', 'pot', 'soil'] as Slot[]).find(x => x !== s && answers[x] === undefined);
    if (next) setOpen(next);
  };

  const finish = async () => {
    if (busy || !kind) return;
    setBusy(true); setError('');
    try {
      await saveProfile({ name: name.trim(), onboarded: true, reminders: nudges.length > 0, caregiver: { experience: experience || 'first', detail }, nudges: { kinds: nudges, time } });
      const species = catalog.find(s => s.kind === kind)!;
      const light = answers.light !== undefined ? LIGHT[answers.light].value : 'Not sure';
      const pot = answers.pot !== undefined ? POT[answers.pot] : POT[3];
      const plant: Plant = { id: ids.current.plant, kind, species: species.latin, name: species.name, room: 'Not sure', pot: 'Not sure', light, drainage: pot.drainage, self_watering: pot.self, environment: { location: 'Indoors', near_window: 'Not sure' } };
      if (!garden.plants.some(p => p.id === plant.id)) await addPlant(plant);
      if (answers.soil !== undefined) {
        ids.current.soilAt ||= new Date().toISOString();
        await logCare({ id: ids.current.soil, plantId: plant.id, type: 'Soil check', soil: SOIL[answers.soil].value, note: '', at: ids.current.soilAt, source: 'USER' });
      }
      setCelebrate(1);
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? e.message : e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  if (step === 0) return <Opening onContinue={() => setStep(1)} />;

  if (celebrate) {
    return <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', padding: space.gutter, gap: space[6] }}>
      <SeedDrop size={230} run={celebrate} kind={kind!} onDone={() => setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }), reduceMotion ? 900 : 1500)} />
      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(900)} style={{ alignItems: 'center', gap: space[1] }}>
        <T v="hero" center>{catalog.find(s => s.kind === kind)?.name} is in your garden.</T>
        <T v="callout" tone="ink2" center>{answers.soil !== undefined ? 'Your first check is saved. Here is what it means.' : 'Its first soil check is waiting for you.'}</T>
      </Animated.View>
    </View>;
  }

  const titles: Record<number, [string, string]> = {
    1: ['Rootera learns this plant, not plants in general.', 'Three sources, kept apart so you always know where advice comes from.'],
    2: ['How’s your plant life right now?', 'This sets how much Rootera explains. You can change it any time.'],
    3: ['What should we call you?', 'Optional. It appears on your Today screen.'],
    4: ['Choose the nudges you want.', 'Each one comes from what you record. Change them any time in You.'],
    5: [kind ? 'Now fill in what you know.' : 'Which plant is yours?', kind ? 'Tap each note on the plate. Anything you skip can be added later.' : 'Start with the one you see most often.'],
  };
  const canNext = step === 2 ? !!experience : step === 5 ? !!kind : true;
  const cta = step === 5 ? 'Plant it' : 'Continue';
  const glassy = step === 2 || step === 3;

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    {glassy && <Atmosphere />}
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space.gutter, height: insets.top + 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tap label="Back" onPress={() => !busy && setStep(step - 1)} ring={22} style={{ width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}><Glyph name="back" size={22} /></Tap>
      <Growth step={step} total={TOTAL} />
      {step === 1 || step === 4
        ? <Tap label="Skip this step" onPress={() => setStep(step + 1)} ring={radius.inner} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T v="subhead" tone="ink2">Skip</T></Tap>
        : <View style={{ width: 44 }} />}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space[6], gap: space[5], flexGrow: 1 }}>
      <Animated.View key={step + (kind ? 'k' : '')} entering={reduceMotion ? undefined : FadeInDown.duration(320).springify().damping(20)} style={{ gap: space[2], paddingTop: space[4] }}>
        <T v="hero">{titles[step][0]}</T>
        <T v="callout" tone="ink2">{titles[step][1]}</T>
      </Animated.View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {!!width && step === 1 && <Learn width={width} />}
        {step === 2 && <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {experiences.slice(0, 2).map(o => <GlassChoice key={o.value} on={experience === o.value} onPress={() => chooseExperience(o.value)} label={o.label} hint={o.hint} art={o.art} />)}
          </View>
          <GlassChoice wide on={experience === 'many'} onPress={() => chooseExperience('many')} label={experiences[2].label} hint={experiences[2].hint} art={experiences[2].art} />
        </View>}
        {step === 3 && <Field label="Your name" value={name} onChangeText={setName} placeholder="Guto" maxLength={40} onSubmitEditing={() => setStep(4)} help="Preview access: accounts aren’t connected yet. Your garden is saved on the Rootera server this preview uses." />}
        {step === 4 && <NudgePicker selected={nudges} onToggle={k => setNudges(n => n.includes(k) ? n.filter(x => x !== k) : [...n, k])} detail={detail} onDetail={setDetail} time={time} onTime={setTime} />}
        {!!width && step === 5 && <FirstPlant width={width} kind={kind} setKind={k => { setKind(k); }} answers={answers} setAnswer={setAnswer} open={open} setOpen={setOpen} />}
      </View>
    </ScrollView>
    <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4], paddingTop: space[3], gap: space[3] }}>
      {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
      <Btn title={cta} busy={busy} disabled={!canNext} onPress={() => step < TOTAL ? setStep(step + 1) : void finish()} />
    </View>
  </View>;
}
