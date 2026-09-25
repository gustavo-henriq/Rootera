import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ago, CareEvent, describeEvent, known, newId, Plant as PlantT, soilLabel, Twin, visualLabel } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Glass, SourceLabel, SourceMark, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, PlantArt } from '../ds/plant';
import { Appear, DrawLine, LeafBurst, Pop, Settle, WaterDrops } from '../ds/motion';
import { CareCalendar } from '../ds/CareCalendar';

interface Callout { side: 'left' | 'right'; y: number; anchor: [number, number]; label: string; value: string | null; meta: string; source: 'observed' | 'told' }

/** Specimen plate: the plant in the middle, what we know about each part pinned to it. */
function Specimen({ plant, twin, width, drops }: { plant: PlantT; twin?: Twin; width: number; drops: number }) {
  const { c } = useTheme();
  const g = twin?.guidance;
  const narrow = width < 330;
  const S = Math.min(240, width * (narrow ? .42 : .5));
  const x0 = (width - S) / 2;
  const at = (fx: number, fy: number): [number, number] => [x0 + S * fx, 8 + S * fy];
  const drainage = plant.drainage === 'No' ? 'No drainage' : plant.drainage === 'Yes' ? 'Drains' : plant.self_watering === 'Yes' ? 'Self-watering' : null;
  const light = known(plant.light) ? plant.light.replace(' light', '').replace('Bright indirect', 'Bright, indirect') : null;
  const callouts: Callout[] = [
    { side: 'left', y: 0, anchor: at(.47, .1), label: 'Light', value: light, meta: light ? 'you told us' : 'not set', source: 'told' },
    { side: 'right', y: S * .12, anchor: at(.76, .3), label: 'Leaves', value: g?.visual ? visualLabel[g.visual] : null, meta: g?.visual ? 'you observed' : 'no recent note', source: 'observed' },
    { side: 'right', y: S * (narrow ? .72 : .64), anchor: at(.6, .64), label: 'Soil', value: g?.soil ? soilLabel[g.soil] : null, meta: g?.soil ? ago(g.soil_checked_at) : 'not checked', source: 'observed' },
    { side: 'left', y: S * (narrow ? .74 : .66), anchor: at(.34, .84), label: 'Pot', value: drainage, meta: drainage ? 'you told us' : 'not set', source: 'told' },
  ];
  const labelW = Math.max(90, x0 - 4);
  return <View style={{ width, height: S + (narrow ? 60 : 30) }} accessible accessibilityLabel={callouts.map(k => `${k.label}: ${k.value ?? k.meta}`).join('. ')}>
    <View style={{ position: 'absolute', left: x0, top: 8, width: S, height: S }}>
      <Ground width={S * .8} style={{ position: 'absolute', bottom: -S * .06 }} />
      <Settle><PlantArt kind={plant.kind} photo={plant.photo} size={S} /></Settle>
      <WaterDrops width={S} height={S * .62} run={drops} />
    </View>
    {callouts.map((k, i) => {
      const [ax, ay] = k.anchor;
      const lineY = k.y + 10;
      const edge = k.side === 'left' ? labelW - 2 : width - labelW + 2;
      const has = !!k.value;
      return <React.Fragment key={k.label}>
        <DrawLine x={Math.min(edge, ax)} y={lineY} length={Math.abs(ax - edge)} delay={380 + i * 130} tone={c.ink3} from={k.side === 'left' ? 'start' : 'end'} />
        <DrawLine x={ax - .75} y={Math.min(lineY, ay)} length={Math.abs(ay - lineY)} vertical delay={620 + i * 130} tone={c.ink3} from={ay > lineY ? 'start' : 'end'} />
        <Pop delay={860 + i * 130} style={{ position: 'absolute', left: ax - 4, top: ay - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: has ? c.ink : c.canvas, borderWidth: 1.5, borderColor: c.ink }} />
        <Appear delay={260 + i * 130} style={{ position: 'absolute', top: k.y, width: labelW - 6, [k.side]: 0, alignItems: k.side === 'left' ? 'flex-start' : 'flex-end' }}>
          <View style={{ flexDirection: k.side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
            <SourceMark kind={k.source} /><T v="caption" tone="ink2">{k.label}</T>
          </View>
          {has
            ? <T lines={2} style={{ fontFamily: fonts.serif, fontSize: narrow ? 17 : 21, lineHeight: narrow ? 19 : 23, textAlign: k.side, color: c.ink }}>{k.value}</T>
            : <View accessibilityElementsHidden style={{ width: 18, height: 1.5, backgroundColor: c.ink3, marginVertical: narrow ? 9 : 11 }} />}
          <T v="caption" tone="ink2" lines={1} style={{ textAlign: k.side, fontFamily: fonts.regular }}>{k.meta}</T>
        </Appear>
      </React.Fragment>;
    })}
  </View>;
}

function Figure({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  const narrow = useWindowDimensions().width < 370;
  const { c } = useTheme();
  return <View style={{ flex: 1, gap: 2 }}>
    {value
      ? <T v="figure" lines={1} style={narrow ? { fontSize: 24, lineHeight: 28 } : undefined}>{value}{!!unit && <T v="subhead" tone="ink2"> {unit}</T>}</T>
      : <View accessibilityElementsHidden style={{ height: narrow ? 28 : 38, justifyContent: 'center' }}><View style={{ width: 22, height: 2, backgroundColor: c.ink3 }} /></View>}
    <T v="footnote" tone="ink2">{caption}</T>
  </View>;
}

function since(iso: string) {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  return m < 2 ? { value: 'Now' } : m < 60 ? { value: String(Math.round(m)), unit: 'min' } : m < 1440 ? { value: String(Math.round(m / 60)), unit: 'h' } : { value: String(Math.round(m / 1440)), unit: m < 2880 ? 'day' : 'days' };
}

const actions: Record<string, { title: string; icon: GlyphName; mode: 'soil' | 'water' | 'visual' } | null> = {
  check_soil: { title: 'Check the soil', icon: 'soil', mode: 'soil' },
  log_water: { title: 'I watered it', icon: 'water', mode: 'water' },
  observe: { title: 'Look at the leaves', icon: 'leaf', mode: 'visual' },
  wait: null,
};
const otherLabels: Record<'soil' | 'water' | 'visual', string> = { soil: 'Check the soil', water: 'Log watering', visual: 'Note the leaves' };

function prose(list: string[]) {
  const l = list.map(s => s.toLowerCase());
  return l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

export function Plant({ navigation, route }: Props<'Plant'>) {
  const { garden, logCare, archivePlant } = useStore();
  const { c } = useTheme();
  const plant = garden.plants.find(p => p.id === route.params.id);
  const twin = garden.twins[route.params.id];
  const g = twin?.guidance;
  const [width, setWidth] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pendingWater = useRef<CareEvent | null>(null);
  const scroll = useRef<ScrollView>(null);
  const saved = route.params.saved;
  // Celebrate real events only: drops for a recorded watering, leaves when a pattern first appears.
  const [drops, setDrops] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastSaved = useRef<string | undefined>(undefined);
  useEffect(() => {
    const k = saved ? saved.title + (saved.to ?? '') : undefined;
    if (!saved || k === lastSaved.current) return;
    lastSaved.current = k;
    scroll.current?.scrollTo({ y: 0, animated: true });
    if (saved.title === 'Watering recorded') setDrops(d => d + 1);
    if (saved.to === 'Probably not dry yet' || saved.to === 'Around when it usually dries') setBurst(b => b + 1);
  }, [saved]);

  if (!plant) {
    return <Page back={navigation.goBack}>
      <T v="title">This plant isn’t in your garden</T>
      <T v="callout" tone="ink2">It may have been removed. Its history is kept.</T>
      <Btn title="Back to my plants" onPress={() => navigation.navigate('Main', { tab: 'Plants' })} />
    </Page>;
  }

  const events = garden.events.filter(e => e.plantId === plant.id).slice().reverse();
  const primary = g ? actions[g.action] : actions.check_soil;
  const others = (['soil', 'water', 'visual'] as const).filter(m => m !== primary?.mode);
  const water = g?.last_watered_at ? Math.max(0, Math.floor((Date.now() - new Date(g.last_watered_at).getTime()) / 86400000)) : null;
  const soil = g?.last_soil_check_at ? since(g.last_soil_check_at) : null;
  const where = [known(plant.environment?.location) ? plant.environment!.location : null, garden.plan === 'Plus' && known(plant.room) ? plant.room.toLowerCase() : null].filter(Boolean).join(', ');

  const waterNow = async () => {
    if (busy) return;
    setBusy(true); setError('');
    // Reuse the same id on retry so a slow network never records two waterings.
    pendingWater.current ??= { id: newId('water'), plantId: plant.id, type: 'Watered', note: '', at: new Date().toISOString(), source: 'USER' };
    try {
      const r = await logCare(pendingWater.current);
      pendingWater.current = null;
      navigation.setParams({ saved: { title: 'Watering recorded', from: r.change?.from, to: r.change?.to } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await archivePlant(plant.id); navigation.navigate('Main', { tab: 'Plants' }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove.'); setBusy(false); }
  };
  const go = (mode: 'soil' | 'water' | 'visual') => navigation.navigate('Care', { id: plant.id, mode });

  return <View style={{ flex: 1 }}>
    <Page back={navigation.goBack} scrollRef={scroll} titleInBar={plant.name} gap={space[6]}
      actions={[{ icon: 'more', label: 'Plant options', onPress: () => { setMenu(!menu); setConfirm(false); } }]}>
      {confirm && <Toast tone="error" title={`Remove ${plant.name}?`} text="It leaves your garden and frees a plan spot. Its care history is kept." action={{ title: busy ? 'Removing…' : 'Remove', onPress: () => void remove() }} onClose={() => setConfirm(false)} />}
      {!!saved && <Animated.View key={saved.title + (saved.to ?? '')} entering={FadeIn.duration(240)}>
        <Toast title={saved.title} onClose={() => navigation.setParams({ saved: undefined })}
          text={saved.to ? `Next step changed: ${saved.to.toLowerCase()}.` : saved.title !== 'Details updated' ? 'The next step stays the same. It’s in the plant’s history.' : undefined} />
      </Animated.View>}

      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', gap: space[4] }}>
        <LeafBurst run={burst} />
        {!!width && <Specimen plant={plant} twin={twin} width={width} drops={drops} />}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="display" center>{plant.name}</T>
          <T v="latin" tone="ink2" center>{plant.species}</T>
          {!!where && <T v="footnote" tone="ink2" style={{ marginTop: space[1] }}>{where}</T>}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space[4], paddingVertical: space[4], borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        <Figure {...(water === null ? { value: '', caption: 'No watering yet' } : water === 0 ? { value: 'Today', caption: 'Last watered' } : { value: String(water), unit: water === 1 ? 'day' : 'days', caption: 'Since watering' })} />
        <Figure {...(soil ? { ...soil, caption: soil.value === 'Now' ? 'Soil checked' : 'Since soil check' } : { value: '', caption: 'No soil check yet' })} />
        <Figure {...(g?.baseline_days != null ? { value: `~${Math.round(g.baseline_days)}`, unit: 'days', caption: 'Usually dry after' } : { value: `${Math.min(g?.completed_cycles ?? 0, 3)}/3`, caption: 'Cycles to a pattern' })} />
      </View>

      <View style={{ gap: space[3] }}>
        <SourceLabel kind="suggested" />
        <T v="title">{g?.title ?? 'Start with a soil check'}</T>
        <T v="body" tone="ink2">{g?.reason ?? 'A first soil check tells Rootera where this plant is starting from.'}</T>
        {!!g?.tip && <View style={{ padding: space[4], borderRadius: radius.control, backgroundColor: c.sunken, gap: 4 }}>
          <T v="subhead" style={{ fontFamily: fonts.medium }}>How to check</T>
          <T v="subhead" tone="ink2">{g.tip}</T>
        </View>}
        {!!g?.basis.length && <T v="footnote" tone="ink2">Based on {prose(g.basis)}.</T>}
        {!!error && <Toast tone="error" title="Not saved" text={error} action={{ title: 'Try again', onPress: () => void waterNow() }} onClose={() => setError('')} />}
        <View style={{ gap: space[1], marginTop: space[2] }}>
          {primary
            ? <Btn title={primary.title} icon={primary.icon} busy={busy && primary.mode === 'water'} onPress={() => primary.mode === 'water' ? void waterNow() : go(primary.mode)} />
            : <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center', paddingVertical: space[2] }}><Glyph name="leaf" size={18} tone={c.leafMark} /><T v="callout">Nothing to do right now.</T></View>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[5] }}>
            {primary?.mode === 'water' && <Btn kind="plain" size="regular" title="Add amount or a note" onPress={() => go('water')} />}
            {others.map(m => <Btn key={m} kind="plain" size="regular" title={otherLabels[m]} onPress={() => go(m)} />)}
          </View>
        </View>
      </View>

      <View style={{ gap: space[4] }}>
        <T v="section">What Rootera knows</T>
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="suggested" text="Learned from your records" />
          {g?.baseline_days != null
            ? <T v="body">In {g.completed_cycles} watering cycles, you first found the soil dry about {Math.round(g.baseline_days)} days after watering. How often you check affects this number.</T>
            : <>
                <T v="body">A pattern needs 3 watering cycles that each end with a dry soil check. So far: {g?.completed_cycles ?? 0}.</T>
                <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`${g?.completed_cycles ?? 0} of 3 cycles`}>
                  {[0, 1, 2].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < (g?.completed_cycles ?? 0) ? c.leafMark : c.hairline }} />)}
                </View>
              </>}
        </View>
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="species" text={plant.kind === 'other' ? 'Species note: none yet' : 'Species note, general'} />
          <T v="body">{g?.reference.summary}</T>
          {plant.kind !== 'other' && <T v="subhead" tone="ink2">{g?.reference.when_dry}</T>}
        </View>
        {twin?.measured && <View style={{ gap: space[2] }}>
          <SourceLabel kind="observed" text="Sensor reading" />
          <T v="body">{Math.round(twin.measured.soil_moisture_percent)}% calibrated moisture, {ago(twin.measured.observed_at)}{twin.measured.stale ? ' (outdated)' : ''}</T>
        </View>}
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="off" />
          <T v="subhead" tone="ink2">{twin?.sources.sensor.connected ? 'Weather.' : 'Soil sensor and weather.'} Guidance here uses only your records, the details you gave and general species notes.</T>
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="section">Care calendar</T>
        <CareCalendar events={events} />
      </View>

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[2] }}>
          <T v="section">History</T>
          {events.length > 5 && <Tap label="See all in the journal" onPress={() => navigation.navigate('Main', { tab: 'Journal' })} ring={radius.inner} style={{ minHeight: 44, justifyContent: 'center' }}><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>See all</T></Tap>}
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
          {events.length ? events.slice(0, 5).map(e => <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
            <Glyph name={e.type === 'Watered' ? 'water' : e.type === 'Soil check' ? 'soil' : 'leaf'} size={18} tone={e.type === 'Watered' ? c.water : c.ink2} />
            <View style={{ flex: 1 }}>
              <T v="body">{describeEvent(e)}</T>
              {!!e.note && <T v="subhead" tone="ink2">“{e.note}”</T>}
            </View>
            <T v="footnote" tone="ink2">{ago(e.at)}</T>
          </View>) : <T v="subhead" tone="ink2" style={{ paddingVertical: space[3] }}>Nothing recorded yet. Your first check will show up here.</T>}
        </View>
      </View>
    </Page>

    {menu && <>
      <Tap label="Close menu" onPress={() => setMenu(false)} scaleTo={1} style={StyleSheet.absoluteFill}><View style={StyleSheet.absoluteFill} /></Tap>
      <Animated.View entering={FadeIn.duration(160)} style={{ position: 'absolute', top: 104, right: space.gutter, width: 230 }}>
        <Glass level="control" r={radius.card}>
          <Tap label="Edit details" onPress={() => { setMenu(false); navigation.navigate('PlantForm', { editId: plant.id }); }} ring={radius.card} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], minHeight: 50 }}>
            <Glyph name="edit" size={18} /><T v="body">Edit details</T>
          </Tap>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
          <Tap label="Remove from garden" onPress={() => { setMenu(false); setConfirm(true); }} ring={radius.card} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], minHeight: 50 }}>
            <Glyph name="trash" size={18} tone={c.danger} /><T v="body" tone="danger">Remove from garden</T>
          </Tap>
        </Glass>
      </Animated.View>
    </>}
  </View>;
}
