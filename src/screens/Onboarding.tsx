/**
 * First run, in three movements:
 *  1. Opening: a seed drops into a pot, the wordmark sprouts, and "Get started"
 *     dives into the soil (automatic, see onboarding/Opening).
 *  2. Getting to know you: how Rootera learns (a plant that grows as you tap),
 *     your experience, and the nudges you want.
 *  3. Your first plant: one note at a time; it becomes the first plant in the garden.
 * No name and no account here: both are asked later, once the garden has value.
 * Every step answers a touch; progress is a seed filling up. Nothing here is a paywall.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { catalog, Experience, newId, NudgeKind, Plant, PlantKind } from '../model';
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
import { Answers, currentSlot, FirstPlant, LIGHT, POTS, Slot, SOILS } from './onboarding/FirstPlant';
import { Atmosphere, experiences, GlassChoice, SeedProgress } from './onboarding/shared';


const TOTAL = 4;
const SOIL_LIFT = 800; // the soil from the opening lifts away before the story starts

export function Onboarding({ navigation, route }: Props<'Welcome'>) {
  // Preview replays the whole flow from You; it saves nothing and returns there.
  const preview = !!route.params?.preview;
  const { garden, saveProfile, addPlant, logCare } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [dived, setDived] = useState(false);
  const [width, setWidth] = useState(0);
  const [storyDone, setStoryDone] = useState(false);
  const [experience, setExperience] = useState<Experience | ''>(garden.caregiver?.experience ?? '');
  // Only the essential nudge starts on, marked as recommended; everything else is opt-in.
  const [nudges, setNudges] = useState<NudgeKind[]>(['soil_check']);
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [kind, setKind] = useState<PlantKind | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [editing, setEditing] = useState<Slot | null>(null);
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
  const answer = (s: Slot, i: number) => { setAnswers(a => ({ ...a, [s]: i })); setEditing(null); };
  const plantReady = !!kind && currentSlot(answers, editing) === null;

  const finish = async () => {
    if (busy || !kind) return;
    if (preview) { setCelebrate(1); return; }
    setBusy(true); setError('');
    try {
      await saveProfile({ name: garden.name, onboarded: true, reminders: nudges.length > 0, caregiver: { experience: experience || 'first', detail }, nudges: { kinds: nudges, time } });
      const species = catalog.find(s => s.kind === kind)!;
      const light = answers.light !== undefined ? LIGHT[answers.light].value : 'Not sure';
      const pot = answers.pot !== undefined ? POTS[answers.pot] : POTS[3];
      const plant: Plant = { id: ids.current.plant, kind, species: species.latin, name: species.name, room: 'Not sure', pot: 'Not sure', light, drainage: pot.drainage, self_watering: pot.self, environment: { location: 'Indoors', near_window: 'Not sure' } };
      if (!garden.plants.some(p => p.id === plant.id)) await addPlant(plant);
      // "Not sure" is not an observation: the plant starts without a soil check instead.
      const soil = answers.soil !== undefined ? SOILS[answers.soil].value : 'not_sure';
      if (soil !== 'not_sure') {
        ids.current.soilAt ||= new Date().toISOString();
        await logCare({ id: ids.current.soil, plantId: plant.id, type: 'Soil check', soil, note: '', at: ids.current.soilAt, source: 'USER' });
      }
      setCelebrate(1);
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? e.message : e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  // The phone asks for notification permission here, right after the first plant,
  // when a nudge about it obviously makes sense. Never on first launch.
  const afterCelebration = async () => {
    await new Promise(r => setTimeout(r, reduceMotion ? 900 : 1500));
    if (preview) { navigation.goBack(); return; }
    if (nudges.length) await requestNudgePermission();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  if (step === 0) return <Opening onContinue={() => { setDived(true); setStep(1); }} />;

  if (celebrate) {
    return <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', padding: space.gutter, gap: space[6] }}>
      <SeedDrop size={230} run={celebrate} kind={kind!} onDone={() => void afterCelebration()} />
      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(900)} style={{ alignItems: 'center', gap: space[1] }}>
        <T v="hero" center>{catalog.find(s => s.kind === kind)?.name} is in your garden.</T>
        <T v="callout" tone="ink2" center>{answers.soil !== undefined && SOILS[answers.soil].value !== 'not_sure' ? 'Your first check is saved. Here is what it means.' : 'Its first soil check is waiting for you.'}</T>
      </Animated.View>
    </View>;
  }

  const titles: Record<number, [string, string]> = {
    1: ['Rootera learns this plant, not plants in general.', 'Tap each source as it appears.'],
    2: ['How’s your plant life right now?', 'This sets how much Rootera explains. You can change it any time.'],
    3: ['Choose the nudges you want.', 'Each one comes from what you record. Change them any time in You.'],
    4: [kind ? 'Now fill in what you know.' : 'Which plant is yours?', kind ? 'One note at a time. “Not sure” is always an answer.' : 'Start with the one you see most often.'],
  };
  const titleDelay = step === 1 && dived ? SOIL_LIFT : 0;
  const titleTime = titleDelay + revealDuration(titles[step][0]);
  const showCta = step === 1 ? storyDone : step === 4 ? plantReady : true;
  const canNext = step === 2 ? !!experience : true;
  const glassy = step === 2;

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    {glassy && <Atmosphere />}
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space.gutter, height: insets.top + 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tap label="Back" onPress={() => { if (!busy) { setDived(false); setStep(step - 1); } }} ring={22} style={{ width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}><Glyph name="back" size={22} /></Tap>
      <SeedProgress step={step} total={TOTAL} />
      {step === 1 || step === 3
        ? <Tap label="Skip this step" onPress={() => { setDived(false); setStep(step + 1); }} ring={radius.inner} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T v="subhead" tone="ink2">Skip</T></Tap>
        : <View style={{ width: 44 }} />}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space[6], gap: space[5], flexGrow: 1 }}>
      <View key={step + (kind ? 'k' : '')} style={{ gap: space[2], paddingTop: space[4] }}>
        <TextReveal text={titles[step][0]} v="hero" delay={titleDelay} />
        <TextReveal text={titles[step][1]} v="callout" tone="ink2" delay={titleTime - 300} perWord={30} />
      </View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {!!width && step === 1 && <Story width={width} start={titleTime} onComplete={() => setStoryDone(true)} />}
        {step === 2 && <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {experiences.slice(0, 2).map(o => <GlassChoice key={o.value} on={experience === o.value} onPress={() => chooseExperience(o.value)} label={o.label} hint={o.hint} art={o.art} scene={o.scene} />)}
          </View>
          <GlassChoice wide on={experience === 'many'} onPress={() => chooseExperience('many')} label={experiences[2].label} hint={experiences[2].hint} art={experiences[2].art} scene={experiences[2].scene} />
        </View>}
        {step === 3 && <NudgePicker selected={nudges} onToggle={k => setNudges(n => n.includes(k) ? n.filter(x => x !== k) : [...n, k])} detail={detail} onDetail={setDetail} time={time} onTime={setTime} />}
        {!!width && step === 4 && <FirstPlant width={width} kind={kind} setKind={setKind} answers={answers} onAnswer={answer} editing={editing} setEditing={setEditing} />}
      </View>
    </ScrollView>
    {/* The action appears only once it can be taken: no disabled "Plant it" waiting at the bottom. */}
    {showCta && <Animated.View key={step} entering={reduceMotion || step === 2 || step === 3 ? undefined : FadeInDown.duration(380)}
      style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4], paddingTop: space[3], gap: space[3] }}>
      {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
      <Btn title={step === TOTAL ? 'Plant it' : 'Continue'} busy={busy} disabled={!canNext} onPress={() => { setDived(false); step < TOTAL ? setStep(step + 1) : void finish(); }} />
    </Animated.View>}
    {step === 1 && dived && <SoilReveal />}
  </View>;
}
