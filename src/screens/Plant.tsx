import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ago, CareEvent, describeEvent, known, Plant as PlantT, soilLabel, Twin, visualLabel } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Glass, SourceLabel, SourceMark, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, PlantArt } from '../ds/plant';
import { Appear, DrawLine, LeafBurst, Pop, Settle, WaterDrops } from '../ds/motion';
import { CareCalendar } from '../ds/CareCalendar';
import { ActionSheet } from '../ds/ActionSheet';

/**
 * Freshness of what we know, shown as one mark instead of a line of text. Each state has
 * its own shape as well as its colour (WCAG 1.4.1), so it reads in greyscale and for
 * colour-blind people: full circle = current, half circle = getting old,
 * diamond = long overdue, hollow ring = nothing recorded yet. Every mark also has a
 * spoken label, and tapping a note shows the detail.
 */
type Status = 'none' | 'fresh' | 'aging' | 'overdue';
const statusSpeech: Record<Status, string> = { none: 'nothing recorded yet', fresh: 'up to date', aging: 'getting old', overdue: 'not recorded in a long time' };

export function StatusMark({ status, size = 10 }: { status: Status; size?: number }) {
  const { c } = useTheme();
  if (status === 'none') return <View style={{ width: size, height: size, borderRadius: size, borderWidth: 1.5, borderColor: c.ink3 }} />;
  if (status === 'fresh') return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: c.leafMark }} />;
  if (status === 'aging') return <View style={{ width: size, height: size, borderRadius: size, borderWidth: 1.5, borderColor: c.amber, overflow: 'hidden', flexDirection: 'row' }}>
    <View style={{ flex: 1, backgroundColor: c.amber }} /><View style={{ flex: 1 }} />
  </View>;
  return <View style={{ width: size * .8, height: size * .8, margin: size * .1, backgroundColor: c.clay, transform: [{ rotate: '45deg' }] }} />;
}

const DAY = 86400000;
function ageStatus(at: string | undefined, freshDays: number, overdueDays: number): Status {
  if (!at) return 'none';
  const days = (Date.now() - new Date(at).getTime()) / DAY;
  return days <= freshDays ? 'fresh' : days <= overdueDays ? 'aging' : 'overdue';
}

interface Callout { side: 'left' | 'right'; y: number; anchor: [number, number]; label: string; value: string | null; current: boolean; detail: string; status: Status }

