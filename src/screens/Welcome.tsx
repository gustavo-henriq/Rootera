import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { Experience } from '../model';
import { color, radius, space } from '../theme';
import { Banner, Button, Choice, Field, Logo, PlantArt, Press, Txt, useReducedMotion } from '../ui';
import { Atmosphere, NotificationStack, PlantAssembly, Pop, Reveal, Stagger } from '../motion';
import { BlurView } from 'expo-blur';
import { Icon } from '../ui';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native';

/** First contact: calm paper fading into fresh growth. */
export const firstLight = ['#F6F7EF', '#F6F7EF', '#F1F6CF', '#CDEB5E'] as const;
const firstStops = [0, .42, .7, 1] as const;

const STEPS = 4;

function Dots({ step }: { step: number }) {
  const reduce = useReducedMotion();
  return <View accessible accessibilityLabel={`Step ${step + 1} of ${STEPS}`} style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
    {Array.from({ length: STEPS }, (_, i) => <Dot key={i} on={i === step} reduce={reduce} />)}
  </View>;
}
function Dot({ on, reduce }: { on: boolean; reduce: boolean }) {
  const style = useAnimatedStyle(() => ({ width: withTiming(on ? 22 : 7, { duration: reduce ? 0 : 220 }), backgroundColor: on ? color.leaf : color.lineStrong }));
  return <Animated.View style={[{ height: 7, borderRadius: 4 }, style]} />;
}

function Minis({ kinds, size = 1 }: { kinds: ('pilea' | 'pothos' | 'snake-plant')[]; size?: number }) {
  return <View style={{ height: 70 * size, flexDirection: 'row', alignItems: 'flex-end' }}>
    {kinds.map((k, i) => <PlantArt key={k} kind={k} size={(i === 1 ? 66 : 52) * size} style={{ marginHorizontal: -7 }} />)}
  </View>;
}

/** Frosted-glass choice tile over the drifting colour fields. */
function GlassTile({ on, onPress, label, hint, kinds, wide }: { on: boolean; onPress: () => void; label: string; hint: string; kinds: ('pilea' | 'pothos' | 'snake-plant')[]; wide?: boolean }) {
  return <Press role="radio" selected={on} label={`${label}. ${hint}`} onPress={onPress} style={{ flex: wide ? undefined : 1 }}>
    <View style={{ minHeight: wide ? 128 : 190, borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden', borderWidth: on ? 2 : 1, borderColor: on ? color.olive : 'rgba(255,255,255,0.9)' }}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: on ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.38)' }]} />
      <View style={{ flex: 1, padding: 16, justifyContent: 'space-between', flexDirection: wide ? 'row-reverse' : 'column', alignItems: wide ? 'flex-end' : 'flex-start', gap: 10 }}>
        <Minis kinds={kinds} size={wide ? 1.1 : .9} />
        <View style={{ gap: 3, flex: wide ? 1 : undefined }}>
          <Txt v="bodyStrong" style={{ fontSize: 17, lineHeight: 21 }}>{label}</Txt>
          <Txt v="small" style={{ fontSize: 13, lineHeight: 17 }}>{hint}</Txt>
        </View>
      </View>
      {on && <Pop style={{ position: 'absolute', top: 12, right: 12 }}><View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.olive, alignItems: 'center', justifyContent: 'center' }}><Icon name="checkmark" size={15} tone={color.white} /></View></Pop>}
    </View>
  </Press>;
}

const experiences: { value: Experience; label: string; hint: string; minis: ('pilea' | 'pothos' | 'snake-plant')[] }[] = [
  { value: 'first', label: 'My first plant', hint: 'Explain how to check and what to look for.', minis: ['pilea'] },
  { value: 'some', label: 'A few plants', hint: 'Short tips for each plant.', minis: ['pilea', 'pothos'] },
  { value: 'many', label: 'Lots of plants, or a whole garden', hint: 'Straight to the point. Tips stay out of the way.', minis: ['snake-plant', 'pothos', 'pilea'] },
];

