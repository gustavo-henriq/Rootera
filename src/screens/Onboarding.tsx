/**
 * First run:
 *  1. Opening: a seed drops into a pot, the wordmark sprouts, and "Get started"
 *     dives into the soil (automatic, see onboarding/Opening).
 *  2. How Rootera learns (a plant that grows as you tap) and your experience.
 *  3. Your first plant, one note at a time; it is planted and celebrated.
 *  4. The payoff: what Rootera now knows and its first suggestion.
 *  5. Nudges, asked only now that their value is obvious, with the phone permission.
 * No name and no account here: both are asked later, once the garden has value.
 * Every step answers a touch; progress is a seed filling up. Nothing here is a paywall,
 * and identifying a plant from a photo is free.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props } from '../navigation';
import { useStore } from '../store';
import { api, ApiError, Candidate } from '../api';
import { track } from '../analytics';
import { photoData } from './Camera';
import { Experience, newId, NudgeKind, Plant } from '../model';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { SeedDrop } from '../ds/SeedDrop';
import { revealDuration, TextReveal } from '../ds/TextReveal';
import { Opening } from './onboarding/Opening';
import { SoilReveal } from './onboarding/Soil';
import { Story } from './onboarding/Story';
import { NudgePicker, requestNudgePermission } from './onboarding/Nudges';
import { Answers, Choice, currentSlot, FirstPlant, IdState, LIGHT, POTS, Slot, SOILS, STAGES, WATERED } from './onboarding/FirstPlant';
import { KnownRow, PlanReveal } from './onboarding/PlanReveal';
import { Atmosphere, experiences, GlassChoice, SeedProgress } from './onboarding/shared';


const TOTAL = 4;
const SOIL_LIFT = 800; // the soil from the opening lifts away before the story starts
const STEP_NAMES = ['opening', 'story', 'experience', 'plant', 'nudges'];

export function Onboarding({ navigation, route }: Props<'Welcome'>) {
  // Preview replays the whole flow from You; it saves nothing and returns there.
  const [preview] = useState(!!route.params?.preview);
  const photo = route.params?.photo;
  const { garden, saveProfile, addPlant, logCare } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'steps' | 'celebrate' | 'plan'>('steps');
  const [dived, setDived] = useState(false);
  const [width, setWidth] = useState(0);
  const [storyDone, setStoryDone] = useState(false);
  const [experience, setExperience] = useState<Experience | ''>(garden.caregiver?.experience ?? '');
  // Only the essential nudge starts on, marked as recommended; everything else is opt-in.
  const [nudges, setNudges] = useState<NudgeKind[]>(['soil_check']);
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [editing, setEditing] = useState<Slot | null>(null);
  const [idState, setIdState] = useState<IdState>('idle');
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leftCelebration = useRef(false);
  const ids = useRef({ plant: newId('plant'), soil: newId('care'), water: newId('water'), soilAt: '' });
  const t = (name: string, props: Record<string, string | number | boolean> = {}) => { if (!preview) track(name, props); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (phase === 'steps' && step > 1 && step < 4 && !busy) { setStep(step - 1); return true; } return false; });
    return () => sub.remove();
  }, [step, busy, phase]);

  // Funnel: one "viewed" per step, so drop-off can be read per step.
  useEffect(() => { if (phase === 'steps') t('onboarding_step_viewed', { step: STEP_NAMES[step] }); }, [step, phase]);
  useEffect(() => { if (phase === 'plan') t('onboarding_step_viewed', { step: 'plan' }); }, [phase]);

  // A photo from the camera: identify it (free), and keep it as the plant's picture.
  useEffect(() => {
    if (!photo) return;
    const data = photoData.get(photo);
    if (!garden.integrations.identification || !data) { setIdState('off'); setMatches(null); return; }
    let live = true;
    setIdState('loading');
    api.identify(data).then(r => { if (live) { setMatches(r.results); setIdState('idle'); } }).catch(() => live && setIdState('error'));
    return () => { live = false; };
  }, [photo]);

  // Experience sets the default tone; the person can still change it on the nudges step.
  const chooseExperience = (e: Experience) => { setExperience(e); setDetail(e === 'many' ? 'Concise' : 'Guided'); };
  const answer = (s: Slot, i: number) => { setAnswers(a => ({ ...a, [s]: i })); setEditing(null); };
  const kind = choice?.kind ?? null;
  const plantReady = !!kind && currentSlot(answers, editing) === null;
  const soilValue = answers.soil !== undefined ? SOILS[answers.soil].value : 'not_sure';

  const next = () => {
    t('onboarding_step_completed', { step: STEP_NAMES[step] });
    setDived(false);
    setStep(step + 1);
  };
  const skip = () => {
    t('onboarding_step_skipped', { step: STEP_NAMES[step] });
    setDived(false);
    setStep(step + 1);
  };

  /** Plants the first plant. The profile is marked onboarded here, so the plant is never planted twice. */
  const plant = async () => {
    if (busy || !choice) return;
    t('onboarding_step_completed', { step: 'plant' });
    t('first_plant_added', { kind: choice.kind, via: choice.via, photo: !!photo, soil_checked: soilValue !== 'not_sure' });
    if (preview) { setPhase('celebrate'); return; }
    setBusy(true); setError('');
    try {
      await saveProfile({ name: garden.name, onboarded: true, reminders: true, caregiver: { experience: experience || 'first', detail }, nudges: { kinds: nudges, time } });
      const light = answers.light !== undefined ? LIGHT[answers.light].value : 'Not sure';
      const pot = answers.pot !== undefined ? POTS[answers.pot] : POTS[3];
      const p: Plant = { id: ids.current.plant, kind: choice.kind, species: choice.latin, name: choice.name, photo: photo ?? null, room: 'Not sure', pot: 'Not sure', light, stage: answers.stage !== undefined ? STAGES[answers.stage].value : 'Not sure', drainage: pot.drainage, self_watering: pot.self, environment: { location: 'Indoors', near_window: 'Not sure' } };
      if (!garden.plants.some(x => x.id === p.id)) await addPlant(p);
      // A remembered watering is kept as approximate, and always before today's soil check.
      const days = answers.watered !== undefined ? WATERED[answers.watered].days : null;
      if (days !== null) {
        const at = new Date(Date.now() - (days ? days * 86400000 : 60000)).toISOString();
        await logCare({ id: ids.current.water, plantId: p.id, type: 'Watered', note: 'Approximate date, from setup', at, source: 'USER' });
      }
      // "Not sure" is not an observation: the plant starts without a soil check instead.
      if (soilValue !== 'not_sure') {
        ids.current.soilAt ||= new Date().toISOString();
        await logCare({ id: ids.current.soil, plantId: p.id, type: 'Soil check', soil: soilValue, note: '', at: ids.current.soilAt, source: 'USER' });
      }
      setPhase('celebrate');
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? e.message : e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };

  /** Last step: nudges, then the phone's own permission prompt, in context (Apple HIG). */
  const finish = async (on: boolean) => {
    if (busy) return;
    t('onboarding_step_completed', { step: 'nudges', nudges_on: on, kinds: on ? nudges.length : 0, detail });
    t('onboarding_finished', {});
    if (preview) { navigation.goBack(); return; }
    setBusy(true); setError('');
    try {
      await saveProfile({ reminders: on && nudges.length > 0, caregiver: { experience: experience || 'first', detail }, nudges: { kinds: on ? nudges : [], time } });
      if (on && nudges.length) t('notification_permission', { granted: await requestNudgePermission() });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  if (step === 0) return <Opening onContinue={() => { t('onboarding_step_completed', { step: 'opening' }); setDived(true); setStep(1); }} />;

  // The celebration can be skipped with a tap; the guard stops a late timer from reopening the plan.
  const toPlan = () => { if (leftCelebration.current) return; leftCelebration.current = true; setPhase('plan'); };
  if (phase === 'celebrate') {
    return <Pressable accessibilityRole="button" accessibilityLabel="Continue to your plan" onPress={toPlan}
      style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', padding: space.gutter, gap: space[6] }}>
      <SeedDrop size={290} run={1} kind={kind!} onDone={() => setTimeout(toPlan, reduceMotion ? 700 : 1200)} />
      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(900)} style={{ alignItems: 'center', gap: space[1] }}>
        <T v="hero" center>{choice?.name} is in your garden.</T>
        <T v="callout" tone="ink2" center>{soilValue !== 'not_sure' ? 'Your first check is saved.' : 'Its first soil check is waiting for you.'}</T>
      </Animated.View>
    </Pressable>;
  }

  if (phase === 'plan' && choice) {
    const val = (s: Slot, list: { label: string }[]) => answers[s] === undefined || /^(Not sure|Don’t remember)$/.test(list[answers[s]!].label) ? 'Not sure yet' : list[answers[s]!].label;
    const rows: KnownRow[] = [
      { label: 'Light', value: val('light', LIGHT), source: 'told' },
      { label: 'Pot', value: val('pot', POTS), source: 'told' },
      { label: 'Stage', value: val('stage', STAGES), source: 'told' },
      { label: 'Last watered', value: val('watered', WATERED), source: 'observed' },
      { label: 'Soil today', value: val('soil', SOILS), source: 'observed' },
    ];
    return <PlanReveal kind={choice.kind} name={choice.name} photo={photo} rows={rows} twin={garden.twins[ids.current.plant]} onContinue={() => { t('onboarding_step_completed', { step: 'plan' }); setPhase('steps'); setStep(4); }} />;
  }

  const titles: Record<number, [string, string]> = {
    1: ['Rootera learns this plant, not plants in general.', 'Tap each source as it appears.'],
    2: ['How’s your plant life right now?', 'This sets how much Rootera explains. You can change it any time.'],
    3: ['Which plant is yours?', 'Start with the one you see most often.'],
    4: [`Want a nudge when your ${choice?.name ?? 'plant'} needs you?`, 'Each one comes from what you record. Change them any time in You.'],
  };
  const hideTitle = (step === 1 && storyDone) || (step === 3 && !!kind);
  const titleDelay = step === 1 && dived ? SOIL_LIFT : 0;
  const titleTime = titleDelay + revealDuration(titles[step][0]);
  const showCta = step === 1 ? storyDone : step === 3 ? plantReady : true;
  const canNext = step === 2 ? !!experience : true;
  const glassy = step === 2;
  // After planting there is no going back into the setup: the plant already exists.
  const canBack = step > 1 && step < 4;

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    {glassy && <Atmosphere />}
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space.gutter, height: insets.top + 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {canBack || step === 1
        ? <Tap label="Back" onPress={() => { if (!busy) { setDived(false); setStep(step - 1); } }} ring={22} style={{ width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}><Glyph name="back" size={22} /></Tap>
        : <View style={{ width: 44 }} />}
      <SeedProgress step={step} total={TOTAL} />
      {step === 1
        ? <Tap label="Skip this step" onPress={skip} ring={radius.inner} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T v="subhead" tone="ink2">Skip</T></Tap>
        : <View style={{ width: 44 }} />}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space[6], gap: space[5], flexGrow: 1 }}>
      {/* The title steps away once its job is done, so what follows can rise into its place. */}
      {!hideTitle && <Animated.View key={step} exiting={reduceMotion ? undefined : FadeOutUp.duration(280)} style={{ gap: space[2], paddingTop: space[4] }}>
        {step === 1
          ? <><TextReveal text={titles[step][0]} v="hero" delay={titleDelay} />
              <TextReveal text={titles[step][1]} v="callout" tone="ink2" delay={titleTime - 300} perWord={30} /></>
          : <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={{ gap: space[2] }}>
              <T v="hero" accessibilityRole="header">{titles[step][0]}</T>
              <T v="callout" tone="ink2">{titles[step][1]}</T>
            </Animated.View>}
      </Animated.View>}
      <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(420)} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ paddingTop: hideTitle ? space[3] : 0 }}>
        {!!width && step === 1 && <Story width={width} start={titleTime} onComplete={() => setStoryDone(true)} />}
        {step === 2 && <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {experiences.slice(0, 2).map(o => <GlassChoice key={o.value} on={experience === o.value} onPress={() => chooseExperience(o.value)} label={o.label} hint={o.hint} art={o.art} scene={o.scene} />)}
          </View>
          <GlassChoice wide on={experience === 'many'} onPress={() => chooseExperience('many')} label={experiences[2].label} hint={experiences[2].hint} art={experiences[2].art} scene={experiences[2].scene} />
        </View>}
        {!!width && step === 3 && <FirstPlant width={width} choice={choice} onChoose={setChoice} answers={answers} onAnswer={answer} editing={editing} setEditing={setEditing}
          photo={photo} idState={idState} matches={matches} onCamera={() => navigation.navigate('Camera', { returnTo: 'Welcome' })} />}
        {step === 4 && <NudgePicker selected={nudges} onToggle={k => setNudges(n => n.includes(k) ? n.filter(x => x !== k) : [...n, k])} detail={detail} onDetail={setDetail} time={time} onTime={setTime} />}
      </Animated.View>
    </ScrollView>
    {/* The action appears only once it can be taken: no disabled "Plant it" waiting at the bottom. */}
    {showCta && <Animated.View key={step} entering={reduceMotion || step === 2 || step === 4 ? undefined : FadeInDown.duration(380)}
      style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4], paddingTop: space[3], gap: space[2] }}>
      {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
      {step === 4
        ? <>
            <Btn title={nudges.length ? 'Turn on nudges' : 'Finish'} busy={busy} onPress={() => void finish(nudges.length > 0)} />
            {!!nudges.length && <Btn kind="plain" title="Not now" onPress={() => void finish(false)} style={{ alignSelf: 'center' }} />}
          </>
        : <Btn title={step === 3 ? 'Plant it' : 'Continue'} busy={busy} disabled={!canNext} hint={step === 2 ? 'Choose the one closest to you to continue.' : undefined} onPress={() => step === 3 ? void plant() : next()} />}
    </Animated.View>}
    {step === 1 && dived && <SoilReveal />}
  </View>;
}
