import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { CareEvent, newId, Soil, soilLabel, Visual, visualLabel } from '../model';
import { color, space } from '../theme';
import { Banner, Button, Chips, Choice, Field, Icon, IconButton, IconName, PlantArt, Screen, Txt } from '../ui';
import { Reveal } from '../motion';

const soilHints: Record<Soil, string> = {
  dry: 'Crumbly, no coolness on your finger',
  slightly_moist: 'A little cool, barely sticks',
  moist: 'Cool and damp, some soil sticks',
  wet: 'Soggy, or water sitting at the bottom',
  not_sure: 'Hard to tell. That’s worth recording too',
};
const soilOrder: Soil[] = ['dry', 'slightly_moist', 'moist', 'wet', 'not_sure'];
const visualIcons: Record<Visual, IconName> = { great: 'happy-outline', different: 'eye-outline', unwell: 'sad-outline', not_sure: 'help-circle-outline' };
const visualHints: Record<Visual, string> = { great: 'Leaves look like usual', different: 'Colour, droop or spots you hadn’t seen', unwell: 'Clearly struggling', not_sure: 'Can’t tell right now' };
const AMOUNTS = ['Not measured', '100', '250', '500', 'Other'] as const;

function SoilSwatch({ soil }: { soil: Soil }) {
  if (soil === 'not_sure') return <View style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.lineStrong }} />;
  const i = soilOrder.indexOf(soil);
  return <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: color.soil[i], overflow: 'hidden', justifyContent: 'flex-end' }}>
    {soil === 'wet' && <View style={{ height: 7, backgroundColor: 'rgba(63,115,132,.55)' }} />}
  </View>;
}

export function Care({ navigation, route }: Props<'Care'>) {
  const { garden, logCare } = useStore();
  const plant = garden.plants.find(p => p.id === route.params.id);
  const g = garden.twins[route.params.id]?.guidance;
  const mode = route.params.mode;
  const [soil, setSoil] = useState<Soil | ''>('');
  const [visual, setVisual] = useState<Visual | ''>('');
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>('Not measured');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<CareEvent | null>(null);

  if (!plant) return <Screen back={navigation.goBack}><Txt v="title">This plant isn’t in your garden anymore.</Txt></Screen>;

  const ml = amount === 'Other' ? Number(custom) : amount === 'Not measured' ? null : Number(amount);
  const invalid = amount === 'Other' && (!custom.trim() || !Number.isFinite(ml) || (ml ?? 0) <= 0 || (ml ?? 0) > 20000);
  const ready = mode === 'soil' ? !!soil : mode === 'visual' ? !!visual : !invalid;

  const save = async () => {
    if (busy || !ready) return;
    setBusy(true); setError('');
    const content = {
      type: (mode === 'soil' ? 'Soil check' : mode === 'visual' ? 'Observation' : 'Watered') as CareEvent['type'],
      soil: mode === 'soil' ? soil as Soil : null, visual: mode === 'visual' ? visual as Visual : null,
      amount_ml: mode === 'water' ? ml : null, note: note.trim(),
    };
    // Keep id and time across retries only while the content is unchanged.
    const same = pending.current && JSON.stringify({ ...pending.current, id: '', at: '', plantId: '', source: '' }) === JSON.stringify({ id: '', plantId: '', at: '', source: '', ...content });
    if (!same) pending.current = { id: newId('care'), plantId: plant.id, at: new Date().toISOString(), source: 'USER', ...content };
    try {
      const r = await logCare(pending.current!);
      const title = mode === 'soil' ? `Soil check saved · ${soilLabel[soil as Soil]}` : mode === 'visual' ? 'Appearance note saved' : 'Watering recorded';
      navigation.popTo('Plant', { id: plant.id, saved: { title, from: r.change?.from, to: r.change?.to } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };

  const titles = { soil: 'How does the soil feel?', visual: 'How do the leaves look?', water: 'Record watering' };
  return <Screen left={<IconButton name="close" label="Cancel" onPress={() => !busy && navigation.goBack()} />} title={plant.name}
    footer={<>
      {!!error && <Banner tone="error" title="Not saved" text={error} />}
      <Button title={error ? 'Try again' : mode === 'water' ? 'Save watering' : 'Save'} busy={busy} disabled={!ready} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
      <View style={{ flex: 1, gap: space.sm }}>
        <Txt v="title">{titles[mode]}</Txt>
        {mode === 'soil' && <Txt v="small">{g?.reference.check_tip}</Txt>}
        {mode === 'water' && <Txt v="small">Saved as now. Amount and notes are optional.</Txt>}
        {mode === 'visual' && <Txt v="small">What you notice matters more than a perfect answer. This isn’t a diagnosis.</Txt>}
      </View>
      <PlantArt kind={plant.kind} photo={plant.photo} size={76} />
    </View>

    {mode === 'soil' && <Choice value={soil} onChange={setSoil}
      options={soilOrder.map(v => ({ value: v, label: soilLabel[v], hint: soilHints[v], leading: <SoilSwatch soil={v} /> }))} />}

    {mode === 'visual' && <>
      <Choice value={visual} onChange={setVisual}
        options={(['great', 'different', 'unwell', 'not_sure'] as Visual[]).map(v => ({ value: v, label: visualLabel[v], hint: visualHints[v], leading: <Icon name={visualIcons[v]} size={24} tone={color.olive} /> }))} />
      {(visual === 'different' || visual === 'unwell') && <Reveal><Field label="What changed? (optional)" value={note} onChangeText={setNote} placeholder="e.g. lower leaf turning yellow" maxLength={300} /></Reveal>}
    </>}

    {mode === 'water' && <>
      <View style={{ gap: space.md }}>
        <Txt v="bodyStrong">Roughly how much?</Txt>
        <Chips values={AMOUNTS} value={amount} onChange={setAmount} labels={{ '100': '100 ml', '250': '250 ml', '500': '500 ml' }} />
        {amount === 'Other' && <Reveal><Field label="Amount in ml" value={custom} onChangeText={t => setCustom(t.replace(/[^0-9]/g, ''))} numeric autoFocus maxLength={5} /></Reveal>}
        {invalid && !!custom && <Txt v="small" tone={color.danger}>Enter an amount between 1 and 20000 ml.</Txt>}
      </View>
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. watered until it drained" maxLength={300} />
    </>}
  </Screen>;
}
