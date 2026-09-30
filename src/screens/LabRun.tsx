/**
 * The lab's run, told step by step: what happened to the virtual plant, what Rootera would
 * do, and what changes when the tester waters on their own.
 *
 * - A timeline of the days: the soil at the depth that decides for this species, waterings
 *   (drops), checks (rings), where Rootera would water (diamonds, from the same plant run
 *   the Rootera way) and the drying window it predicts. Days ahead stay hidden.
 * - "Next step" moves to the next thing that happened; one sentence says what it was and
 *   what it did to the forecast. "Play" moves on by itself, slowly.
 * - "Water today" waters on the day being shown; the run is simulated again from there
 *   (Rootera keeps deciding the days after). The plant reacts: soggy roots, thirst, leaves.
 *   "Undo" takes the tester's last watering back.
 * - The numbers carry their origin: this virtual plant, and the guidance it was calibrated on.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LabDayIn, LabOut } from '../api';
import { Layer, LayerKey, PlantKind } from '../model';
import { enter } from '../ds/motion';
import { fonts, radius, space } from '../ds/tokens';
import { T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { haptic } from '../ds/feedback';
import { locale, t, tn } from '../i18n';

export const STAGE_L = {
  bg: '#060807', raised: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.14)', text: '#F4F6F2', dim: 'rgba(244,246,242,.64)',
  faint: 'rgba(244,246,242,.38)', leaf: '#B6E07C', water: '#86BCCB', warn: '#E8B86B', bad: '#E88A6B',
  soil: { dry: '#CDB690', moist: '#8A6242', wet: '#4A3322' } as Record<Layer, string>,
};
const L = STAGE_L;
const LAYER_VALUE: Record<Layer | 'unreached', string> = { dry: 'Dry', moist: 'Moist', wet: 'Wet', unreached: 'Couldn’t reach' };
const DEPTH: Record<LayerKey, string> = { top: 'at the surface', middle: 'about 5 cm down', bottom: 'through the whole pot' };
/** Where each species' drying times come from (docs/calibracao-shipaton.md). */
const SOURCE: Partial<Record<PlantKind, { who: string; rule: string }>> = {
  monstera: { who: 'UMN Extension and UConn', rule: 'water when the top 2.5–5 cm are dry, about every 7–14 days' },
  pothos: { who: 'Clemson HGIC', rule: 'let the top 2.5–5 cm dry, about every 7–10 days' },
  'peace-lily': { who: 'SDSU Extension', rule: 'water when the top 2.5–5 cm are dry, about once a week' },
  'snake-plant': { who: 'Virginia Tech (SPES-804)', rule: 'water when the whole pot is dry, every 2–3 weeks in summer' },
  aloe: { who: 'Virginia Tech (SPES-804)', rule: 'water when the whole pot is dry, every 2–3 weeks in summer' },
};
const CELL = 18, PAD = 12, STEP_MS = 2200;

type Day = LabOut['days'][number];
const waterOn = (d?: Day) => !!d?.events.some(e => e.type === 'water');
const checkOn = (d?: Day) => d?.events.find(e => e.type === 'check') as Extract<Day['events'][number], { type: 'check' }> | undefined;

/** The days worth stopping at: something happened, or the plant or the forecast changed. */
function stepDays(out: LabOut) {
  return out.days.filter((d, i) => {
    const prev = out.days[i - 1];
    return i === 0 || waterOn(d) || !!checkOn(d) || d.stress !== prev?.stress || d.leaves !== prev?.leaves
      || d.guidance.completed_cycles !== prev?.guidance.completed_cycles || i === out.days.length - 1;
  }).map(d => d.day);
}

/** The watering day before `day` in this run (or null). */
function lastWater(out: LabOut, day: number) {
  for (let i = day; i >= 0; i--) if (waterOn(out.days[i])) return i;
  return null;
}

