/**
 * The Shipaton lab: a test bench made only for the Shipaton judges and testers.
 *
 * A guided start, then a stage. It opens in low light on the welcome and four white
 * circles (the plant, the watering method, the calendar, the forecast), one white line each
 * on what the step does to the forecast. Two short choices follow (the plant, how it is
 * watered), one screen each, with the rest behind "More options". Then the stage: the
 * calendar, what Rootera says on the chosen day with its timeline, Play, and one line of
 * result; how it learned opens on request. The light comes up step by step.
 *
 * Everything is simulated by the backend (backend/app/lab.py): a virtual plant, "MVP
 * Shipaton", and a simulated caregiver whose records go through the REAL guidance engine.
 * Calendar: a tap waters that day (or takes it back); a double tap opens the day, where a
 * three-layer soil check and a leaf note can be typed in.
 *
 * Weather and photos have their place here and in the API; they are not simulated yet.
 * The lab has its own dark palette: it is a stage, not a page of the app.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Props } from '../navigation';
import { api, LabClimate, LabDayIn, LabIn, LabMethod, LabOut } from '../api';
import { catalog, Layer, LayerKey, PlantKind, SoilLayers, speciesName } from '../model';
import { useTheme } from '../ds/theme';
import { enter } from '../ds/motion';
import { fonts, motion, radius, space } from '../ds/tokens';
import { T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { PlantArt } from '../ds/plant';
import { haptic } from '../ds/feedback';
import { CyclesScene, WaterWeatherScene } from './LabStory';
import { locale, t, tn } from '../i18n';

/* ------------------------------------------------------------------ the stage */

const L = {
  bg: '#060807', raised: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.14)', text: '#F4F6F2', dim: 'rgba(244,246,242,.64)',
  faint: 'rgba(244,246,242,.38)', leaf: '#B6E07C', water: '#86BCCB', warn: '#E8B86B', bad: '#E88A6B',
  soil: { dry: '#CDB690', moist: '#8A6242', wet: '#4A3322' } as Record<Layer, string>,
};
const KINDS: PlantKind[] = ['monstera', 'pothos', 'peace-lily', 'snake-plant', 'aloe'];
const POTS = [['Small pot', 'Small'], ['Medium pot', 'Medium'], ['Large pot', 'Large']] as const;
const LIGHTS = [['Low light', 'Low'], ['Bright indirect light', 'Bright, indirect'], ['Direct sun', 'Direct sun']] as const;
const PACES = [[.8, 'Faster'], [1, 'Typical'], [1.2, 'Slower']] as const;
const LENGTHS = [28, 42, 56, 91] as const;
/** Real weather (Open-Meteo archive, bundled): none, a warming spring, a cool winter. */
const CLIMATES = [['none', 'No weather'], ['sp_spring', 'Spring in São Paulo'], ['poa_winter', 'Winter in Porto Alegre']] as const;
const METHODS: { key: LabMethod; label: string; means: string; main?: boolean }[] = [
  { key: 'rootera', main: true, label: 'Follow Rootera', means: 'Check before watering, water when it’s dry. This is how Rootera learns.' },
  { key: 'weekly', main: true, label: 'Water every week', means: 'A fixed calendar, to compare: watered before it dries, Rootera can’t close a cycle.' },
  { key: 'manual', main: true, label: 'I pick the days', means: 'Water from the calendar, one day at a time.' },
  { key: 'often', label: 'Too much: every 3 days', means: 'The bottom never breathes, and the leaves feel it.' },
  { key: 'forgetful', label: 'Too little: every 14 days', means: 'Plants that drink from the top go thirsty.' },
];
/** The opening story (see LabStory.tsx): one scene, a title and one line each. */
// The first scene (the watering that becomes the weather) carries its own captions, in step
// with the animation; the second has a title and a line.
const SCENES: { title?: string; line?: string; note?: string }[] = [
  {},
  { title: 'Three cycles to know the plant', line: 'At first Rootera is still analyzing your plant and uses what the species usually does. From the second cycle it gets specific; from the third, the recommendations are this plant’s own.' },
];
const LAYERS: LayerKey[] = ['top', 'middle', 'bottom'];
const LAYER_NAME: Record<LayerKey, string> = { top: 'Surface', middle: 'Middle', bottom: 'Bottom' };
const LAYER_VALUE: Record<Layer | 'unreached', string> = { dry: 'Dry', moist: 'Moist', wet: 'Wet', unreached: 'Couldn’t reach' };
const LEAVES = [['great', 'Looks good'], ['different', 'Something changed'], ['unwell', 'Not doing well']] as const;
const STEPS = [
  { title: 'The plant', means: 'Species, pot and light set the first estimate.' },
  { title: 'The watering method', means: 'How you water decides whether Rootera can learn.' },
  { title: 'The calendar', means: 'Tap a day to see how the plant was, and water from there.' },
  { title: 'The forecast', means: 'Watch the drying window fit this plant, day by day.' },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Tap role="radio" selected={on} label={label} onPress={() => { haptic.select(); onPress(); }} ring={radius.input}
    style={{ minHeight: 40, paddingHorizontal: 13, borderRadius: radius.input, justifyContent: 'center', borderWidth: 1, borderColor: on ? L.text : L.line, backgroundColor: on ? L.text : 'transparent' }}>
    <T v="subhead" style={{ color: on ? L.bg : L.text }}>{label}</T>
  </Tap>;
}

