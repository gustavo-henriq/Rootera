import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Props } from '../navigation';
import { useStore } from '../store';
import { CareEvent, newId, Soil, soilLabel, Visual, visualLabel } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Chip, Field, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { PlantArt } from '../ds/plant';

const soilHints: Record<Soil, string> = {
  dry: 'Crumbly, no coolness on your finger',
  slightly_moist: 'A little cool, barely sticks',
  moist: 'Cool and damp, some soil sticks',
  wet: 'Soggy, or water sitting at the bottom',
  not_sure: 'Hard to tell. That’s worth recording too',
};
const soilOrder: Soil[] = ['dry', 'slightly_moist', 'moist', 'wet', 'not_sure'];
const visualGlyph: Record<Visual, GlyphName> = { great: 'leaf', different: 'spark', unwell: 'alert', not_sure: 'info' };
const visualHints: Record<Visual, string> = { great: 'Leaves look like usual', different: 'Colour, droop or spots you hadn’t seen', unwell: 'Clearly struggling', not_sure: 'Can’t tell right now' };
const AMOUNTS = ['Not measured', '100', '250', '500', 'Other'] as const;
const amountLabel = (a: (typeof AMOUNTS)[number]) => a === 'Not measured' || a === 'Other' ? a : `${a} ml`;

/** One choice per row; the soil scale doubles as a legend of soil colour, dry to wet. */
function Options<V extends string>({ values, value, onChange, label, hint, lead }: { values: V[]; value: V | ''; onChange: (v: V) => void; label: (v: V) => string; hint: (v: V) => string; lead: (v: V, on: boolean) => React.ReactNode }) {
  const { c } = useTheme();
  return <View accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
    {values.map(v => {
      const on = v === value;
      return <Tap key={v} role="radio" selected={on} label={`${label(v)}. ${hint(v)}`} onPress={() => onChange(v)} scaleTo={.99} ring={radius.inner}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        {lead(v, on)}
        <View style={{ flex: 1, gap: 2 }}>
          <T v="body" style={{ fontFamily: on ? fonts.medium : fonts.regular }}>{label(v)}</T>
          <T v="footnote" tone="ink2">{hint(v)}</T>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? c.ink : c.ink3, alignItems: 'center', justifyContent: 'center' }}>
          {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.ink }} />}
        </View>
      </Tap>;
    })}
  </View>;
}

export function Care({ navigation, route }: Props<'Care'>) {
  const { garden, logCare } = useStore();
  const { c } = useTheme();
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

  if (!plant) return <Page close={navigation.goBack}><T v="title">This plant isn’t in your garden anymore.</T></Page>;

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
    // Keep id and time across retries only while the content is unchanged, so retries never duplicate.
    const same = pending.current && JSON.stringify({ ...pending.current, id: '', at: '', plantId: '', source: '' }) === JSON.stringify({ id: '', plantId: '', at: '', source: '', ...content });
    if (!same) pending.current = { id: newId('care'), plantId: plant.id, at: new Date().toISOString(), source: 'USER', ...content };
    try {
      const r = await logCare(pending.current!);
      const title = mode === 'soil' ? `Soil check saved: ${soilLabel[soil as Soil].toLowerCase()}` : mode === 'visual' ? 'Leaf note saved' : 'Watering recorded';
      navigation.popTo('Plant', { id: plant.id, saved: { title, from: r.change?.from, to: r.change?.to } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };

  const titles = { soil: 'How does the soil feel?', visual: 'How do the leaves look?', water: 'Record watering' };
  const subtitle = mode === 'soil' ? g?.reference.check_tip : mode === 'water' ? 'Saved as now. Amount and a note are optional.' : 'What you notice matters more than a perfect answer. This isn’t a diagnosis.';

  return <Page close={() => !busy && navigation.goBack()} titleInBar={plant.name} gap={space[5]}
    footer={<>
      {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
      <Btn title={error ? 'Try again' : mode === 'water' ? 'Save watering' : 'Save'} busy={busy} disabled={!ready} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
      <View style={{ flex: 1, gap: space[2] }}>
        <T v="footnote" tone="ink2">{plant.name}</T>
        <T v="title">{titles[mode]}</T>
      </View>
      <PlantArt kind={plant.kind} photo={plant.photo} size={72} />
    </View>
    {!!subtitle && <T v="callout" tone="ink2">{subtitle}</T>}

    {mode === 'soil' && <Options values={soilOrder} value={soil} onChange={setSoil} label={v => soilLabel[v]} hint={v => soilHints[v]}
      lead={v => v === 'not_sure'
        ? <View style={{ width: 30, height: 30, borderRadius: radius.inner, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3 }} />
        : <View style={{ width: 30, height: 30, borderRadius: radius.inner, backgroundColor: c.soil[soilOrder.indexOf(v)], overflow: 'hidden', justifyContent: 'flex-end' }}>{v === 'wet' && <View style={{ height: 8, backgroundColor: c.water, opacity: .6 }} />}</View>} />}

    {mode === 'visual' && <>
      <Options values={['great', 'different', 'unwell', 'not_sure'] as Visual[]} value={visual} onChange={setVisual} label={v => visualLabel[v]} hint={v => visualHints[v]}
        lead={(v, on) => <View style={{ width: 30, alignItems: 'center' }}><Glyph name={visualGlyph[v]} size={22} tone={on ? c.ink : c.ink2} /></View>} />
      {(visual === 'different' || visual === 'unwell') && <Animated.View entering={FadeIn.duration(200)}><Field label="What changed? (optional)" value={note} onChangeText={setNote} placeholder="A lower leaf turning yellow" maxLength={300} /></Animated.View>}
    </>}

    {mode === 'water' && <>
      <View style={{ gap: space[3] }}>
        <T v="headline">Roughly how much?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{AMOUNTS.map(a => <Chip key={a} label={amountLabel(a)} selected={amount === a} onPress={() => setAmount(a)} />)}</View>
        {amount === 'Other' && <Animated.View entering={FadeIn.duration(200)}><Field label="Amount in ml" value={custom} onChangeText={t => setCustom(t.replace(/[^0-9]/g, ''))} numeric autoFocus maxLength={5} /></Animated.View>}
        {invalid && !!custom && <T v="footnote" tone="danger">Enter an amount between 1 and 20,000 ml.</T>}
      </View>
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Watered until it drained" maxLength={300} />
    </>}
  </Page>;
}
