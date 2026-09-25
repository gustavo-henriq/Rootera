import React, { useState } from 'react';
import { View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { Experience as ExperienceT, experienceLabel } from '../model';
import { color, space } from '../theme';
import { Banner, Button, Choice, Field, Screen, Section, Tag, Txt } from '../ui';

const hints: Record<ExperienceT, string> = {
  first: 'Explains how to check and what to look for.',
  some: 'Short tips, focused on each plant.',
  many: 'Straight to the point.',
};

export function Experience({ navigation }: Props<'Experience'>) {
  const { garden, saveProfile } = useStore();
  const [name, setName] = useState(garden.name);
  const [experience, setExperience] = useState<ExperienceT>(garden.caregiver?.experience ?? 'first');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await saveProfile({ name: name.trim(), caregiver: { experience, detail: garden.caregiver?.detail ?? (experience === 'many' ? 'Concise' : 'Guided') } });
      navigation.goBack();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return <Screen back={navigation.goBack} title="Profile" footer={<>
    {!!error && <Banner tone="error" title="Not saved" text={error} />}
    <Button title="Save" busy={busy} onPress={() => void save()} />
  </>}>
    <Field label="Your name" value={name} onChangeText={setName} maxLength={40} />
    <Section label="Plant experience">
      <Choice value={experience} onChange={setExperience} options={(['first', 'some', 'many'] as ExperienceT[]).map(v => ({ value: v, label: experienceLabel[v], hint: hints[v] }))} />
    </Section>
  </Screen>;
}

const layers: { tag: React.ComponentProps<typeof Tag>['kind']; title: string; text: string }[] = [
  { tag: 'user', title: 'What you observe', text: 'Soil checks, watering and notes about the leaves. A soil check is recorded as you described it (dry, moist…). Rootera never turns it into a percentage.' },
  { tag: 'context', title: 'What you tell us', text: 'Where the plant lives, its light, pot and soil. Optional, and editable any time.' },
  { tag: 'reference', title: 'General species notes', text: 'How the species usually likes its soil. Useful at the start; it describes the species, not your plant.' },
  { tag: 'inferred', title: 'What Rootera suggests', text: 'Rules that combine the three layers above. Each suggestion lists what it was based on. After three watering cycles that end with a dry check, Rootera shows how long your plant usually takes to reach that check. That depends on how often you check, so it is not a watering schedule.' },
  { tag: 'off', title: 'Not connected yet', text: 'Soil sensors, local weather and automatic photo identification. When they arrive they will appear as their own sources, never mixed with what you observed.' },
];

export function About({ navigation }: Props<'About'>) {
  return <Screen back={navigation.goBack}>
    <View style={{ gap: space.sm }}>
      <Txt v="hero">How Rootera learns</Txt>
      <Txt tone={color.inkSoft}>Each plant has a Plant Twin: a record of this plant, its spot and your care, kept in separate layers so you always know where a suggestion comes from.</Txt>
    </View>
    {layers.map(l => <View key={l.title} style={{ gap: 6 }}>
      <Tag kind={l.tag} />
      <Txt v="heading">{l.title}</Txt>
      <Txt tone={color.inkSoft}>{l.text}</Txt>
    </View>)}
  </Screen>;
}