function Row({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return <View style={{ gap: space[2] }}>
    <T v="footnote" style={{ color: L.dim }}>{label}</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>
  </View>;
}

/** The story's three scenes. */
function SceneDots({ at }: { at: number }) {
  return <View style={{ flexDirection: 'row', gap: space[2] }}>
    {SCENES.map((_, i) => <View key={i} style={{ width: i === at ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= at ? L.text : L.line }} />)}
  </View>;
}

/** The soil that evening and what happened that day. */
function DaySoil({ day }: { day: LabOut['days'][number] }) {
  const happened = [day.events.some(e => e.type === 'water') ? t('Watered') : null, day.events.some(e => e.type === 'check') ? t('Soil checked') : null,
    day.leaves !== 'great' ? t(LEAVES.find(l => l[0] === day.leaves)![1]) : null].filter(Boolean).join(', ');
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
    <View style={{ gap: 2 }}>{LAYERS.map(k => <View key={k} style={{ width: 34, height: 7, borderRadius: 2, backgroundColor: L.soil[day.soil[k]] }} />)}</View>
    <View style={{ flex: 1 }}>
      <T v="footnote" style={{ color: L.dim }}>{LAYERS.map(k => t(LAYER_VALUE[day.soil[k]])).join(' / ')}</T>
      {!!happened && <T v="footnote" style={{ color: L.text }}>{happened}</T>}
    </View>
  </View>;
}

/** Cycles closed so far: two observations, then the pattern. */
function CycleDots({ n }: { n: number }) {
  const shown = Math.min(3, n);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
    {[0, 1, 2].map(i => <View key={i} style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: L.text, backgroundColor: i < shown ? L.text : 'transparent' }} />)}
    <T v="footnote" style={{ color: L.dim, flex: 1 }}>{n >= 3 ? t('Pattern: recommendations from this plant') : n === 2 ? t('Getting specific: mixing the species and this plant') : t('Still analyzing your plant: species estimate')}</T>
  </View>;
}

/** The four white circles: filled up to where the tester is. */
function Progress({ at }: { at: number }) {
  return <View accessible accessibilityLabel={t('Step {n} of 4', { n: Math.min(4, at + 1) })} style={{ flexDirection: 'row', gap: space[2] }}>
    {STEPS.map((_, i) => <View key={i} style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: L.text, backgroundColor: i <= at ? L.text : 'transparent' }} />)}
  </View>;
}

function StepHead({ n }: { n: number }) {
  return <View style={{ gap: space[2] }}>
    <T v="footnote" style={{ color: L.dim }}>{t('Step {n} of 4', { n: n + 1 })}</T>
    <T v="hero" style={{ color: L.text }}>{t(STEPS[n].title)}</T>
    <T v="callout" style={{ color: L.dim }}>{t(STEPS[n].means)}</T>
  </View>;
}

/** Secondary choices, closed until asked for. */
function More({ children }: React.PropsWithChildren) {
  const { reduceMotion } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: space[4] }}>
    <Tap label={open ? t('Fewer options') : t('More options')} onPress={() => setOpen(o => !o)} ring={radius.inner} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
      <T v="subhead" style={{ color: L.leaf, fontFamily: fonts.medium }}>{open ? t('Fewer options') : t('More options')}</T>
    </Tap>
    {open && <Animated.View entering={reduceMotion ? undefined : enter.fade()} style={{ gap: space[4] }}>{children}</Animated.View>}
  </View>;
}

