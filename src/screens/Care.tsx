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
import { haptic } from '../ds/feedback';
import { DepthRuler } from '../ds/DepthRuler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHECKED_IN } from './NameInvite';
import { t } from '../i18n';

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
const amountLabel = (a: (typeof AMOUNTS)[number]) => a === 'Not measured' || a === 'Other' ? t(a) : `${a} ml`;

/** One choice per row; the soil scale doubles as a legend of soil colour, dry to wet. */
function Options<V extends string>({ values, value, onChange, label, hint, lead }: { values: V[]; value: V | ''; onChange: (v: V) => void; label: (v: V) => string; hint: (v: V) => string; lead: (v: V, on: boolean) => React.ReactNode }) {
  const { c } = useTheme();
  return <View accessibilityRole="radiogroup" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
    {values.map(v => {
      const on = v === value;
      return <Tap key={v} role="radio" selected={on} label={`${label(v)}. ${hint(v)}`} onPress={() => { haptic.select(); onChange(v); }} scaleTo={.99} ring={radius.inner}
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

export const STAGES = ['Seedling', 'Young', 'Mature'] as const;
const stageHints: Record<(typeof STAGES)[number], string> = { Seedling: 'Just started, a few small leaves', Young: 'Growing steadily, not full size yet', Mature: 'Full size, established' };

/**
 * One check-in instead of three separate forms. It follows what you would do at the
 * plant anyway: feel the soil, water if you did, glance at the leaves. Each question
 * appears once the one before it is answered; everything after the soil is optional.
 */
function CheckIn({ navigation, route }: Props<'Care'>) {
  const { garden, logCare, updatePlant } = useStore();
  const { c } = useTheme();
  const plant = garden.plants.find(p => p.id === route.params.id)!;
  const g = garden.twins[plant.id]?.guidance;
  const [soil, setSoil] = useState<Soil | ''>('');
  const [watered, setWatered] = useState<'yes' | 'no' | ''>('');
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>('Not measured');
  const [visual, setVisual] = useState<Visual | ''>('');
  const [note, setNote] = useState('');
  const [stage, setStage] = useState(plant.stage && plant.stage !== 'Not sure' ? plant.stage : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Fixed ids for this check-in, so a retry after a network error never records anything twice.
  const ids = useRef({ soil: newId('care'), water: newId('water'), look: newId('care'), at: Date.now() });
  const ml = amount === 'Other' || amount === 'Not measured' ? null : Number(amount);

  const save = async () => {
    if (busy || !soil || !watered) return;
    setBusy(true); setError('');
    const at0 = ids.current.at;
    const base = { plantId: plant.id, source: 'USER' as const, note: '' };
    try {
      // Report the change across the whole check-in, not just the last write.
      let to: string | undefined;
      const track = (x: Awaited<ReturnType<typeof logCare>>) => { if (x.change?.to) to = x.change.to; return x; };
      track(await logCare({ ...base, id: ids.current.soil, type: 'Soil check', soil, at: new Date(at0).toISOString() }));
      // Watering comes after the check it answered, so the soil check stays the "before" reading.
      if (watered === 'yes') track(await logCare({ ...base, id: ids.current.water, type: 'Watered', amount_ml: ml, at: new Date(at0 + 1000).toISOString() }));
      if (visual) track(await logCare({ ...base, id: ids.current.look, type: 'Observation', visual, note: note.trim(), at: new Date(at0 + 2000).toISOString() }));
      if (stage && stage !== plant.stage) await updatePlant(plant.id, { stage });
      AsyncStorage.setItem(CHECKED_IN, '1').catch(() => undefined);
      // What this check-in created, so the confirmation can offer Undo.
      const created = [ids.current.soil, ...(watered === 'yes' ? [ids.current.water] : []), ...(visual ? [ids.current.look] : [])];
      navigation.popTo('Plant', { id: plant.id, saved: { title: watered === 'yes' ? t('Check-in and watering saved') : t('Check-in saved'), from: to ? g?.title : undefined, to,
        undo: { ids: created, stage: stage && stage !== plant.stage ? plant.stage ?? 'Not sure' : undefined },
        // A stage moving forward is a milestone worth a moment (and only then).
        milestone: stage && STAGES.indexOf(stage as any) > STAGES.indexOf((plant.stage ?? '') as any) && STAGES.includes((plant.stage ?? '') as any) ? stage : undefined } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not save. Please try again.'));
    } finally { setBusy(false); }
  };

  return <Page close={() => !busy && navigation.goBack()} titleInBar={plant.name} gap={space[6]}
    footer={<>
      {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
      <Btn title={error ? t('Try again') : t('Save check-in')} busy={busy} disabled={!soil || !watered} hint={!soil ? t('Choose how the soil feels to save.') : t('Say whether you watered it to save.')} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
      <View style={{ flex: 1, gap: space[2] }}>
        <T v="footnote" tone="ink2">{t("Check in")}</T>
        <T v="title">{plant.name}</T>
      </View>
      <PlantArt kind={plant.kind} photo={plant.photo} size={72} />
    </View>

    <View style={{ gap: space[3] }}>
      <T v="headline">{t("How does the soil feel?")}</T>
      <DepthRuler dryness={plant.kind === 'other' ? 'unknown' : g?.reference.dryness} />
      {!!g?.reference.check_tip && <T v="subhead" tone="ink2">{g.reference.check_tip}</T>}
      <Options values={soilOrder} value={soil} onChange={setSoil} label={v => soilLabel[v]} hint={v => t(soilHints[v])}
        lead={v => v === 'not_sure'
          ? <View style={{ width: 30, height: 30, borderRadius: radius.inner, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3 }} />
          : <View style={{ width: 30, height: 30, borderRadius: radius.inner, backgroundColor: c.soil[soilOrder.indexOf(v)], overflow: 'hidden', justifyContent: 'flex-end' }}>{v === 'wet' && <View style={{ height: 8, backgroundColor: c.water, opacity: .6 }} />}</View>} />
    </View>

    {!!soil && <Animated.View entering={FadeIn.duration(260)} style={{ gap: space[3] }}>
      <T v="headline">{t("Did you water it just now?")}</T>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Chip label={t("Yes, just now")} selected={watered === 'yes'} onPress={() => setWatered('yes')} />
        <Chip label={t("No")} selected={watered === 'no'} onPress={() => setWatered('no')} />
      </View>
      {watered === 'yes' && <Animated.View entering={FadeIn.duration(200)} style={{ gap: space[2] }}>
        <T v="footnote" tone="ink2">{t("Roughly how much? Optional.")}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{AMOUNTS.filter(a => a !== 'Other').map(a => <Chip key={a} label={amountLabel(a)} selected={amount === a} onPress={() => setAmount(a)} />)}</View>
      </Animated.View>}
    </Animated.View>}

    {!!watered && <Animated.View entering={FadeIn.duration(260)} style={{ gap: space[3] }}>
      <View style={{ gap: 2 }}>
        <T v="headline">{t("How do the leaves look?")}</T>
        <T v="footnote" tone="ink2">{t("Optional. This isn’t a diagnosis.")}</T>
      </View>
      <Options values={['great', 'different', 'unwell'] as Visual[]} value={visual} onChange={v => setVisual(visual === v ? '' : v)} label={v => visualLabel[v]} hint={v => t(visualHints[v])}
        lead={(v, on) => <View style={{ width: 30, alignItems: 'center' }}><Glyph name={visualGlyph[v]} size={22} tone={on ? c.ink : c.ink2} /></View>} />
      {(visual === 'different' || visual === 'unwell') && <Field label={t("What changed? (optional)")} value={note} onChangeText={setNote} placeholder={t("A lower leaf turning yellow")} maxLength={300} />}
    </Animated.View>}

    {!!watered && <Animated.View entering={FadeIn.delay(120).duration(260)} style={{ gap: space[3] }}>
      <View style={{ gap: 2 }}>
        <T v="headline">{t("Growth stage")}</T>
        <T v="footnote" tone="ink2">{stage ? t(stageHints[stage as (typeof STAGES)[number]]) : t('Optional. Change it when your plant grows.')}</T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{STAGES.map(s => <Chip key={s} label={t(s)} selected={stage === s} onPress={() => setStage(s)} />)}</View>
    </Animated.View>}
  </Page>;
}

export function Care(props: Props<'Care'>) {
  const { garden } = useStore();
  if (props.route.params.mode === 'checkin' && garden.plants.some(p => p.id === props.route.params.id)) return <CheckIn {...props} />;
  return <SingleCare {...props} />;
}

function SingleCare({ navigation, route }: Props<'Care'>) {
  const { garden, logCare } = useStore();
  const { c } = useTheme();
  const plant = garden.plants.find(p => p.id === route.params.id);
  const g = garden.twins[route.params.id]?.guidance;
  const mode = route.params.mode === 'checkin' ? 'soil' : route.params.mode;
  const [soil, setSoil] = useState<Soil | ''>('');
  const [visual, setVisual] = useState<Visual | ''>('');
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>('Not measured');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<CareEvent | null>(null);

  if (!plant) return <Page close={navigation.goBack}><T v="title">{t("This plant isn’t in your garden anymore.")}</T></Page>;

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
      const title = mode === 'soil' ? t('Soil check saved: {v}', { v: soilLabel[soil as Soil].toLowerCase() }) : mode === 'visual' ? t('Leaf note saved') : t('Watering recorded');
      navigation.popTo('Plant', { id: plant.id, saved: { title, from: r.change?.from, to: r.change?.to, undo: { ids: [pending.current!.id] } } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not save. Please try again.'));
    } finally { setBusy(false); }
  };

  const titles = { soil: t('How does the soil feel?'), visual: t('How do the leaves look?'), water: t('Record watering') };
  const subtitle = mode === 'soil' ? g?.reference.check_tip : mode === 'water' ? t('Saved as now. Amount and a note are optional.') : t('What you notice matters more than a perfect answer. This isn’t a diagnosis.');

  return <Page close={() => !busy && navigation.goBack()} titleInBar={plant.name} gap={space[5]}
    footer={<>
      {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
      <Btn title={error ? t('Try again') : mode === 'water' ? t('Save watering') : t('Save')} busy={busy} disabled={!ready} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
      <View style={{ flex: 1, gap: space[2] }}>
        <T v="footnote" tone="ink2">{plant.name}</T>
        <T v="title">{titles[mode]}</T>
      </View>
      <PlantArt kind={plant.kind} photo={plant.photo} size={72} />
    </View>
    {!!subtitle && <T v="callout" tone="ink2">{subtitle}</T>}

    {mode === 'soil' && <Options values={soilOrder} value={soil} onChange={setSoil} label={v => soilLabel[v]} hint={v => t(soilHints[v])}
      lead={v => v === 'not_sure'
        ? <View style={{ width: 30, height: 30, borderRadius: radius.inner, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3 }} />
        : <View style={{ width: 30, height: 30, borderRadius: radius.inner, backgroundColor: c.soil[soilOrder.indexOf(v)], overflow: 'hidden', justifyContent: 'flex-end' }}>{v === 'wet' && <View style={{ height: 8, backgroundColor: c.water, opacity: .6 }} />}</View>} />}

    {mode === 'visual' && <>
      <Options values={['great', 'different', 'unwell', 'not_sure'] as Visual[]} value={visual} onChange={setVisual} label={v => visualLabel[v]} hint={v => t(visualHints[v])}
        lead={(v, on) => <View style={{ width: 30, alignItems: 'center' }}><Glyph name={visualGlyph[v]} size={22} tone={on ? c.ink : c.ink2} /></View>} />
      {(visual === 'different' || visual === 'unwell') && <Animated.View entering={FadeIn.duration(200)}><Field label={t("What changed? (optional)")} value={note} onChangeText={setNote} placeholder={t("A lower leaf turning yellow")} maxLength={300} /></Animated.View>}
    </>}

    {mode === 'water' && <>
      <View style={{ gap: space[3] }}>
        <T v="headline">{t("Roughly how much?")}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{AMOUNTS.map(a => <Chip key={a} label={amountLabel(a)} selected={amount === a} onPress={() => setAmount(a)} />)}</View>
        {amount === 'Other' && <Animated.View entering={FadeIn.duration(200)}><Field label={t("Amount in ml")} value={custom} onChangeText={v => setCustom(v.replace(/[^0-9]/g, ''))} numeric autoFocus maxLength={5} /></Animated.View>}
        {invalid && !!custom && <T v="footnote" tone="danger">{t("Enter an amount between 1 and 20,000 ml.")}</T>}
      </View>
      <Field label={t("Note (optional)")} value={note} onChangeText={setNote} placeholder={t("Watered until it drained")} maxLength={300} />
    </>}
  </Page>;
}