export function LabRun({ out, reference, follows, name, reduceMotion, overrides, onWater, onUndo, mine, onUse }: {
  out: LabOut; reference: LabOut | null; follows: boolean; name: string; reduceMotion: boolean; overrides: Record<number, LabDayIn>;
  onWater: (day: number) => void; onUndo: () => void; mine: number[]; onUse: () => void;
}) {
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [why, setWhy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const last = out.days.length - 1;
  const steps = stepDays(out);
  const nextStep = steps.find(s => s > day) ?? last;
  const prevStep = [...steps].reverse().find(s => s < day) ?? 0;
  const layer = out.plant.decisive[out.plant.decisive.length - 1] as LayerKey;
  // Where Rootera would water: the untouched run up to the tester's first own watering and the
  // day Rootera would have watered instead; after that, what Rootera decides in this run.
  const planned = (reference?.days ?? []).filter(waterOn).map(d => d.day);
  const firstHand = mine.length ? Math.min(...mine) : Infinity;
  const instead = planned.find(p => p >= firstHand) ?? Infinity;
  const refWater = [...planned.filter(p => p <= instead),
    ...(follows && firstHand < Infinity ? out.days.filter(d => d.day > instead && waterOn(d) && !overrides[d.day]).map(d => d.day) : [])];
  const now = out.days[day], prev = out.days[day - 1];

  // Play moves on one step at a time, slowly enough to read.
  useEffect(() => {
    if (!playing) return;
    if (day >= last) { setPlaying(false); return; }
    const timer = setTimeout(() => setDay(nextStep), reduceMotion ? 1200 : STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, day, nextStep]);
  // The day being shown stays in view.
  useEffect(() => { if (width) scroll.current?.scrollTo({ x: Math.max(0, PAD + day * CELL - width / 2), animated: !reduceMotion }); }, [day, width]);

  const go = (d: number) => { haptic.select(); onUse(); setPlaying(false); setDay(Math.max(0, Math.min(last, d))); };

  // The window Rootera predicts for the current cycle, and the one before it when it just changed.
  const lw = lastWater(out, day);
  const f = now.guidance.forecast;
  const band = f && lw !== null ? [lw + f.low_days, lw + f.high_days] : null;
  const pf = prev?.guidance.forecast;
  const plw = prev ? lastWater(out, day - 1) : null;
  const changed = !!(f && pf && (f.low_days !== pf.low_days || f.high_days !== pf.high_days));
  const oldBand = changed && pf && plw !== null ? [plw + pf.low_days, plw + pf.high_days] : null;

  // What Rootera would have done around this day, from the run done its way.
  const userWatered = overrides[day]?.water === true;
  const refHere = refWater.includes(day);
  const nearestRef = (d: number) => planned.reduce<number | null>((b, r) => b === null || Math.abs(r - d) < Math.abs(b - d) ? r : b, null);

  const next = day >= firstHand
    ? (follows ? out.days.find(d => d.day > day && waterOn(d) && !overrides[d.day])?.day : undefined)
    : planned.find(p => p > day);
  // The sentence for this step.
  const check = checkOn(now);
  const lines: string[] = [];
  if (check) lines.push(t('Surface {a}, middle {b}, bottom {c}.', { a: t(LAYER_VALUE[check.layers.top]).toLowerCase(), b: t(LAYER_VALUE[check.layers.middle]).toLowerCase(), c: t(LAYER_VALUE[check.layers.bottom]).toLowerCase() }));
  if (waterOn(now)) {
    const r = nearestRef(day);
    lines.push(userWatered ? t('You watered.') : t('Watered.'));
    if (refHere) lines.push(t('That is the day Rootera would water.'));
    else if (r !== null && r > day) lines.push(tn(r - day, 'Rootera would have waited 1 more day.', 'Rootera would have waited {n} more days.'));
    else if (r !== null && r < day) lines.push(tn(day - r, 'Rootera would have watered 1 day earlier.', 'Rootera would have watered {n} days earlier.'));
  }
  const closed = prev && now.guidance.completed_cycles > prev.guidance.completed_cycles;
  if (closed) lines.push(t('A cycle closed: the soil dried in {n} days.', { n: fmt(now.guidance.cycle_days?.slice(-1)[0] ?? 0) }));
  // What Rootera recommends from here: its own next watering. Before the tester has watered by
  // hand, that is the untouched run; after, it is this run, if Rootera is the one deciding.
  if (!waterOn(now)) {
    const upcoming = next;
    if (upcoming !== undefined) lines.push(tn(upcoming - day, 'Rootera would water tomorrow.', 'Rootera would water in {n} days.'));
    else lines.push(t('Rootera: {title}.', { title: now.guidance.title }));
  }

  // How the plant is doing: streaks of soggy roots or thirst, and the leaves.
  const streak = (kind: 'wet' | 'dry') => { let n = 0; for (let i = day; i >= 0 && out.days[i].stress === kind; i--) n++; return n; };
  const chips: { text: string; tone: string }[] = [];
  if (now.stress === 'wet') chips.push({ text: tn(streak('wet'), 'Soggy for 1 day', 'Soggy for {n} days'), tone: L.warn });
  if (now.stress === 'dry') chips.push({ text: tn(streak('dry'), 'Thirsty for 1 day', 'Thirsty for {n} days'), tone: L.bad });
  if (now.leaves === 'different') chips.push({ text: t('Leaves changed'), tone: L.warn });
  if (now.leaves === 'unwell') chips.push({ text: t('Leaves struggling'), tone: L.bad });
  if (!chips.length && day > 0) chips.push({ text: t('Leaves fine'), tone: L.leaf });

  const cycles = now.guidance.completed_cycles;
  const learning = cycles >= 3 ? t('Pattern: recommendations from this plant') : cycles === 2 ? t('Getting specific: mixing the species and this plant') : t('Still analyzing your plant: species estimate');
  const source = SOURCE[out.plant.kind];
  const real = out.truth.real_cycle_days.length ? out.truth.real_cycle_days.reduce((a, b) => a + b, 0) / out.truth.real_cycle_days.length : out.truth.dry_after_days;
  const s = out.summary;
  const dateOf = (i: number) => new Date(out.days[i].date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const x = (d: number) => PAD + d * CELL;
  const label = userWatered && refHere ? t('You watered = Rootera would') : userWatered ? t('You watered') : refHere && day <= last ? t('Rootera would water here') : null;

  return <View style={{ gap: space[4] }}>
    {/* The timeline */}
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ borderRadius: radius.card, backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', paddingVertical: space[3] }}
      accessible accessibilityLabel={t('Day {n} of {total}. Soil {state} {depth}.', { n: day + 1, total: last + 1, state: t(LAYER_VALUE[now.soil[layer]]).toLowerCase(), depth: t(DEPTH[layer]) })}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: x(Math.max(last, band?.[1] ?? 0) + 1) + PAD, height: 128 }}>
        {oldBand && <View pointerEvents="none" style={{ position: 'absolute', left: x(oldBand[0]) - 2, width: (oldBand[1] - oldBand[0] + 1) * CELL + 2, bottom: 24, height: 44, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: L.faint }} />}
        {band && <View pointerEvents="none" style={{ position: 'absolute', left: x(band[0]) - 2, width: (band[1] - band[0] + 1) * CELL + 2, bottom: 24, height: 44, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: L.leaf, backgroundColor: 'rgba(182,224,124,.10)' }} />}
        {out.days.map(d => {
          const shown = d.day <= day;
          return <View key={d.day} pointerEvents="none" style={{ position: 'absolute', left: x(d.day), bottom: 0, width: CELL - 3, height: 128, alignItems: 'center' }}>
            {(refWater.includes(d.day) && d.day <= day || d.day === next || d.day === instead && day >= firstHand) && <View style={{ position: 'absolute', bottom: 84, width: 8, height: 8, transform: [{ rotate: '45deg' }], backgroundColor: L.leaf }} />}
            {shown && waterOn(d) && <View style={{ position: 'absolute', bottom: 66, width: 10, height: 12, borderRadius: 6, backgroundColor: L.water }} />}
            {shown && !waterOn(d) && !!checkOn(d) && <View style={{ position: 'absolute', bottom: 68, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: L.text }} />}
            <View style={{ position: 'absolute', bottom: 30, width: CELL - 3, height: 32, borderRadius: 3, backgroundColor: shown ? L.soil[d.soil[layer]] : 'rgba(255,255,255,.07)' }} />
            <T v="caption" style={{ position: 'absolute', bottom: 6, fontSize: 10, lineHeight: 12, color: d.day === day ? L.text : L.faint, fontVariant: ['tabular-nums'] }}>{d.day + 1}</T>
          </View>;
        })}
        <View pointerEvents="none" style={{ position: 'absolute', left: x(day) + (CELL - 3) / 2 - 1, bottom: 20, height: label ? 74 : 92, width: 2, backgroundColor: L.text }} />
        {!!label && <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(4, x(day) - 60), top: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: userWatered ? L.water : L.leaf }}>
          <T v="caption" style={{ color: L.bg, fontFamily: fonts.medium }}>{label}</T>
        </View>}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingHorizontal: space[3], paddingTop: space[1] }}>
        {(['wet', 'moist', 'dry'] as Layer[]).map(k => <Key key={k} swatch={<View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: L.soil[k] }} />} text={t(LAYER_VALUE[k])} />)}
        <Key swatch={<View style={{ width: 8, height: 10, borderRadius: 4, backgroundColor: L.water }} />} text={t('watering')} />
        <Key swatch={<View style={{ width: 7, height: 7, transform: [{ rotate: '45deg' }], backgroundColor: L.leaf }} />} text={t('Rootera would water')} />
        <Key swatch={<View style={{ width: 14, height: 9, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: L.leaf }} />} text={t('window')} />
      </View>
    </View>

    {/* This step, in a sentence */}
    <Animated.View key={day + '-' + (waterOn(now) ? 'w' : '')} entering={reduceMotion ? undefined : enter.fade()} style={{ gap: space[3] }}>
      <T v="footnote" style={{ color: L.dim }}>{t('Day {n}', { n: day + 1 })}, {dateOf(day)}</T>
      <T v="callout" style={{ color: L.text }}>{lines.join(' ')}</T>
      {changed && !!f && !!pf && <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
        <T v="subhead" style={{ color: L.faint, textDecorationLine: 'line-through' }}>{t('{a}–{b} days', { a: pf.low_days, b: pf.high_days })}</T>
        <Glyph name="forward" size={14} tone={L.leaf} />
        <T v="subhead" style={{ color: L.text, fontFamily: fonts.medium }}>{t('dries {a}–{b} days after watering', { a: f.low_days, b: f.high_days })}</T>
      </View>}
      {!changed && !!f && <T v="subhead" style={{ color: L.dim }}>{t('Forecast: dries {a}–{b} days after watering.', { a: f.low_days, b: f.high_days })}</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {chips.map(c => <View key={c.text} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.input, backgroundColor: 'rgba(255,255,255,.06)' }}><T v="footnote" style={{ color: c.tone, fontFamily: fonts.medium }}>{c.text}</T></View>)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {[0, 1, 2].map(i => <View key={i} style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: L.text, backgroundColor: i < Math.min(3, cycles) ? L.text : 'transparent' }} />)}
        <T v="footnote" style={{ color: L.dim, flex: 1 }}>{learning}</T>
      </View>
    </Animated.View>

    {/* The end of the run */}
    {day >= last && <View style={{ gap: space[2], padding: space[4], borderRadius: radius.control, backgroundColor: L.raised }}>
      <T v="headline" style={{ color: L.text }}>{t('End of the run')}</T>
      <T v="subhead" style={{ color: L.dim }}>{s.cycles >= 3 && s.learned_days != null
        ? t('Rootera learned {a} days; this virtual plant really takes {b}.', { a: fmt(s.learned_days), b: fmt(real) })
        : s.cycles === 0 ? t('No cycle closed: the soil was never found dry after a watering, so Rootera keeps its general estimate.')
        : tn(s.cycles, 'One cycle so far. Rootera mixes it with the general estimate.', '{n} cycles so far. Rootera mixes them with the general estimate.')}</T>
      <T v="subhead" style={{ color: s.wet_days || s.dry_days ? L.warn : L.dim }}>{t('{w} days soggy, {d} days thirsty.', { w: s.wet_days, d: s.dry_days })}</T>
    </View>}

    {/* Controls */}
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label={t('Previous step')} onPress={() => go(prevStep)} disabled={day === 0} style={{ flex: .45 }}><Glyph name="back" size={18} tone={L.text} /></Button>
        <Button label={day >= last ? t('Start the run again') : t('Next step')} onPress={() => go(day >= last ? 0 : nextStep)} main style={{ flex: 1 }}>
          <T v="headline" style={{ color: L.bg }}>{day >= last ? t('Start the run again') : t('Next step')}</T>
        </Button>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label={t('Water today')} disabled={waterOn(now) || day >= last} onPress={() => { haptic.success(); onUse(); setPlaying(false); onWater(day); }} tone={L.water} style={{ flex: 1 }}>
          <T v="subhead" style={{ color: L.water, fontFamily: fonts.medium }}>{t('Water today')}</T>
        </Button>
        <Button label={playing ? t('Pause') : t('Play')} disabled={day >= last} onPress={() => { onUse(); setPlaying(p => !p); }} style={{ flex: 1 }}>
          <T v="subhead" style={{ color: L.text, fontFamily: fonts.medium }}>{playing ? t('Pause') : t('Play')}</T>
        </Button>
      </View>
      {mine.length > 0 && <Tap label={t('Undo my watering on day {n}', { n: mine[mine.length - 1] + 1 })} onPress={onUndo} ring={radius.inner} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
        <T v="subhead" style={{ color: L.water }}>{t('Undo my watering on day {n}', { n: mine[mine.length - 1] + 1 })}</T>
      </Tap>}
    </View>

    {/* Where the numbers come from */}
    <View style={{ gap: space[2], borderTopWidth: 1, borderColor: 'rgba(255,255,255,.1)', paddingTop: space[3] }}>
      <T v="footnote" style={{ color: L.dim }}>{t('In this simulation the virtual {name} dries {depth} in about {n} days.', { name: name.toLowerCase(), depth: t(DEPTH[layer]), n: fmt(real) })}
        {source ? ' ' + t('Calibrated on {who}: {rule}.', { who: t(source.who), rule: t(source.rule) }) : ''}</T>
      <Tap label={why ? t('Hide') : t('Where do these numbers come from?')} onPress={() => setWhy(w => !w)} ring={radius.inner} style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' }}>
        <T v="footnote" style={{ color: L.leaf, fontFamily: fonts.medium }}>{why ? t('Hide') : t('Where do these numbers come from?')}</T>
      </Tap>
      {why && <T v="footnote" style={{ color: L.dim }}>{t('The virtual plant dries layer by layer: the surface in {a} days, the middle in {b}, the bottom in {c}, adjusted for its pot and light. Rootera never sees these numbers: it only gets the checks, like with a real plant. Sources and the 48-run validation are in the project’s calibration notes.', { a: fmt(out.truth.layer_days.top), b: fmt(out.truth.layer_days.middle), c: fmt(out.truth.layer_days.bottom) })}</T>}
    </View>
  </View>;
}

const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });

function Key({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{swatch}<T v="caption" style={{ color: L.dim }}>{text}</T></View>;
}

function Button({ label, onPress, disabled, main, tone, style, children }: React.PropsWithChildren<{ label: string; onPress: () => void; disabled?: boolean; main?: boolean; tone?: string; style?: object }>) {
  return <Tap label={label} onPress={onPress} disabled={disabled} ring={radius.control}
    style={[{ minHeight: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2], opacity: disabled ? .4 : 1,
      backgroundColor: main ? L.text : 'transparent', borderWidth: main ? 0 : 1, borderColor: tone ?? L.line }, style]}>{children}</Tap>;
}