function Primary({ title, onPress }: { title: string; onPress: () => void }) {
  return <Tap label={title} onPress={onPress} ring={radius.control}
    style={{ minHeight: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: L.text }}>
    <T v="headline" style={{ color: L.bg }}>{title}</T>
  </Tap>;
}

/** Light that comes up as the steps are done. */
function Glow({ level }: { level: number }) {
  const { reduceMotion } = useTheme();
  const v = useSharedValue(.15);
  useEffect(() => { const to = .15 + .85 * level; v.value = reduceMotion ? to : withTiming(to, { duration: motion.dur.story }); }, [level]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%">
      <Defs><RadialGradient id="g" cx="50%" cy="0%" rx="90%" ry="55%"><Stop offset="0" stopColor="#DDF2C2" stopOpacity={.28} /><Stop offset="1" stopColor="#DDF2C2" stopOpacity={0} /></RadialGradient></Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#g)" />
    </Svg>
  </Animated.View>;
}

/* ------------------------------------------------------------------ the calendar */

function DayCell({ d, day, selected, typed, onPress, size }: { d: LabOut['days'][number] | undefined; day: number; selected: boolean; typed: boolean; onPress: () => void; size: number }) {
  const water = !!d?.events.some(e => e.type === 'water');
  const check = !!d?.events.some(e => e.type === 'check');
  const leaves = d?.leaves;
  const label = [t('Day {n}', { n: day + 1 }), water ? t('watered') : null, check ? t('checked') : null, leaves && leaves !== 'great' ? t(LEAVES.find(l => l[0] === leaves)![1]) : null].filter(Boolean).join(', ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${t('Tap to water, double tap for details.')}`} onPress={onPress}
    style={{ width: size, height: size + 10, borderRadius: radius.inner, padding: 4, justifyContent: 'space-between', backgroundColor: selected ? 'rgba(255,255,255,.14)' : L.raised, borderWidth: selected || typed ? 1 : 0, borderColor: selected ? L.text : L.faint }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T v="caption" style={{ color: L.dim, fontVariant: ['tabular-nums'] }}>{day + 1}</T>
      {water && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: L.water }} />}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      {/* The soil that evening, top to bottom, as the virtual plant has it. */}
      <View style={{ width: 8, gap: 1 }}>{LAYERS.map(k => <View key={k} style={{ height: 4, borderRadius: 1, backgroundColor: d ? L.soil[d.soil[k]] : L.line }} />)}</View>
      {check && <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: L.text }} />}
      {!!leaves && leaves !== 'great' && <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: leaves === 'unwell' ? L.bad : L.warn }} />}
    </View>
  </Pressable>;
}

