/**
 * The Shipaton lab: a test bench made only for the Shipaton judges and testers.
 *
 * The screen opens in low light; four white circles mark the steps (the plant, the watering
 * method, the calendar, the forecast), each with one white line saying what it does to the
 * forecast. The light comes up as the steps are touched. Everything below is simulated by
 * the backend (backend/app/lab.py): a virtual plant, "MVP Shipaton", and a simulated
 * caregiver whose records go through the REAL guidance engine, day by day.
 *
 * Calendar: a tap waters that day (or takes the watering back); a double tap opens the
 * day, where a soil check (three layers) and a leaf note can be typed in. The day bar
 * steps through the simulation, or plays it, so the forecast can be watched adapting.
 *
 * Weather and photos have their place here and in the API; they are not simulated yet.
 * The lab has its own dark palette: it is a stage, not a page of the app.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Props } from '../navigation';
import { api, LabDayIn, LabIn, LabMethod, LabOut } from '../api';
import { catalog, Layer, LayerKey, PlantKind, SoilLayers, speciesName } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { PlantArt } from '../ds/plant';
import { haptic } from '../ds/feedback';
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
const LENGTHS = [28, 42, 56] as const;
const METHODS: { key: LabMethod; label: string; means: string }[] = [
  { key: 'rootera', label: 'As Rootera suggests', means: 'Checks before watering and waters when the right layer is dry. This is how Rootera learns.' },
  { key: 'weekly', label: 'Every week', means: 'A fixed calendar. Watering before it dries hides the cycle from Rootera.' },
  { key: 'often', label: 'Every 3 days', means: 'Too much water: the bottom never breathes, and the leaves feel it.' },
  { key: 'forgetful', label: 'Every 14 days', means: 'Too little water: plants that drink from the top go thirsty.' },
  { key: 'manual', label: 'My own days', means: 'You pick the days on the calendar.' },
];
const LAYERS: LayerKey[] = ['top', 'middle', 'bottom'];
const LAYER_NAME: Record<LayerKey, string> = { top: 'Surface', middle: 'Middle', bottom: 'Bottom' };
const LAYER_VALUE: Record<Layer | 'unreached', string> = { dry: 'Dry', moist: 'Moist', wet: 'Wet', unreached: 'Couldn’t reach' };
const LEAVES = [['great', 'Looks good'], ['different', 'Something changed'], ['unwell', 'Not doing well']] as const;
/** Not simulated yet: their place in the lab, and what they will change. */
const COMING = [
  ['Weather', 'Local heat and humidity will shift the window: hot, dry days dry the soil sooner.'],
  ['Photos', 'A photo will record the leaves for you, as its own source.'],
] as const;
const STEPS = [
  { title: 'The plant', means: 'Species, pot and light set the first estimate.' },
  { title: 'The watering method', means: 'How you water decides whether Rootera can learn.' },
  { title: 'The calendar', means: 'Tap a day to water. Double tap to record soil and leaves.' },
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

/** A step: its white circle (hollow until touched), the title and what it implies. */
function Step({ n, done, children }: React.PropsWithChildren<{ n: number; done: boolean }>) {
  const s = STEPS[n];
  return <View style={{ gap: space[4] }}>
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: L.text, backgroundColor: done ? L.text : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <T v="footnote" style={{ color: done ? L.bg : L.text, fontFamily: fonts.medium }}>{n + 1}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title2" style={{ color: L.text }}>{t(s.title)}</T>
        <T v="subhead" style={{ color: L.dim }}>{t(s.means)}</T>
      </View>
    </View>
    {children}
  </View>;
}

/** Light that comes up as the steps are done. */
function Glow({ level }: { level: number }) {
  const v = useSharedValue(.15);
  useEffect(() => { v.value = withTiming(.15 + .85 * level, { duration: 900 }); }, [level]);
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

export function Lab({ navigation }: Props<'Lab'>) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useTheme();
  const [kind, setKind] = useState<PlantKind>('monstera');
  const [pot, setPot] = useState<LabIn['pot']>('Medium pot');
  const [drainage, setDrainage] = useState<LabIn['drainage']>('Yes');
  const [light, setLight] = useState<LabIn['light']>('Bright indirect light');
  const [pace, setPace] = useState(1);
  const [method, setMethod] = useState<LabMethod>('rootera');
  const [length, setLength] = useState<number>(42);
  const [checkEvery, setCheckEvery] = useState(2);
  const [overrides, setOverrides] = useState<Record<number, LabDayIn>>({});
  const [out, setOut] = useState<LabOut | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState<number | null>(null);
  const [touched, setTouched] = useState([false, false, false, false]);
  const touch = (i: number) => setTouched(s => s.map((v, j) => v || j === i));
  const [width, setWidth] = useState(0);

  // Every change runs the simulation again (debounced), through the real engine.
  const body: LabIn = { kind, pot, drainage, light, pace, method, days: length, check_every: checkEvery, overrides: Object.values(overrides).filter(o => o.day < length) };
  const key = JSON.stringify(body);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try { const r = await api.labSimulate(body); if (live) { setOut(r); setError(''); setDay(d => Math.min(d, r.days.length - 1)); } }
      catch (e) { if (live) setError(e instanceof Error ? e.message : t('Could not simulate.')); }
      finally { if (live) setBusy(false); }
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

  // A tap waters the day (or takes it back); a second tap within 300 ms opens the day instead.
  const lastTap = useRef<{ day: number; at: number } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapDay = (d: number) => {
    setDay(d); touch(2);
    const now = Date.now();
    if (lastTap.current && lastTap.current.day === d && now - lastTap.current.at < 300) {
      if (pending.current) clearTimeout(pending.current);
      lastTap.current = null;
      setSheet(d);
      return;
    }
    lastTap.current = { day: d, at: now };
    pending.current = setTimeout(() => { lastTap.current = null; toggleWater(d); }, 300);
  };
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
  const toggleWater = (d: number) => {
    haptic.select();
    edit({ day: d, water: !out?.days[d]?.events.some(e => e.type === 'water') });
  };

  const doneSteps = touched.filter(Boolean).length;
  const cell = width ? Math.floor((width - 6 * 6) / 7) : 0;
  const now = out?.days[day];
  const truthDays = out?.truth.dry_after_days;
  const methodInfo = METHODS.find(m => m.key === method)!;
  const dateOf = (i: number) => out ? new Date(out.days[i].date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const s = out?.summary;
  const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });

  return <View style={{ flex: 1, backgroundColor: L.bg }}>
    <Glow level={doneSteps / 4} />
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + space[3], paddingBottom: insets.bottom + space[8], paddingHorizontal: space.gutter, gap: space[8] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tap label={t('Close')} onPress={() => navigation.goBack()} ring={22} style={{ width: 44, height: 44, justifyContent: 'center' }}><Glyph name="close" size={20} tone={L.text} /></Tap>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, borderWidth: 1, borderColor: L.line }}><T v="caption" style={{ color: L.dim }}>{t('Shipaton lab')}</T></View>
      </View>

      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(900)} style={{ gap: space[3] }}>
        <T v="hero" style={{ color: L.text }}>{t('Welcome. This is a test interface made only for Shipaton.')}</T>
        <T v="callout" style={{ color: L.dim }}>{t('Care for MVP Shipaton, a simulated plant, and watch Rootera adapt. Nothing here touches your garden.')}</T>
      </Animated.View>

      {/* How it works: the four steps at a glance. */}
      <View style={{ gap: space[3] }}>
        <T v="footnote" style={{ color: L.dim }}>{t('How it works')}</T>
        {STEPS.map((st, i) => <View key={i} style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: L.text, backgroundColor: touched[i] ? L.text : 'transparent' }} />
          <T v="subhead" style={{ color: L.text, flex: 1 }}>{t(st.title)}<T v="subhead" style={{ color: L.dim }}>{'  ' + t(st.means)}</T></T>
        </View>)}
      </View>

      <Step n={0} done={touched[0]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <PlantArt kind={kind} size={72} />
          <View style={{ flex: 1 }}>
            <T v="title" style={{ color: L.text }}>MVP Shipaton</T>
            <T v="subhead" style={{ color: L.dim }}>{speciesName(catalog.find(c => c.kind === kind)!)}</T>
          </View>
        </View>
        <Row label={t('Species')}>{KINDS.map(k => <Chip key={k} label={speciesName(catalog.find(c => c.kind === k)!)} on={kind === k} onPress={() => { setKind(k); touch(0); }} />)}</Row>
        <Row label={t('Pot')}>{POTS.map(([v, l]) => <Chip key={v} label={t(l)} on={pot === v} onPress={() => { setPot(v); touch(0); }} />)}</Row>
        <Row label={t('Drainage hole')}>
          <Chip label={t('Has one')} on={drainage === 'Yes'} onPress={() => { setDrainage('Yes'); touch(0); }} />
          <Chip label={t('None')} on={drainage === 'No'} onPress={() => { setDrainage('No'); touch(0); }} />
        </Row>
        <Row label={t('Light')}>{LIGHTS.map(([v, l]) => <Chip key={v} label={t(l)} on={light === v} onPress={() => { setLight(v); touch(0); }} />)}</Row>
        <Row label={t('This plant, against a typical one')}>{PACES.map(([v, l]) => <Chip key={v} label={t(l)} on={pace === v} onPress={() => { setPace(v); touch(0); }} />)}</Row>
        {!!out && <T v="subhead" style={{ color: L.text }}>{t('In this simulation, the layers that decide dry in {n} days. Rootera doesn’t know that yet.', { n: fmt(truthDays!) })}</T>}
      </Step>

      <Step n={1} done={touched[1]}>
        <Row label={t('Method')}>{METHODS.map(m => <Chip key={m.key} label={t(m.label)} on={method === m.key} onPress={() => { setMethod(m.key); if (m.key !== 'manual') setOverrides({}); touch(1); }} />)}</Row>
        <T v="subhead" style={{ color: L.text }}>{t(methodInfo.means)}</T>
        {method !== 'rootera' && <Row label={t('Soil checks')}>{[1, 2, 3].map(n => <Chip key={n} label={tn(n, 'Every day', 'Every {n} days')} on={checkEvery === n} onPress={() => { setCheckEvery(n); touch(1); }} />)}</Row>}
        <Row label={t('Length')}>{LENGTHS.map(n => <Chip key={n} label={t('{n} weeks', { n: n / 7 })} on={length === n} onPress={() => { setLength(n); touch(1); }} />)}</Row>
      </Step>

      <Step n={2} done={touched[2]}>
        <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ gap: 6 }}>
          {!!cell && out && Array.from({ length: Math.ceil(out.days.length / 7) }, (_, w) =>
            <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: 7 }, (_, i) => w * 7 + i).filter(i => i < out.days.length).map(i =>
                <DayCell key={i} day={i} d={out.days[i]} size={cell} selected={i === day} typed={!!overrides[i] && (overrides[i].layers != null || overrides[i].leaves != null)} onPress={() => tapDay(i)} />)}
            </View>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          <Legend swatch={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: L.water }} />} text={t('Watered')} />
          <Legend swatch={<View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: L.text }} />} text={t('Soil check')} />
          <Legend swatch={<View style={{ width: 8, gap: 1 }}>{(['dry', 'moist', 'wet'] as Layer[]).map(v => <View key={v} style={{ height: 3, backgroundColor: L.soil[v] }} />)}</View>} text={t('Soil: surface, middle, bottom')} />
          <Legend swatch={<View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: L.warn }} />} text={t('Leaves changed')} />
        </View>
      </Step>

      <Step n={3} done={touched[3]}>
        {/* The day bar: step through the days, or play them. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Tap label={t('Previous day')} disabled={day === 0} onPress={() => { setPlaying(false); setDay(d => Math.max(0, d - 1)); touch(3); }} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="back" size={20} tone={L.text} /></Tap>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="headline" style={{ color: L.text }}>{t('Day {n}', { n: day + 1 })}</T>
            <T v="caption" style={{ color: L.dim }}>{dateOf(day)}</T>
          </View>
          <Tap label={t('Next day')} disabled={!out || day >= out.days.length - 1} onPress={() => { setPlaying(false); setDay(d => Math.min((out?.days.length ?? 1) - 1, d + 1)); touch(3); }} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="forward" size={20} tone={L.text} /></Tap>
          <Tap label={playing ? t('Pause') : t('Play')} onPress={() => { if (!playing && out && day >= out.days.length - 1) setDay(0); setPlaying(p => !p); touch(3); }} ring={radius.input}
            style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.input, backgroundColor: L.text, justifyContent: 'center' }}>
            <T v="subhead" style={{ color: L.bg, fontFamily: fonts.medium }}>{playing ? t('Pause') : t('Play')}</T>
          </Tap>
        </View>

        {!!now && <View style={{ gap: space[3], padding: space[4], borderRadius: radius.card, backgroundColor: L.raised }}>
          <T v="footnote" style={{ color: L.dim }}>{t('What Rootera says that evening')}</T>
          <T v="title" style={{ color: L.text }}>{now.guidance.title}</T>
          <StageTimeline g={now.guidance} now={now.date + 'T20:00:00Z'} />
          <T v="subhead" style={{ color: L.dim }}>{now.guidance.reason}</T>
          {now.stress && <T v="subhead" style={{ color: now.stress === 'wet' ? L.warn : L.bad }}>{now.stress === 'wet' ? t('The roots are sitting wet.') : t('The plant is thirsty.')}</T>}
        </View>}

        {!!out && <Learning out={out} upTo={day} />}
        {!!out && <T v="subhead" style={{ color: L.text }}>{s!.cycles >= 3
          ? t('After {n} cycles, Rootera expects dry soil about {learned} days after watering. The plant really takes {truth} days.', { n: s!.cycles, learned: fmt(s!.learned_days ?? 0), truth: fmt(truthDays!) })
          : s!.cycles === 0 ? t('No cycle closed: the soil was never found dry after a watering, so Rootera keeps its general estimate.')
          : tn(s!.cycles, 'One cycle so far. Rootera mixes it with the general estimate.', '{n} cycles so far. Rootera mixes them with the general estimate.')}</T>}
        {!!s && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <Stat value={String(s.waterings)} label={t('Waterings')} />
          <Stat value={String(s.checks)} label={t('Soil checks')} />
          <Stat value={s.error_days == null ? '–' : t('{n} d', { n: fmt(s.error_days) })} label={t('Off by')} />
          <Stat value={String(s.wet_days)} label={t('Days soggy')} tone={s.wet_days ? L.warn : L.text} />
          <Stat value={String(s.dry_days)} label={t('Days thirsty')} tone={s.dry_days ? L.bad : L.text} />
          <Stat value={String(s.unwell_days)} label={t('Days unwell')} tone={s.unwell_days ? L.bad : L.text} />
        </View>}
        {!!error && <T v="subhead" style={{ color: L.bad }}>{t('Couldn’t simulate. {why}', { why: error })}</T>}
        {busy && !out && <T v="subhead" style={{ color: L.dim }}>{t('Simulating…')}</T>}
      </Step>

      {/* Room kept for what comes next. */}
      <View style={{ gap: space[3] }}>
        <T v="footnote" style={{ color: L.dim }}>{t('Coming next')}</T>
        {COMING.map(([title, text]) =>
          <View key={title} style={{ flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: L.line, borderStyle: 'dashed' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: L.faint, marginTop: 4 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="headline" style={{ color: L.dim }}>{t(title)}</T>
              <T v="subhead" style={{ color: L.faint }}>{t(text)}</T>
            </View>
          </View>)}
      </View>
    </ScrollView>
    {sheet !== null && out && <DaySheet day={sheet} date={out.days[sheet].date} value={overrides[sheet] ?? { day: sheet }}
      onClose={() => setSheet(null)} onSave={v => { edit(v); setSheet(null); }} />}
  </View>;
}
