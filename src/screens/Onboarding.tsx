/**
 * First run:
 *  1. Opening: a seed drops into a pot, the wordmark sprouts, and "Get started"
 *     dives into the soil (automatic, see onboarding/Opening).
 *  2. How Rootera learns (a plant that grows as you tap) and your experience.
 *  3. Your first plant, one note at a time; it is planted and celebrated.
 *  4. The payoff: what Rootera now knows and its first suggestion.
 * Nudges are not a step: Today offers them once, after this first plant (NudgeInvite).
 * No name and no account here: both are asked later, once the garden has value.
 * Every step answers a touch; progress is a seed filling up. Nothing here is a paywall,
 * and identifying a plant from a photo is free.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props } from '../navigation';
import { useStore } from '../store';
import { api, ApiError, Candidate } from '../api';
import { track } from '../analytics';
import { photoData } from './Camera';
import { Experience, experienceHint, experienceLabel, newId, Plant, SoilLayers } from '../model';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { SeedDrop } from '../ds/SeedDrop';
import { revealDuration, TextReveal } from '../ds/TextReveal';
import { Opening } from './onboarding/Opening';
import { SOIL_OUT, SoilReveal } from './onboarding/Soil';
import { Story } from './onboarding/Story';
import { Answers, Choice, currentSlot, FirstPlant, IdState, layersSummary, LIGHT, POTS, Slot, SOILS, STAGES, WATERED } from './onboarding/FirstPlant';
import { layersComplete } from '../ds/SoilLayers';
import { KnownRow, PlanReveal } from './onboarding/PlanReveal';
import { Atmosphere, experiences, GlassChoice, SeedProgress } from './onboarding/shared';
import { t } from '../i18n';


// Nudges are no longer a step: they are offered once on Today, after the first plant (NudgeInvite).
const TOTAL = 3;
const SOIL_LIFT = SOIL_OUT - 150; // the story's title starts as the soil clears
const STEP_NAMES = ['opening', 'story', 'experience', 'plant'];

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
  // A tap anywhere on the story step moves the story on (not only on its cards).
  const [storyTap, setStoryTap] = useState(0);
  const [experience, setExperience] = useState<Experience | ''>(garden.caregiver?.experience ?? '');
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [editing, setEditing] = useState<Slot | null>(null);
  const [idState, setIdState] = useState<IdState>('idle');
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  // Which photo this is: after three misses the name is asked for.
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leftCelebration = useRef(false);
  const ids = useRef({ plant: newId('plant'), soil: newId('care'), water: newId('water'), soilAt: '' });
  const tr = (name: string, props: Record<string, string | number | boolean> = {}) => { if (!preview) track(name, props); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (phase === 'steps' && step > 1 && step < 4 && !busy) { setStep(step - 1); return true; } return false; });
    return () => sub.remove();
  }, [step, busy, phase]);

  // Funnel: one "viewed" per step, so drop-off can be read per step.
  useEffect(() => { if (phase === 'steps') tr('onboarding_step_viewed', { step: STEP_NAMES[step] }); }, [step, phase]);
  useEffect(() => { if (phase === 'plan') tr('onboarding_step_viewed', { step: 'plan' }); }, [phase]);

  // A photo from the camera: identify it (free). It stays only for identifying; the plant keeps its illustration.
  useEffect(() => {
    if (!photo) return;
    setAttempt(a => a + 1);
    const data = photoData.get(photo);
    if (!garden.integrations.identification || !data) { setIdState('off'); setMatches(null); return; }
    let live = true;
    setIdState('loading');
    api.identify(data).then(r => { if (live) { setMatches(r.results); setIdState('idle'); } }).catch(() => live && setIdState('error'));
    return () => { live = false; };
  }, [photo]);

  // Experience sets the default tone; it can be changed later in You > Nudges.
  const chooseExperience = (e: Experience) => { setExperience(e); setDetail(e === 'many' ? 'Concise' : 'Guided'); };
  const answer = (s: Slot, i: number) => { setAnswers(a => ({ ...a, [s]: i })); setEditing(null); };
  const kind = choice?.kind ?? null;
  const plantReady = !!kind && currentSlot(answers, editing) === null;
  // The first soil check, in three layers; "Check later" leaves the plant without one.
  const [layers, setLayers] = useState<Partial<SoilLayers>>({});
  const soilChecked = answers.soil !== undefined && SOILS[answers.soil].checked && layersComplete(layers);

  const next = () => {
    tr('onboarding_step_completed', { step: STEP_NAMES[step] });
    setDived(false);
    setStep(step + 1);
  };
  const skip = () => {
    tr('onboarding_step_skipped', { step: STEP_NAMES[step] });
    setDived(false);
    setStep(step + 1);
  };

  /** Plants the first plant. The profile is marked onboarded here, so the plant is never planted twice. */
  const plant = async () => {
    if (busy || !choice) return;
    tr('onboarding_step_completed', { step: 'plant' });
    tr('first_plant_added', { kind: choice.kind, via: choice.via, photo: !!photo, soil_checked: soilChecked });
    if (preview) { setPhase('celebrate'); return; }
    setBusy(true); setError('');
    try {
      // Nudges start off; Today offers them once the plant is in (see NudgeInvite).
      await saveProfile({ name: garden.name, onboarded: true, reminders: false, caregiver: { experience: experience || 'first', detail }, nudges: { kinds: ['soil_check'], time: garden.nudges?.time ?? '08:00' } });
      const light = answers.light !== undefined ? LIGHT[answers.light].value : 'Not sure';
      const pot = answers.pot !== undefined ? POTS[answers.pot] : POTS[3];
      const p: Plant = { id: ids.current.plant, kind: choice.kind, species: choice.latin, name: choice.name, photo: null, room: 'Not sure', pot: 'Not sure', light, stage: answers.stage !== undefined ? STAGES[answers.stage].value : 'Not sure', drainage: pot.drainage, self_watering: pot.self, environment: { location: 'Indoors', near_window: 'Not sure' } };
      if (!garden.plants.some(x => x.id === p.id)) await addPlant(p);
      // A remembered watering is kept as approximate, and always before today's soil check.
      const days = answers.watered !== undefined ? WATERED[answers.watered].days : null;
      if (days !== null) {
        const at = new Date(Date.now() - (days ? days * 86400000 : 60000)).toISOString();
        await logCare({ id: ids.current.water, plantId: p.id, type: 'Watered', note: t('Approximate date, from setup'), approximate: true, at, source: 'USER' });
      }
      // "Check later" is not an observation: the plant starts without a soil check instead.
      if (soilChecked) {
        ids.current.soilAt ||= new Date().toISOString();
        await logCare({ id: ids.current.soil, plantId: p.id, type: 'Soil check', layers: layers as SoilLayers, note: '', at: ids.current.soilAt, source: 'USER' });
      }
      setPhase('celebrate');
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? e.message : e instanceof Error ? e.message : t('Could not save. Please try again.'));
    } finally { setBusy(false); }
  };

  /** After the plan: straight to Today, where the nudges are offered once. */
  const finish = () => {
    tr('onboarding_step_completed', { step: 'plan' });
    tr('onboarding_finished', {});
    if (preview) { navigation.goBack(); return; }
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  if (step === 0) return <Opening onContinue={() => { tr('onboarding_step_completed', { step: 'opening' }); setDived(true); setStep(1); }} />;

  // The celebration can be skipped with a tap; the guard stops a late timer from reopening the plan.
  const toPlan = () => { if (leftCelebration.current) return; leftCelebration.current = true; setPhase('plan'); };
  if (phase === 'celebrate') {
    return <Pressable accessibilityRole="button" accessibilityLabel={t("Continue to your plan")} onPress={toPlan}
      style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', padding: space.gutter, gap: space[6] }}>
      <SeedDrop size={290} run={1} kind={kind!} onDone={() => setTimeout(toPlan, reduceMotion ? 700 : 1200)} />
      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(900)} style={{ alignItems: 'center', gap: space[1] }}>
        <T v="hero" center>{t('{name} is in your garden.', { name: choice?.name ?? '' })}</T>
        <T v="callout" tone="ink2" center>{soilChecked ? t('Your first check is saved.') : t('Its first soil check is waiting for you.')}</T>
      </Animated.View>
    </Pressable>;
  }

  if (phase === 'plan' && choice) {
    const val = (s: Slot, list: { label: string }[]) => answers[s] === undefined || /^(Not sure|Don’t remember)$/.test(list[answers[s]!].label) ? t('Not sure yet') : t(list[answers[s]!].label);
    const rows: KnownRow[] = [
      { label: t('Light'), value: val('light', LIGHT), source: 'told' },
      { label: t('Pot'), value: val('pot', POTS), source: 'told' },
      { label: t('Stage'), value: val('stage', STAGES), source: 'told' },
      { label: t('Last watered'), value: val('watered', WATERED), source: 'observed' },
      { label: t('Soil today'), value: soilChecked ? layersSummary(layers) : t('Not sure yet'), source: 'observed' },
    ];
    return <PlanReveal kind={choice.kind} name={choice.name} rows={rows} twin={garden.twins[ids.current.plant]} onContinue={finish} />;
  }

  const titles: Record<number, [string, string]> = {
    1: [t('Rootera learns your plant.'), ''],
    2: [t('How’s your plant life right now?'), t('So Rootera explains just enough.')],
    // Someone with one plant is asked for it; someone with several, for one of them.
    3: experience === 'first' || !experience
      ? [t('Which plant is yours?'), t('Search by name or use a photo.')]
      : [t('Tell me about one of your plants'), t('The one you see most often.')],
  };
  const hideTitle = (step === 1 && storyDone) || (step === 3 && !!kind);
  const titleDelay = step === 1 && dived ? SOIL_LIFT : 0;
  const titleTime = titleDelay + revealDuration(titles[step][0]);
  const showCta = step === 1 ? storyDone : step === 3 ? plantReady : true;
  const canNext = step === 2 ? !!experience : true;
  const glassy = step === 2;
  // After planting there is no going back into the setup: the plant already exists.
  const canBack = step > 1;

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    {glassy && <Atmosphere />}
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space.gutter, height: insets.top + 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {canBack || step === 1
        ? <Tap label={t("Back")} onPress={() => { if (!busy) { setDived(false); setStep(step - 1); } }} ring={22} style={{ width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}><Glyph name="back" size={22} /></Tap>
        : <View style={{ width: 44 }} />}
      <SeedProgress step={step} total={TOTAL} />
      {step === 1
        ? <Tap label={t("Skip this step")} onPress={skip} ring={radius.inner} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T v="subhead" tone="ink2">{t("Skip")}</T></Tap>
        : <View style={{ width: 44 }} />}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space[6], flexGrow: 1 }}>
      <Pressable accessible={false} disabled={step !== 1 || storyDone} onPress={() => setStoryTap(n => n + 1)} style={{ flexGrow: 1, gap: space[5] }}>
      {/* The title steps away once its job is done, so what follows can rise into its place.
          No exit animation: a leaving title lingered over the next step's title and cards. */}
      {!hideTitle && <Animated.View key={'title-' + step} style={{ gap: space[2], paddingTop: space[4] }}>
        {step === 1
          ? <><TextReveal text={titles[step][0]} v="hero" delay={titleDelay} />
              {!!titles[step][1] && <TextReveal text={titles[step][1]} v="callout" tone="ink2" delay={titleTime - 300} perWord={30} />}</>
          : <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={{ gap: space[2] }}>
              <T v="hero" accessibilityRole="header">{titles[step][0]}</T>
              <T v="callout" tone="ink2">{titles[step][1]}</T>
            </Animated.View>}
      </Animated.View>}
      {/* Content rises only once the title has gone, so the two never overlap. */}
      {/* Keyed by step: a new step's content mounts in place (a layout transition carried over
          from the last step slid it up over the new title). */}
      <Animated.View key={'content-' + step} layout={reduceMotion ? undefined : LinearTransition.delay(140).duration(380)} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ paddingTop: hideTitle ? space[3] : 0 }}>
        {!!width && step === 1 && <Story width={width} start={titleTime} advance={storyTap} onComplete={() => setStoryDone(true)} />}
        {step === 2 && <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(140).duration(320)} style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {experiences.slice(0, 2).map(o => <GlassChoice key={o.value} on={experience === o.value} onPress={() => chooseExperience(o.value)} label={experienceLabel[o.value]} hint={experienceHint[o.value]} art={o.art} scene={o.scene} />)}
          </View>
          <GlassChoice wide on={experience === 'many'} onPress={() => chooseExperience('many')} label={experienceLabel.many} hint={experienceHint.many} art={experiences[2].art} scene={experiences[2].scene} />
        </Animated.View>}
        {!!width && step === 3 && <FirstPlant width={width} layers={layers} onLayers={setLayers} choice={choice} onChoose={setChoice} answers={answers} onAnswer={answer} editing={editing} setEditing={setEditing}
          photo={photo} idState={idState} matches={matches} attempt={Math.max(1, attempt)} onCamera={() => navigation.navigate('Camera', { returnTo: 'Welcome' })} />}
      </Animated.View>
      </Pressable>
    </ScrollView>
    {/* The action appears only once it can be taken: no disabled "Plant it" waiting at the bottom. */}
    {showCta && <Animated.View key={step} entering={reduceMotion || step === 2 ? undefined : FadeInDown.duration(380)}
      style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4], paddingTop: space[3], gap: space[2] }}>
      {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
      <Btn title={step === 3 ? t('Plant it') : t('Continue')} busy={busy} disabled={!canNext} hint={step === 2 ? t('Choose the one closest to you to continue.') : undefined} onPress={() => step === 3 ? void plant() : next()} />
    </Animated.View>}
    {step === 1 && dived && <SoilReveal />}
  </View>;
}