function DaySheet({ day, date, value, onSave, onClose }: { day: number; date: string; value: LabDayIn; onSave: (v: LabDayIn) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [water, setWater] = useState<boolean | null>(value.water ?? null);
  const [layers, setLayers] = useState<Partial<SoilLayers> | null>(value.layers ?? null);
  const [leaves, setLeaves] = useState(value.leaves ?? null);
  const complete = !layers || LAYERS.every(k => !!layers[k]);
  return <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <Pressable accessibilityLabel={t('Close')} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.6)' }]} />
    <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }} pointerEvents="box-none">
      <ScrollView style={{ width: '100%', maxWidth: 440, maxHeight: '86%', backgroundColor: '#101412', borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome }}
        contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + space[5], gap: space[5] }}>
        <View style={{ gap: 2 }}>
          <T v="title2" style={{ color: L.text }}>{t('Day {n}', { n: day + 1 })}</T>
          <T v="subhead" style={{ color: L.dim }}>{new Date(date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>
        <Row label={t('Watering')}>
          <Chip label={t('Watered that day')} on={water === true} onPress={() => setWater(true)} />
          <Chip label={t('Not watered')} on={water === false} onPress={() => setWater(false)} />
          <Chip label={t('Method decides')} on={water === null} onPress={() => setWater(null)} />
        </Row>
        <View style={{ gap: space[3] }}>
          <T v="footnote" style={{ color: L.dim }}>{t('Soil check')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <Chip label={t('From the plant')} on={!layers} onPress={() => setLayers(null)} />
            <Chip label={t('Type it in')} on={!!layers} onPress={() => setLayers(layers ?? {})} />
          </View>
          {!!layers && LAYERS.map(k => <Row key={k} label={t(LAYER_NAME[k])}>
            {(k === 'bottom' ? ['dry', 'moist', 'wet', 'unreached'] as const : ['dry', 'moist', 'wet'] as const).map(v =>
              <Chip key={v} label={t(LAYER_VALUE[v])} on={layers[k] === v} onPress={() => setLayers({ ...layers, [k]: v })} />)}
          </Row>)}
        </View>
        <Row label={t('Leaves')}>
          <Chip label={t('From the plant')} on={!leaves} onPress={() => setLeaves(null)} />
          {LEAVES.map(([k, l]) => <Chip key={k} label={t(l)} on={leaves === k} onPress={() => setLeaves(k)} />)}
        </Row>
        <Tap label={t('Save day')} disabled={!complete} onPress={() => onSave({ day, water, layers: layers as SoilLayers | null, leaves })} ring={radius.control}
          style={{ minHeight: 50, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: complete ? L.text : L.line }}>
          <T v="headline" style={{ color: L.bg }}>{complete ? t('Save day') : t('Answer the three layers')}</T>
        </Tap>
        <Tap label={t('Cancel')} onPress={onClose} ring={radius.inner} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
          <T v="subhead" style={{ color: L.dim }}>{t('Cancel')}</T>
        </Tap>
      </ScrollView>
    </View>
  </Modal>;
}

/* ------------------------------------------------------------------ the forecast */

/** The day's drying timeline, on the stage palette: time since watering, the window, today. */
function StageTimeline({ g, now }: { g: LabOut['days'][number]['guidance']; now: string }) {
  const [w, setW] = useState(0);
  const f = g.forecast;
  if (!f || !g.last_watered_at) return <T v="subhead" style={{ color: L.dim }}>{t('The timeline starts at the first watering.')}</T>;
  const since = Math.max(0, (new Date(now).getTime() - new Date(g.last_watered_at).getTime()) / 86400000);
  const span = Math.max(f.high_days * 1.25, since + 1, f.high_days + 1);
  const x = (d: number) => Math.min(1, d / span) * w;
  const own = f.source === 'cycles';
  return <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: 30, justifyContent: 'center' }}>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: L.line }} />
    {!!w && <>
      <View style={{ position: 'absolute', left: 0, width: Math.max(2, x(since)), height: 6, borderRadius: 3, backgroundColor: L.dim }} />
      <View style={{ position: 'absolute', left: x(f.low_days), width: Math.max(8, x(f.high_days) - x(f.low_days)), height: 12, borderRadius: radius.inner,
        backgroundColor: own ? L.leaf : 'transparent', borderWidth: own ? 0 : 1.5, borderStyle: own ? 'solid' : 'dashed', borderColor: L.leaf }} />
      <View style={{ position: 'absolute', left: x(since) - 1, width: 2, height: 26, backgroundColor: L.text }} />
    </>}
  </View>;
}

/** Each day's window (a band) against how this plant really dries (a line): the estimate narrows onto the plant. */
function Learning({ out, upTo }: { out: LabOut; upTo: number }) {
  const [w, setW] = useState(0);
  const H = 150, pad = 18;
  const days = out.days;
  const maxY = Math.max(out.truth.dry_after_days * 1.6, ...days.map(d => d.guidance.forecast?.high_days ?? 0), 4);
  const X = (i: number) => (i / Math.max(1, days.length - 1)) * w;
  const Y = (v: number) => H - pad - (v / maxY) * (H - pad * 2);
  const band = days.map((d, i) => ({ i, f: d.guidance.forecast })).filter(p => p.f && p.i <= upTo);
  const top = band.map(p => `${X(p.i)},${Y(p.f!.high_days)}`).join(' L');
  const bottom = band.slice().reverse().map(p => `${X(p.i)},${Y(p.f!.low_days)}`).join(' L');
  const cycles = days.filter((d, i) => i > 0 && i <= upTo && d.guidance.completed_cycles > days[i - 1].guidance.completed_cycles);
  return <View style={{ gap: space[2] }} accessible accessibilityLabel={t('Forecast window over time, against how this plant really dries')}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="caption" style={{ color: L.dim }}>{t('Days after watering')}</T>
      <T v="caption" style={{ color: L.dim }}>{t('Simulation days')} →</T>
    </View>
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {!!w && <Svg width={w} height={H}>
        {band.length > 1 && <Path d={`M${top} L${bottom} Z`} fill={L.leaf} opacity={.28} />}
        <Line x1={0} x2={w} y1={Y(out.truth.dry_after_days)} y2={Y(out.truth.dry_after_days)} stroke={L.text} strokeWidth={1.5} strokeDasharray="5 4" />
        {cycles.map(d => <Circle key={d.day} cx={X(d.day)} cy={Y(d.guidance.cycle_days?.slice(-1)[0] ?? out.truth.dry_after_days)} r={4} fill={L.leaf} />)}
        {[0, Math.round(maxY / 2), Math.round(maxY)].map(v => <SvgText key={v} x={2} y={Y(v) - 3} fill={L.faint} fontSize={10}>{v}</SvgText>)}
        <Line x1={X(upTo)} x2={X(upTo)} y1={pad / 2} y2={H - pad / 2} stroke={L.faint} strokeWidth={1} />
      </Svg>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
      <Legend swatch={<View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: L.leaf, opacity: .5 }} />} text={t('Rootera’s window')} />
      <Legend swatch={<View style={{ width: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: L.text }} />} text={t('How this plant really dries')} />
      <Legend swatch={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: L.leaf }} />} text={t('A cycle learned')} />
    </View>
  </View>;
}