export function Welcome({ navigation }: Props<'Welcome'>) {
  const { garden, saveProfile } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | ''>(garden.caregiver?.experience ?? '');
  const [name, setName] = useState(garden.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [greeting, setGreeting] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0 && !busy) { setStep(step - 1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step, busy]);

  const finish = async () => {
    if (busy || !experience) return;
    setBusy(true); setError(''); setGreeting(true);
    try {
      // The greeting stays at least a moment so it reads as a welcome, not a flash.
      await Promise.all([saveProfile({ name: name.trim(), onboarded: true, caregiver: { experience, detail: experience === 'many' ? 'Concise' : 'Guided' } }), new Promise(r => setTimeout(r, 1100))]);
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'AddPlant', params: { first: true } }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setGreeting(false);
    } finally { setBusy(false); }
  };

  const next = () => step < 3 ? setStep(step + 1) : void finish();
  const cta = step === 3 ? 'Add my first plant' : 'Continue';

  if (greeting) {
    return <LinearGradient colors={firstLight} locations={firstStops} style={{ flex: 1, paddingTop: insets.top + 120, paddingBottom: insets.bottom + 48, paddingHorizontal: 32, justifyContent: 'space-between' }}>
      <Reveal><Txt v="hero" style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.6 }}>{name.trim() ? `Welcome,\n${name.trim()}` : 'Welcome\nto Rootera'}</Txt></Reveal>
      <ActivityIndicator color={color.ink} accessibilityLabel="Preparing your garden" />
    </LinearGradient>;
  }

  return <LinearGradient colors={step === 0 ? firstLight : [color.paper, color.paper]} locations={step === 0 ? firstStops : undefined} style={{ flex: 1 }}>
    {step > 0 && <Atmosphere />}
    <View style={{ flex: 1, paddingTop: insets.top + 8, paddingHorizontal: space.gutter }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {step > 0
          ? <Press label="Back" onPress={() => !busy && setStep(step - 1)} style={{ height: 44, justifyContent: 'center', paddingRight: 12 }}><Txt v="smallStrong" tone={color.inkSoft}>Back</Txt></Press>
          : <Logo width={112} />}
        {step < 2 && <Press label="Skip introduction" onPress={() => setStep(2)} style={{ height: 44, justifyContent: 'center', paddingLeft: 12 }}><Txt v="smallStrong" tone={color.inkSoft}>Skip</Txt></Press>}
      </View>

      <Reveal key={step} style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        {step === 0 && <>
          <PlantAssembly size={240} />
          <View style={{ gap: space.md }}>
            <Txt v="hero" center>Stop guessing what your plant needs.</Txt>
            <Txt center tone={color.inkSoft}>Rootera learns from this plant, the spot it lives in and the care you give it. Every suggestion shows what it’s based on.</Txt>
          </View>
        </>}
        {step === 1 && <>
          <View style={{ gap: space.md }}>
            <Txt v="hero" center>Nudges that know your plant.</Txt>
            <Txt center tone={color.inkSoft}>Built from what you record. Never a fixed watering calendar.</Txt>
          </View>
          <NotificationStack />
          <Txt v="label" center>Examples</Txt>
        </>}
        {step === 2 && <View style={{ gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Txt v="hero">How’s your plant life right now?</Txt>
            <Txt tone={color.inkSoft}>This sets how much Rootera explains. You can change it any time.</Txt>
          </View>
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              {experiences.slice(0, 2).map((o, i) => <Stagger key={o.value} index={i} style={{ flex: 1 }}><GlassTile on={experience === o.value} onPress={() => setExperience(o.value)} label={o.label} hint={o.hint} kinds={o.minis} /></Stagger>)}
            </View>
            <Stagger index={2}><GlassTile wide on={experience === 'many'} onPress={() => setExperience('many')} label={experiences[2].label} hint={experiences[2].hint} kinds={experiences[2].minis} /></Stagger>
          </View>
        </View>}
        {step === 3 && <View style={{ gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Txt v="hero">What should we call you?</Txt>
            <Txt tone={color.inkSoft}>Optional. It only appears on your Today screen.</Txt>
          </View>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Guto" onSubmitEditing={() => void finish()} maxLength={40} />
          <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', gap: 4 }}>
            <Txt v="smallStrong">Preview access</Txt>
            <Txt v="small">Accounts aren’t connected yet. Your garden is saved on the Rootera server this preview uses.</Txt>
          </View>
        </View>}
      </Reveal>
    </View>

    <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 20, gap: space.lg }}>
      {!!error && <Banner tone="error" title="Not saved" text={error} />}
      <Button title={cta} icon={step === 3 ? undefined : 'arrow-forward'} busy={busy} disabled={step === 2 && !experience} onPress={next} />
      <Dots step={step} />
    </View>
  </LinearGradient>;
}
