/**
 * The Shipaton lab: a test bench made only for the Shipaton judges and testers.
 *
 * A guided start, then a stage. It opens in low light on the welcome and four white
 * circles (the plant, the watering method, the run, the forecast), one white line each
 * on what the step does to the forecast. Two short choices follow (the plant, how it is
 * watered), one screen each, with the rest behind "More options". Then the stage: the run
 * told step by step, with "Water today" to try it by hand (LabRun.tsx). The light comes up
 * step by step.
 *
 * Everything is simulated by the backend (backend/app/lab.py): a virtual plant, "MVP
 * Shipaton", and a simulated caregiver whose records go through the REAL guidance engine.
 * The same plant is also run the Rootera way, untouched, to show where Rootera would water.
 *
 * Weather and photos have their place here and in the API; they are not simulated yet.
 * The lab has its own dark palette: it is a stage, not a page of the app.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Props } from '../navigation';
import { api, LabClimate, LabDayIn, LabIn, LabMethod, LabOut } from '../api';
import { catalog, PlantKind, speciesName } from '../model';
import { useTheme } from '../ds/theme';
import { enter } from '../ds/motion';
import { fonts, motion, radius, space } from '../ds/tokens';
import { T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { PlantArt } from '../ds/plant';
import { haptic } from '../ds/feedback';
import { CyclesScene, WaterWeatherScene } from './LabStory';
import { LabRun, STAGE_L as L } from './LabRun';
import { t, tn } from '../i18n';

/* ------------------------------------------------------------------ the stage */

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
  { key: 'manual', main: true, label: 'I pick the days', means: 'Nothing is watered for you: step through the days and press Water today.' },
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
const STEPS = [
  { title: 'The plant', means: 'Species, pot and light set the first estimate.' },
  { title: 'The watering method', means: 'How you water decides whether Rootera can learn.' },
  { title: 'The run', means: 'Step through what happened, and water when you think it’s time.' },
  { title: 'The forecast', means: 'Watch the drying window fit this plant, step by step.' },
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
  // The tester's own waterings on the stage, in the order they were added (for Undo).
  const [mine, setMine] = useState<number[]>([]);
  const [out, setOut] = useState<LabOut | null>(null);
  const [reference, setReference] = useState<LabOut | null>(null);
  const [error, setError] = useState('');
  // On the stage, the last circle fills once the run is used.
  const [used, setUsed] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const go = (p: Phase) => { setPhase(p); scroll.current?.scrollTo({ y: 0, animated: false }); };

  // Every change runs the simulation again (debounced), through the real engine.
  const body: LabIn = { kind, pot, drainage, light, pace, climate, method, days: length, check_every: checkEvery, overrides: Object.values(overrides).filter(o => o.day < length) };
  const key = JSON.stringify(body);
  // The same plant run the Rootera way with no hand waterings: where Rootera would water.
  const own = method === 'rootera' && !body.overrides.length;
  const refKey = JSON.stringify({ ...body, method: 'rootera', overrides: [] });
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const [r, ref] = await Promise.all([api.labSimulate(body), own ? null : api.labSimulate({ ...body, method: 'rootera', overrides: [] })]);
        if (live) { setOut(r); setReference(ref ?? r); setError(''); }
      } catch (e) { if (live) setError(e instanceof Error ? e.message : t('Could not simulate.')); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [key, refKey]);

  // "Water today" adds the tester's watering to the run; the method decides the days after.
  const water = (d: number) => { setOverrides(o => ({ ...o, [d]: { day: d, water: true } })); setMine(m => [...m.filter(x => x !== d), d]); };
  const undo = () => {
    const d = mine[mine.length - 1];
    if (d === undefined) return;
    haptic.select();
    setOverrides(o => { const next = { ...o }; delete next[d]; return next; });
    setMine(m => m.slice(0, -1));
  };
  const reset = () => { setOverrides({}); setMine([]); };

  const at = phase === 'intro' || phase === 'story' ? -1 : phase === 'plant' ? 0 : phase === 'method' ? 1 : used ? 3 : 2;
  const name = (k: PlantKind) => speciesName(catalog.find(c => c.kind === k)!);
  const methodInfo = METHODS.find(m => m.key === method)!;
  const back = () => phase === 'intro' ? navigation.goBack() : phase === 'story' && scene > 0 ? setScene(n => n - 1) : go(PHASES[PHASES.indexOf(phase) - 1]);

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
            {METHODS.filter(m => m.main).map(m => <Tap key={m.key} role="radio" selected={method === m.key} label={`${t(m.label)}. ${t(m.means)}`} onPress={() => { haptic.select(); setMethod(m.key); reset(); }} ring={radius.control}
              style={{ padding: space[4], borderRadius: radius.control, borderWidth: 1, borderColor: method === m.key ? L.text : L.line, backgroundColor: method === m.key ? L.raised : 'transparent', gap: 2 }}>
              <T v="headline" style={{ color: L.text }}>{t(m.label)}</T>
              {method === m.key && <T v="subhead" style={{ color: L.dim }}>{t(m.means)}</T>}
            </Tap>)}
          </View>
          <More>
            <Row label={t('Compare with')}>{METHODS.filter(m => !m.main).map(m => <Chip key={m.key} label={t(m.label)} on={method === m.key} onPress={() => { setMethod(m.key); reset(); }} />)}</Row>
            {(method === 'often' || method === 'forgetful') && <T v="subhead" style={{ color: L.dim }}>{t(methodInfo.means)}</T>}
            {method !== 'rootera' && <Row label={t('Soil checks')}>{[1, 2, 3].map(n => <Chip key={n} label={tn(n, 'Every day', 'Every {n} days')} on={checkEvery === n} onPress={() => setCheckEvery(n)} />)}</Row>}
            <Row label={t('Length')}>{LENGTHS.map(n => <Chip key={n} label={n === 91 ? t('3 months') : t('{n} weeks', { n: n / 7 })} on={length === n} onPress={() => setLength(n)} />)}</Row>
          </More>
          <View style={{ flexGrow: 1 }} />
          <Primary title={t('See the run')} onPress={() => go('stage')} />
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

          {out ? <LabRun key={JSON.stringify({ ...body, overrides: [] })} out={out} reference={reference} follows={method === 'rootera'} name={name(kind)} reduceMotion={reduceMotion} overrides={overrides}
            onWater={water} onUndo={undo} mine={mine} onUse={() => setUsed(true)} />
            : !error && <T v="subhead" style={{ color: L.dim }}>{t('Running the simulation…')}</T>}
          {!!error && <T v="subhead" style={{ color: L.bad }}>{t('Couldn’t simulate. {why}', { why: error })}</T>}
          <T v="footnote" style={{ color: L.faint }}>{t('Coming next: photos.')}</T>
        </>}
      </Animated.View>
    </ScrollView>
  </View>;
}