/** Specimen plate: the plant in the middle, what we know about each part pinned to it. */
function Specimen({ plant, twin, width, drops, events }: { plant: PlantT; twin?: Twin; width: number; drops: number; events: CareEvent[] }) {
  const { c } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const g = twin?.guidance;
  const narrow = width < 330;
  const S = Math.min(240, width * (narrow ? .42 : .5));
  const x0 = (width - S) / 2;
  const at = (fx: number, fy: number): [number, number] => [x0 + S * fx, 8 + S * fy];
  const drainage = plant.drainage === 'No' ? 'No drainage' : plant.drainage === 'Yes' ? 'Drains' : plant.self_watering === 'Yes' ? 'Self-watering' : null;
  const light = known(plant.light) ? plant.light.replace(' light', '').replace('Bright indirect', 'Bright, indirect') : null;
  // Latest records (events arrive newest first).
  const lastSoil = events.find(e => e.type === 'Soil check' && e.soil && e.soil !== 'not_sure');
  const lastLeaves = events.find(e => e.type === 'Observation' && e.visual && e.visual !== 'not_sure');
  // Soil is current only as the Twin defines it: checked in the last day and after the last watering.
  const soilStatus: Status = g?.soil ? 'fresh' : lastSoil ? (ageStatus(lastSoil.at, 0, 7) === 'overdue' ? 'overdue' : 'aging') : 'none';
  const leafStatus = ageStatus(lastLeaves?.at, 3, 14);
  const soilBeforeWatering = !!(lastSoil && g?.last_watered_at && new Date(g.last_watered_at) > new Date(lastSoil.at));
  const wateredSince = soilBeforeWatering && g?.last_watered_at ? g.last_watered_at : null;
  const soilValue = wateredSince ? (Date.now() - new Date(wateredSince).getTime() < DAY ? 'Just watered' : `Watered ${ago(wateredSince)}`) : lastSoil?.soil ? soilLabel[lastSoil.soil] : null;
  const soilNow: Status = wateredSince ? ageStatus(wateredSince, 1, 7) : soilStatus;
  const callouts: Callout[] = [
    { side: 'left', y: 0, anchor: at(.47, .1), label: 'Light', value: light, current: true, detail: light ? 'You told us' : 'Add it in Edit details', status: light ? 'fresh' : 'none' },
    { side: 'right', y: S * .12, anchor: at(.76, .3), label: 'Leaves', value: lastLeaves?.visual ? visualLabel[lastLeaves.visual] : null, current: leafStatus === 'fresh',
      detail: lastLeaves ? `You looked ${ago(lastLeaves.at)}` : 'No note yet', status: leafStatus },
    { side: 'right', y: S * (narrow ? .72 : .64), anchor: at(.6, .64), label: 'Soil', value: soilValue, current: soilNow === 'fresh',
      detail: !lastSoil ? 'Not checked yet' : wateredSince ? `Not checked since the watering. Before it, the soil was ${soilLabel[lastSoil.soil!].toLowerCase()}.` : `Checked ${ago(lastSoil.at)}`, status: soilNow },
    { side: 'left', y: S * (narrow ? .74 : .66), anchor: at(.34, .84), label: 'Pot', value: drainage, current: true, detail: drainage ? 'You told us' : 'Add it in Edit details', status: drainage ? 'fresh' : 'none' },
  ];
  const labelW = Math.max(90, x0 - 4);
  return <View style={{ width, height: S + (narrow ? 60 : 30) }}>
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
      const expanded = open === k.label;
      return <React.Fragment key={k.label}>
        <DrawLine x={Math.min(edge, ax)} y={lineY} length={Math.abs(ax - edge)} delay={380 + i * 130} tone={c.ink3} from={k.side === 'left' ? 'start' : 'end'} />
        <DrawLine x={ax - .75} y={Math.min(lineY, ay)} length={Math.abs(ay - lineY)} vertical delay={620 + i * 130} tone={c.ink3} from={ay > lineY ? 'start' : 'end'} />
        <Pop delay={860 + i * 130} style={{ position: 'absolute', left: ax - 4, top: ay - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: has ? c.ink : c.canvas, borderWidth: 1.5, borderColor: c.ink }} />
        <Appear delay={260 + i * 130} style={{ position: 'absolute', top: k.y, width: labelW - 6, [k.side]: 0 }}>
          <Tap label={`${k.label}: ${k.value ?? 'not set'}, ${statusSpeech[k.status]}. ${k.detail}`} onPress={() => setOpen(expanded ? null : k.label)} scaleTo={.97} ring={radius.inner}
            style={{ alignItems: k.side === 'left' ? 'flex-start' : 'flex-end', paddingVertical: 2 }}>
            <View style={{ flexDirection: k.side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
              <StatusMark status={k.status} /><T v="caption" tone="ink2">{k.label}</T>
            </View>
            {has
              ? <T lines={2} style={{ fontFamily: fonts.serif, fontSize: narrow ? 17 : 21, lineHeight: narrow ? 19 : 23, textAlign: k.side, color: k.current ? c.ink : c.ink2 }}>{k.value}</T>
              : <View accessibilityElementsHidden style={{ width: 18, height: 1.5, backgroundColor: c.ink3, marginVertical: narrow ? 9 : 11 }} />}
            {expanded && <Animated.View entering={FadeIn.duration(180)}><T v="caption" tone="ink2" style={{ textAlign: k.side, fontFamily: fonts.regular }}>{k.detail}</T></Animated.View>}
          </Tap>
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



export function Plant({ navigation, route }: Props<'Plant'>) {
  const { garden, archivePlant } = useStore();
  const { c } = useTheme();
  const plant = garden.plants.find(p => p.id === route.params.id);
  const twin = garden.twins[route.params.id];
  const g = twin?.guidance;
  const [width, setWidth] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    if (/watering/i.test(saved.title)) setDrops(d => d + 1);
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
  const water = g?.last_watered_at ? Math.max(0, Math.floor((Date.now() - new Date(g.last_watered_at).getTime()) / 86400000)) : null;
  const soil = g?.last_soil_check_at ? since(g.last_soil_check_at) : null;
  const where = [known(plant.stage) ? `${plant.stage} plant` : null, known(plant.environment?.location) ? plant.environment!.location : null, garden.plan === 'Plus' && known(plant.room) ? plant.room : null].filter(Boolean).join(', ');
  const lastWater = events.find(e => e.type === 'Watered');
  const approx = !!lastWater?.note?.startsWith('Approximate');
  // Long names step down in size and stop at three lines instead of pushing the page down.
  const titleStyle = plant.name.length > 40 ? { fontSize: 26, lineHeight: 31 } : plant.name.length > 22 ? { fontSize: 32, lineHeight: 36 } : undefined;

  const remove = async () => {
    setBusy(true);
    try { await archivePlant(plant.id); navigation.navigate('Main', { tab: 'Plants' }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove.'); setBusy(false); }
  };

  return <View style={{ flex: 1 }}>
    <Page back={navigation.goBack} scrollRef={scroll} titleInBar={plant.name} gap={space[6]}
      actions={[{ icon: 'more', label: 'Plant options', onPress: () => { setMenu(true); setConfirm(false); } }]}>
      {confirm && <Toast tone="error" title={`Remove ${plant.name}?`} text="It leaves your garden and frees a plan spot. Its care history is kept." action={{ title: busy ? 'Removing…' : 'Remove', onPress: () => void remove() }} onClose={() => setConfirm(false)} />}
      {!!saved && <Animated.View key={saved.title + (saved.to ?? '')} entering={FadeIn.duration(240)}>
        <Toast title={saved.title} onClose={() => navigation.setParams({ saved: undefined })}
          text={saved.to ? `Next step changed: ${saved.to.toLowerCase()}.` : saved.title !== 'Details updated' ? 'The next step stays the same. It’s in the plant’s history.' : undefined} />
      </Animated.View>}

      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', gap: space[4] }}>
        <LeafBurst run={burst} />
        {!!width && <Specimen plant={plant} twin={twin} width={width} drops={drops} events={events} />}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="display" center lines={3} style={titleStyle}>{plant.name}</T>
          <T v="latin" tone="ink2" center>{plant.species}</T>
          {!!where && <T v="footnote" tone="ink2" style={{ marginTop: space[1] }}>{where}</T>}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space[4], paddingVertical: space[4], borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        <Figure {...(water === null ? { value: '', caption: 'No watering yet' } : water === 0 ? { value: 'Today', caption: 'Last watered' } : { value: `${approx ? '~' : ''}${water}`, unit: water === 1 ? 'day' : 'days', caption: approx ? 'Since watering (approx.)' : 'Since watering' })} />
        <Figure {...(soil ? { ...soil, caption: soil.value === 'Now' ? 'Soil checked' : 'Since soil check' } : { value: '', caption: 'No soil check yet' })} />
        <Figure {...(g?.baseline_days != null ? { value: `~${Math.round(g.baseline_days)}`, unit: 'days', caption: 'Usually dry after' } : { value: `${Math.min(g?.completed_cycles ?? 0, 3)}/3`, caption: 'Cycles to a pattern' })} />
      </View>

      <View style={{ gap: space[3] }}>
        <SourceLabel kind="suggested" />
        <T v="title">{g?.title ?? 'Start with a soil check'}</T>
        <T v="body" tone="ink2">{g?.reason ?? 'A first soil check tells Rootera where this plant is starting from.'}</T>
        {!!g?.tip && <View style={{ padding: space[4], borderRadius: radius.control, backgroundColor: c.sunken, gap: 4 }}>
          <T v="subhead" style={{ fontFamily: fonts.medium }}>{g.action === 'log_water' ? 'How to water' : g.action === 'check_soil' ? 'How to check' : 'Tip'}</T>
          <T v="subhead" tone="ink2">{g.tip}</T>
        </View>}
        {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
        {/* One check-in covers soil, watering and leaves; resting plants can still be checked. */}
        <Btn title="Check in" icon="soil" kind={g?.action === 'wait' ? 'outline' : 'filled'} onPress={() => navigation.navigate('Care', { id: plant.id, mode: 'checkin' })} style={{ marginTop: space[2] }} />
      </View>

      <View style={{ gap: space[4] }}>
        <T v="section">What Rootera knows</T>
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="suggested" text="Learned from your records" />
          {g?.baseline_days != null
            ? <T v="body">In {g.completed_cycles} watering cycles, you first found the soil dry about {Math.round(g.baseline_days)} days after watering. How often you check affects this number.</T>
            : <T v="body">Each watering followed by a dry soil check is one cycle. After three, Rootera shows how long this plant usually takes to dry.</T>}
        </View>
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="species" text={plant.kind === 'other' ? 'No species notes yet' : `${plant.species.split(' ')[0]} in general`} />
          <T v="body">{plant.kind === 'other' ? 'Guidance for this plant comes from your own checks.' : g?.reference.summary}</T>
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

    <ActionSheet visible={menu} title={plant.name} onClose={() => setMenu(false)} actions={[
      { label: 'Edit details', icon: 'edit', onPress: () => navigation.navigate('PlantForm', { editId: plant.id }) },
      { label: 'Remove from garden', icon: 'trash', destructive: true, onPress: () => setConfirm(true) },
    ]} />
  </View>;
}
