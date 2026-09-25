import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { Experience as ExperienceT, experienceLabel, NudgeKind } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Field, SourceLabel, Source, T, Tap, Toast } from '../ds/components';
import { Page } from '../ds/Page';
import { NudgePicker } from './Onboarding';

const hints: Record<ExperienceT, string> = { first: 'Explains how to check and what to look for.', some: 'Short tips for each plant.', many: 'Straight to the point.' };

export function Experience({ navigation }: Props<'Experience'>) {
  const { garden, saveProfile } = useStore();
  const { c } = useTheme();
  const [name, setName] = useState(garden.name);
  const [experience, setExperience] = useState<ExperienceT>(garden.caregiver?.experience ?? 'first');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await saveProfile({ name: name.trim(), caregiver: { experience, detail: garden.caregiver?.detail ?? (experience === 'many' ? 'Concise' : 'Guided') } }); navigation.goBack(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return <Page back={navigation.goBack} title="Profile" footer={<>
    {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
    <Btn title="Save" busy={busy} onPress={() => void save()} />
  </>}>
    <Field label="Your name" value={name} onChangeText={setName} maxLength={40} />
    <View>
      <T v="section" style={{ marginBottom: space[2] }}>Plant experience</T>
      <View accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        {(['first', 'some', 'many'] as ExperienceT[]).map(v => {
          const on = v === experience;
          return <Tap key={v} role="radio" selected={on} label={`${experienceLabel[v]}. ${hints[v]}`} onPress={() => setExperience(v)} scaleTo={.99} ring={radius.inner}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
            <View style={{ flex: 1 }}><T v="body" style={{ fontFamily: on ? fonts.medium : fonts.regular }}>{experienceLabel[v]}</T><T v="footnote" tone="ink2">{hints[v]}</T></View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.ink }} />}</View>
          </Tap>;
        })}
      </View>
    </View>
  </Page>;
}

export function Nudges({ navigation }: Props<'Nudges'>) {
  const { garden, saveProfile } = useStore();
  const [kinds, setKinds] = useState<NudgeKind[]>(garden.nudges?.kinds ?? ['soil_check', 'pattern']);
  const [time, setTime] = useState(garden.nudges?.time ?? '08:00');
  const [detail, setDetail] = useState<'Guided' | 'Concise'>(garden.caregiver?.detail ?? 'Guided');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await saveProfile({ reminders: kinds.length > 0, nudges: { kinds, time }, caregiver: { experience: garden.caregiver?.experience ?? 'first', detail } });
      navigation.goBack();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return <Page back={navigation.goBack} title="Nudges" gap={space[5]} footer={<>
    {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
    <Btn title="Save" busy={busy} onPress={() => void save()} />
  </>}>
    <T v="callout" tone="ink2">Nudges show up in Rootera for now. Phone notifications are the next step for this preview.</T>
    <NudgePicker selected={kinds} onToggle={k => setKinds(n => n.includes(k) ? n.filter(x => x !== k) : [...n, k])} detail={detail} onDetail={setDetail} time={time} onTime={setTime} />
  </Page>;
}

const layers: { kind: Source; title: string; text: string }[] = [
  { kind: 'observed', title: 'What you observe', text: 'Soil checks, watering and notes about the leaves. A soil check is kept exactly as you described it (dry, moist…). Rootera never turns it into a percentage.' },
  { kind: 'told', title: 'What you tell us', text: 'Where the plant lives, its light, pot and soil. Optional, and editable any time.' },
  { kind: 'species', title: 'General species notes', text: 'How the species usually likes its soil. Useful at the start. It describes the species, not your plant.' },
  { kind: 'suggested', title: 'What Rootera suggests', text: 'Rules that combine the three sources above. Each suggestion lists what it was based on. After three watering cycles that end with a dry check, Rootera shows how long your plant usually takes to get there. That depends on how often you check, so it is not a watering schedule.' },
  { kind: 'off', title: 'Not connected yet', text: 'Soil sensors, local weather and automatic photo identification. When they arrive they will appear as their own sources, never mixed with what you observed.' },
];

export function About({ navigation }: Props<'About'>) {
  return <Page back={navigation.goBack} titleInBar="How Rootera learns">
    <View style={{ gap: space[2] }}>
      <T v="hero">How Rootera learns</T>
      <T v="callout" tone="ink2">Each plant has a Plant Twin: a record of this plant, its spot and your care, kept in separate layers so you always know where a suggestion comes from.</T>
    </View>
    {layers.map(l => <View key={l.title} style={{ gap: space[2] }}>
      <SourceLabel kind={l.kind} />
      <T v="title2">{l.title}</T>
      <T v="body" tone="ink2">{l.text}</T>
    </View>)}
  </Page>;
}