function Legend({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{swatch}<T v="caption" style={{ color: L.dim }}>{text}</T></View>;
}

function Stat({ value, label, tone = L.text }: { value: string; label: string; tone?: string }) {
  return <View style={{ flexGrow: 1, flexBasis: '30%', padding: space[3], borderRadius: radius.control, backgroundColor: L.raised, gap: 2 }}>
    <T v="title2" style={{ color: tone, fontVariant: ['tabular-nums'] }}>{value}</T>
    <T v="caption" style={{ color: L.dim }}>{label}</T>
  </View>;
}

/* ------------------------------------------------------------------ the screen */

type Phase = 'intro' | 'story' | 'plant' | 'method' | 'stage';
const PHASES: Phase[] = ['intro', 'story', 'plant', 'method', 'stage'];

export function Lab({ navigation }: Props<'Lab'>) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useTheme();
  const [phase, setPhase] = useState<Phase>('intro');
  const [scene, setScene] = useState(0);
  const [kind, setKind] = useState<PlantKind>('monstera');
  const [pot, setPot] = useState<LabIn['pot']>('Medium pot');
  const [drainage, setDrainage] = useState<LabIn['drainage']>('Yes');
  const [light, setLight] = useState<LabIn['light']>('Bright indirect light');
  const [pace, setPace] = useState(1);
  const [climate, setClimate] = useState<LabClimate>('none');
  const [method, setMethod] = useState<LabMethod>('rootera');
  const [length, setLength] = useState<number>(42);
  const [checkEvery, setCheckEvery] = useState(2);
  const [overrides, setOverrides] = useState<Record<number, LabDayIn>>({});
  const [out, setOut] = useState<LabOut | null>(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState<number | null>(null);
  const [learning, setLearning] = useState(false);
  // On the stage, the last two circles fill as the calendar and the forecast are used.
  const [used, setUsed] = useState({ calendar: false, forecast: false });
  const [width, setWidth] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const go = (p: Phase) => { setPhase(p); scroll.current?.scrollTo({ y: 0, animated: false }); };

  // Every change runs the simulation again (debounced), through the real engine.
  const body: LabIn = { kind, pot, drainage, light, pace, climate, method, days: length, check_every: checkEvery, overrides: Object.values(overrides).filter(o => o.day < length) };
  const key = JSON.stringify(body);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      try { const r = await api.labSimulate(body); if (live) { setOut(r); setError(''); setDay(d => Math.min(d, r.days.length - 1)); } }
      catch (e) { if (live) setError(e instanceof Error ? e.message : t('Could not simulate.')); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [key]);

  // Play: step through the days so the forecast can be watched adapting.
  useEffect(() => {
    if (!playing || !out) return;
    if (day >= out.days.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setDay(d => d + 1), reduceMotion ? 120 : 380);
    return () => clearTimeout(timer);
  }, [playing, day, out]);

  // Changing a watering by hand turns a preset into "my own days", keeping the waterings it made.
  const edit = (patch: LabDayIn) => {
    if (!out) return;
    const next: Record<number, LabDayIn> = { ...overrides };
    if (patch.water != null && method !== 'manual') {
      out.days.forEach(x => { if (x.events.some(e => e.type === 'water')) next[x.day] = { ...next[x.day], day: x.day, water: true }; });
      setMethod('manual');
    }
    next[patch.day] = { ...next[patch.day], ...patch };
    setOverrides(next);
  };
  // A tap only shows the day; watering and recording are buttons on the day, so looking never changes the cycle.
  const tapDay = (d: number) => { setDay(d); setPlaying(false); setUsed(u => ({ ...u, calendar: true })); };
  const toggleWater = (d: number) => { haptic.select(); edit({ day: d, water: !out?.days[d]?.events.some(e => e.type === 'water') }); };

  const at = phase === 'intro' || phase === 'story' ? -1 : phase === 'plant' ? 0 : phase === 'method' ? 1 : used.forecast ? 3 : used.calendar ? 2 : 1;
  const cell = width ? Math.floor((width - 6 * 6) / 7) : 0;
  const now = out?.days[day];
  const s = out?.summary;
  const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });
  const name = (k: PlantKind) => speciesName(catalog.find(c => c.kind === k)!);
  const methodInfo = METHODS.find(m => m.key === method)!;
  const dateOf = (i: number) => out ? new Date(out.days[i].date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const back = () => phase === 'intro' ? navigation.goBack() : phase === 'story' && scene > 0 ? setScene(n => n - 1) : go(PHASES[PHASES.indexOf(phase) - 1]);
  const result = !s ? '' : s.cycles >= 3
    ? t('Learned {learned} days. The plant really takes {truth} days.', { learned: fmt(s.learned_days ?? 0), truth: fmt(out!.truth.dry_after_days) })
    : s.cycles === 0 ? t('No cycle closed: the soil was never found dry after a watering, so Rootera keeps its general estimate.')
    : tn(s.cycles, 'One cycle so far. Rootera mixes it with the general estimate.', '{n} cycles so far. Rootera mixes them with the general estimate.');

  return <View style={{ flex: 1, backgroundColor: L.bg }}>
    <Glow level={(at + 1) / 4} />
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space.gutter, height: insets.top + 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tap label={phase === 'intro' ? t('Close') : t('Back')} onPress={back} ring={22} style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <Glyph name={phase === 'intro' ? 'close' : 'back'} size={20} tone={L.text} />
      </Tap>
      {phase === 'story' ? <SceneDots at={scene} /> : phase !== 'intro' && <Progress at={at} />}
      <View style={{ width: 44 }} />
    </View>
    <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, paddingTop: space[4], paddingBottom: insets.bottom + space[6], paddingHorizontal: space.gutter }}>
      <Animated.View key={phase} entering={reduceMotion ? undefined : phase === 'intro' ? FadeIn.duration(motion.dur.story) : enter.fade()} style={{ flexGrow: 1, gap: space[6] }}>

        {phase === 'intro' && <>
          <View style={{ gap: space[3] }}>
            <T v="footnote" style={{ color: L.dim }}>{t('Shipaton lab')}</T>
            <T v="hero" style={{ color: L.text }}>{t('Welcome. This is a test interface made only for Shipaton.')}</T>
            <T v="callout" style={{ color: L.dim }}>{t('Care for MVP Shipaton, a simulated plant, and watch Rootera adapt. Nothing here touches your garden.')}</T>
          </View>
          <View style={{ flexGrow: 1 }} />
          <Primary title={t('Start')} onPress={() => { setScene(0); go('story'); }} />
        </>}

        {phase === 'story' && <>
          <Animated.View key={scene} entering={reduceMotion ? undefined : FadeIn.duration(motion.dur.slow)} style={{ gap: space[6] }}>
            {scene === 0 ? <WaterWeatherScene /> : <CyclesScene />}
            {!!SCENES[scene].title && <View style={{ gap: space[3] }}>
              <T v="hero" style={{ color: L.text }}>{t(SCENES[scene].title!)}</T>
              <T v="callout" style={{ color: L.dim }}>{t(SCENES[scene].line!)}</T>
              {!!SCENES[scene].note && <T v="footnote" style={{ color: L.faint }}>{t(SCENES[scene].note!)}</T>}
            </View>}
          </Animated.View>
          <View style={{ flexGrow: 1 }} />
          <Primary title={scene < SCENES.length - 1 ? t('Next') : t('Start the simulation')} onPress={() => scene < SCENES.length - 1 ? setScene(n => n + 1) : go('plant')} />
        </>}

        {phase === 'plant' && <>
          <StepHead n={0} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <PlantArt kind={kind} size={64} />
            <View style={{ flex: 1 }}>
              <T v="title" style={{ color: L.text }}>MVP Shipaton</T>
              <T v="subhead" style={{ color: L.dim }}>{name(kind)}</T>
            </View>
          </View>
          <Row label={t('Species')}>{KINDS.map(k => <Chip key={k} label={name(k)} on={kind === k} onPress={() => setKind(k)} />)}</Row>
          <Row label={t('Pot')}>{POTS.map(([v, l]) => <Chip key={v} label={t(l)} on={pot === v} onPress={() => setPot(v)} />)}</Row>
          <More>
            <Row label={t('Drainage hole')}>
              <Chip label={t('Has one')} on={drainage === 'Yes'} onPress={() => setDrainage('Yes')} />
              <Chip label={t('None')} on={drainage === 'No'} onPress={() => setDrainage('No')} />
            </Row>
            <Row label={t('Light')}>{LIGHTS.map(([v, l]) => <Chip key={v} label={t(l)} on={light === v} onPress={() => setLight(v)} />)}</Row>
            <Row label={t('Weather')}>{CLIMATES.map(([v, l]) => <Chip key={v} label={t(l)} on={climate === v} onPress={() => setClimate(v)} />)}</Row>
            <Row label={t('This plant, against a typical one')}>{PACES.map(([v, l]) => <Chip key={v} label={t(l)} on={pace === v} onPress={() => setPace(v)} />)}</Row>
          </More>
          <View style={{ flexGrow: 1 }} />
          <Primary title={t('Next')} onPress={() => go('method')} />
        </>}

        {phase === 'method' && <>
          <StepHead n={1} />
          <View style={{ gap: space[2] }}>
            {METHODS.filter(m => m.main).map(m => <Tap key={m.key} role="radio" selected={method === m.key} label={`${t(m.label)}. ${t(m.means)}`} onPress={() => { haptic.select(); setMethod(m.key); setOverrides({}); }} ring={radius.control}
              style={{ padding: space[4], borderRadius: radius.control, borderWidth: 1, borderColor: method === m.key ? L.text : L.line, backgroundColor: method === m.key ? L.raised : 'transparent', gap: 2 }}>
              <T v="headline" style={{ color: L.text }}>{t(m.label)}</T>
              {method === m.key && <T v="subhead" style={{ color: L.dim }}>{t(m.means)}</T>}
            </Tap>)}
          </View>
          <More>
            <Row label={t('Compare with')}>{METHODS.filter(m => !m.main).map(m => <Chip key={m.key} label={t(m.label)} on={method === m.key} onPress={() => { setMethod(m.key); setOverrides({}); }} />)}</Row>
            {(method === 'often' || method === 'forgetful') && <T v="subhead" style={{ color: L.dim }}>{t(methodInfo.means)}</T>}
            {method !== 'rootera' && <Row label={t('Soil checks')}>{[1, 2, 3].map(n => <Chip key={n} label={tn(n, 'Every day', 'Every {n} days')} on={checkEvery === n} onPress={() => setCheckEvery(n)} />)}</Row>}
            <Row label={t('Length')}>{LENGTHS.map(n => <Chip key={n} label={n === 91 ? t('3 months') : t('{n} weeks', { n: n / 7 })} on={length === n} onPress={() => setLength(n)} />)}</Row>
          </More>
          <View style={{ flexGrow: 1 }} />
          <Primary title={t('See the result')} onPress={() => { setDay(0); go('stage'); }} />
        </>}

        {phase === 'stage' && <>
          {/* What was chosen, in one line; Adjust goes back to the choices. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <PlantArt kind={kind} size={48} />
            <View style={{ flex: 1 }}>
              <T v="headline" style={{ color: L.text }}>MVP Shipaton</T>
              <T v="footnote" style={{ color: L.dim }} lines={1}>{`${name(kind)}, ${t(POTS.find(p => p[0] === pot)![1]).toLowerCase()}`}</T>
              <T v="footnote" style={{ color: L.dim }} lines={1}>{t(methodInfo.label)}</T>
            </View>
            <Tap label={t('Adjust')} onPress={() => go('plant')} ring={radius.input} style={{ minHeight: 40, paddingHorizontal: 13, borderRadius: radius.input, borderWidth: 1, borderColor: L.line, justifyContent: 'center' }}>
              <T v="subhead" style={{ color: L.text }}>{t('Adjust')}</T>
            </Tap>
          </View>

          <View style={{ gap: space[2] }}>
            <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ gap: 6 }}>
              {!!cell && out && Array.from({ length: Math.ceil(out.days.length / 7) }, (_, w) =>
                <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
                  {Array.from({ length: 7 }, (_, i) => w * 7 + i).filter(i => i < out.days.length).map(i =>
                    <DayCell key={i} day={i} d={out.days[i]} size={cell} selected={i === day} typed={!!overrides[i] && (overrides[i].layers != null || overrides[i].leaves != null)} onPress={() => tapDay(i)} />)}
                </View>)}
            </View>
            <T v="caption" style={{ color: L.faint }}>{t('Tap a day to see it.')}</T>
          </View>

          {!!now && <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Tap label={t('Previous day')} disabled={day === 0} onPress={() => { setPlaying(false); setDay(d => Math.max(0, d - 1)); setUsed(u => ({ ...u, forecast: true })); }} ring={22} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Glyph name="back" size={18} tone={L.text} /></Tap>
              <View style={{ flex: 1 }}>
                <T v="footnote" style={{ color: L.dim }}>{t('Day {n}', { n: day + 1 })}, {dateOf(day)}</T>
              </View>
              <Tap label={t('Next day')} disabled={!out || day >= out.days.length - 1} onPress={() => { setPlaying(false); setDay(d => Math.min((out?.days.length ?? 1) - 1, d + 1)); setUsed(u => ({ ...u, forecast: true })); }} ring={22} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Glyph name="forward" size={18} tone={L.text} /></Tap>
            </View>
            <DaySoil day={now} />
            <T v="title" style={{ color: L.text }}>{now.guidance.title}</T>
            <StageTimeline g={now.guidance} now={now.date + 'T20:00:00Z'} />
            <CycleDots n={now.guidance.completed_cycles} />
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Tap label={now.events.some(e => e.type === 'water') ? t('Take the watering back') : t('Water this day')} onPress={() => toggleWater(day)} ring={radius.input}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.input, borderWidth: 1, borderColor: L.water, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2] }}>
                <T v="subhead" center style={{ color: L.water }}>{now.events.some(e => e.type === 'water') ? t('Take the watering back') : t('Water this day')}</T>
              </Tap>
              <Tap label={t('Record soil and leaves')} onPress={() => setSheet(day)} ring={radius.input}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.input, borderWidth: 1, borderColor: L.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2] }}>
                <T v="subhead" center style={{ color: L.text }}>{t('Record soil and leaves')}</T>
              </Tap>
            </View>
            {now.stress && <T v="subhead" style={{ color: now.stress === 'wet' ? L.warn : L.bad }}>{now.stress === 'wet' ? t('The roots are sitting wet.') : t('The plant is thirsty.')}</T>}
          </View>}

          <Primary title={playing ? t('Pause') : (length === 91 ? t('Play 3 months') : t('Play {n} weeks', { n: length / 7 }))} onPress={() => { if (!playing && out && day >= out.days.length - 1) setDay(0); setPlaying(p => !p); setUsed(u => ({ ...u, forecast: true })); }} />

          {!!s && <View style={{ gap: space[3] }}>
            <T v="callout" style={{ color: L.text }}>{result}</T>
            <Tap label={learning ? t('Hide how it learned') : t('See how it learned')} onPress={() => setLearning(o => !o)} ring={radius.inner} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
              <T v="subhead" style={{ color: L.leaf, fontFamily: fonts.medium }}>{learning ? t('Hide how it learned') : t('See how it learned')}</T>
            </Tap>
            {learning && out && <Animated.View entering={reduceMotion ? undefined : enter.fade()} style={{ gap: space[4] }}>
              <Learning out={out} upTo={day} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                <Stat value={String(s.waterings)} label={t('Waterings')} />
                <Stat value={String(s.wet_days)} label={t('Days soggy')} tone={s.wet_days ? L.warn : L.text} />
                <Stat value={String(s.dry_days)} label={t('Days thirsty')} tone={s.dry_days ? L.bad : L.text} />
              </View>
            </Animated.View>}
          </View>}
          {!!error && <T v="subhead" style={{ color: L.bad }}>{t('Couldn’t simulate. {why}', { why: error })}</T>}
          <T v="footnote" style={{ color: L.faint }}>{t('Coming next: photos.')}</T>
        </>}
      </Animated.View>
    </ScrollView>
    {sheet !== null && out && <DaySheet day={sheet} date={out.days[sheet].date} value={overrides[sheet] ?? { day: sheet }}
      onClose={() => setSheet(null)} onSave={v => { edit(v); setSheet(null); }} />}
  </View>;
}
