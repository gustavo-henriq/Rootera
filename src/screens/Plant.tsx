import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ago, CareEvent, describeEvent, known, newId, Plant as PlantT, soilLabel, Twin, visualLabel } from '../model';
import { color, font, radius, space } from '../theme';
import { Banner, Button, Divider, GroundShadow, Icon, IconButton, IconName, PlantArt, Press, Screen, Section, Tag, Txt } from '../ui';
import { Appear, DrawLine, LeafBurst, Pop, Reveal, Settle, Stagger, WaterDrops } from '../motion';
import { CareCalendar } from '../calendar';

interface Callout { side: 'left' | 'right'; y: number; anchor: [number, number]; label: string; value: string; meta: string; source: 'user' | 'context' }

/** Specimen plate: the plant in the middle, what we know about each part pinned to it. */
function Specimen({ plant, twin, width, drops }: { plant: PlantT; twin?: Twin; width: number; drops: number }) {
  const g = twin?.guidance;
  const S = Math.min(240, width * .5);
  const H = S + 34;
  const x0 = (width - S) / 2;
  const at = (fx: number, fy: number): [number, number] => [x0 + S * fx, 8 + S * fy];
  const drainage = plant.drainage === 'No' ? 'No drainage' : plant.drainage === 'Yes' ? 'Drains' : null;
  const potValue = known(plant.material) ? plant.material! : known(plant.pot) ? plant.pot!.replace(' pot', '') : '';
  const lightValue = known(plant.light) ? plant.light.replace(' light', '').replace('Bright indirect', 'Bright, indirect') : '';
  const callouts: Callout[] = [
    { side: 'left', y: 4, anchor: at(.47, .1), label: 'Light', value: lightValue || '—', meta: lightValue ? 'you told us' : 'not set', source: 'context' },
    { side: 'right', y: S * .1, anchor: at(.76, .3), label: 'Leaves', value: g?.visual ? visualLabel[g.visual] : '—', meta: g?.visual ? 'you observed' : 'no recent note', source: 'user' },
    { side: 'right', y: S * .6, anchor: at(.6, .64), label: 'Soil', value: g?.soil ? soilLabel[g.soil] : '—', meta: g?.soil ? ago(g.soil_checked_at) : 'not checked', source: 'user' },
    { side: 'left', y: S * .66, anchor: at(.34, .84), label: 'Pot', value: drainage ?? (potValue || '—'), meta: drainage || potValue ? 'you told us' : 'not set', source: 'context' },
  ];
  const labelW = Math.max(86, (width - S) / 2 - 6);
  return <View style={{ width, height: H }} accessible accessibilityLabel={callouts.map(c => `${c.label}: ${c.value}, ${c.meta}`).join('. ')}>
    <View style={{ position: 'absolute', left: x0, top: 8, width: S, height: S }}>
      <GroundShadow width={S * .78} style={{ position: 'absolute', bottom: -S * .05 }} />
      <Settle><PlantArt kind={plant.kind} photo={plant.photo} size={S} /></Settle>
      <WaterDrops width={S} height={S * .62} run={drops} />
    </View>
    {callouts.map((c, i) => {
      const [ax, ay] = c.anchor;
      const lineY = c.y + 7;
      const edge = c.side === 'left' ? labelW - 4 : width - labelW + 4;
      const hx = Math.min(edge, ax), hw = Math.abs(ax - edge);
      const vy = Math.min(lineY, ay), vh = Math.abs(ay - lineY);
      const known_ = c.value !== '—';
      return <React.Fragment key={c.label}>
        <DrawLine x={hx} y={lineY} length={hw} delay={420 + i * 150} tone={color.lineStrong} reverse={c.side === 'right'} />
        <DrawLine x={ax} y={vy} length={vh} vertical delay={700 + i * 150} tone={color.lineStrong} reverse={ay < lineY} />
        <Pop delay={980 + i * 150} style={[s.dot, { left: ax - 3.5, top: ay - 3.5, backgroundColor: known_ ? color.olive : color.surface }]} />
        <Appear delay={300 + i * 150} style={{ position: 'absolute', top: c.y, width: labelW - 8, [c.side]: 0, alignItems: c.side === 'left' ? 'flex-start' : 'flex-end' }}>
          <Txt v="label" tone={c.source === 'user' ? color.leafInk : color.inkMuted}>{c.label}</Txt>
          <Txt lines={2} style={{ fontFamily: font.serif, fontSize: 21, lineHeight: 23, textAlign: c.side, color: known_ ? color.ink : color.lineStrong }}>{c.value}</Txt>
          <Txt v="small" lines={1} style={{ fontSize: 12, textAlign: c.side }}>{c.meta}</Txt>
        </Appear>
      </React.Fragment>;
    })}
  </View>;
}

function Figure({ value, unit, label }: { value: string; unit?: string; label: string }) {
  // Three figures share one row; on narrow phones the numbers step down instead of wrapping.
  const size = useWindowDimensions().width < 370 ? 22 : 30;
  return <View style={{ flex: 1, gap: 2 }}>
    <Txt lines={1} style={{ fontFamily: font.display, fontSize: size, lineHeight: size + 4, color: color.ink }}>{value}{!!unit && <Txt v="small" style={{ fontSize: 14 }}> {unit}</Txt>}</Txt>
    <Txt v="small" style={{ fontSize: 12 }}>{label}</Txt>
  </View>;
}

function figures(g: Twin['guidance'] | undefined) {
  const days = (iso: string | null | undefined) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null;
  const water = days(g?.last_watered_at);
  const since = (iso: string) => {
    const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    return m < 2 ? { value: 'Now' } : m < 60 ? { value: String(Math.round(m)), unit: 'min' } : m < 1440 ? { value: String(Math.round(m / 60)), unit: 'h' } : { value: String(Math.round(m / 1440)), unit: m < 2880 ? 'day' : 'days' };
  };
  const soil = g?.last_soil_check_at ? since(g.last_soil_check_at) : null;
  return {
    water: water === null ? { value: '—', label: 'No watering recorded' } : water === 0 ? { value: 'Today', label: 'Last watered' } : { value: String(water), unit: water === 1 ? 'day' : 'days', label: 'Since watering' },
    soil: soil ? { ...soil, label: soil.value === 'Now' ? 'Soil checked' : 'Since soil check' } : { value: '—', label: 'No soil check yet' },
    cycles: g?.baseline_days != null ? { value: `~${Math.round(g.baseline_days)}`, unit: 'days', label: 'Usually dry after' } : { value: `${Math.min(g?.completed_cycles ?? 0, 3)}/3`, label: 'Cycles to a pattern' },
  };
}

const actions: Record<string, { title: string; icon: IconName; mode: 'soil' | 'water' | 'visual' } | null> = {
  check_soil: { title: 'Check the soil', icon: 'finger-print-outline', mode: 'soil' },
  log_water: { title: 'I watered it', icon: 'water-outline', mode: 'water' },
  observe: { title: 'Note how it looks', icon: 'leaf-outline', mode: 'visual' },
  wait: null,
};

export function Plant({ navigation, route }: Props<'Plant'>) {
  const { garden, logCare, archivePlant } = useStore();
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
  React.useEffect(() => {
    const k = saved ? saved.title + (saved.to ?? '') : undefined;
    if (!saved || k === lastSaved.current) return;
    lastSaved.current = k;
    // The confirmation sits at the top; bring it (and the updated plant) into view.
    scroll.current?.scrollTo({ y: 0, animated: true });
    if (saved.title === 'Watering recorded') setDrops(d => d + 1);
    if (saved.to === 'Probably not dry yet' || saved.to === 'Around when it usually dries') setBurst(b => b + 1);
  }, [saved]);

  if (!plant) {
    return <Screen back={navigation.goBack}>
      <Txt v="title">This plant isn’t in your garden</Txt>
      <Txt tone={color.inkSoft}>It may have been removed. Its history is kept on the server.</Txt>
      <Button title="Back to my plants" onPress={() => navigation.navigate('Main', { tab: 'Plants' })} />
    </Screen>;
  }

  const events = garden.events.filter(e => e.plantId === plant.id).slice().reverse();
  const f = figures(g);
  const primary = g ? actions[g.action] : actions.check_soil;

  const waterNow = async () => {
    if (busy) return;
    setBusy(true); setError('');
    // Reuse the same id on retry so a slow network never records two waterings.
    pendingWater.current ??= { id: newId('water'), plantId: plant.id, type: 'Watered', note: '', at: new Date().toISOString(), source: 'USER' };
    try {
      const r = await logCare(pendingWater.current);
      pendingWater.current = null;
      navigation.setParams({ saved: { title: 'Watering recorded', from: r.change?.from, to: r.change?.to } });
      scroll.current?.scrollTo({ y: 0, animated: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await archivePlant(plant.id); navigation.navigate('Main', { tab: 'Plants' }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove.'); setBusy(false); }
  };

  const go = (mode: 'soil' | 'water' | 'visual') => navigation.navigate('Care', { id: plant.id, mode });

  return <Screen back={navigation.goBack} scrollRef={scroll} contentStyle={{ gap: space.xl }}
    right={<IconButton name="ellipsis-horizontal" label="Plant options" onPress={() => { setMenu(!menu); setConfirm(false); }} />}>
    {menu && <Reveal style={{ position: 'absolute', right: space.gutter, top: 0, zIndex: 10, width: 220, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong, ...Platform.select({ web: { boxShadow: '0 10px 30px rgba(44,51,32,.14)' }, default: { elevation: 6, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 16 } }) }}>
      <Press label="Edit details" onPress={() => { setMenu(false); navigation.navigate('PlantForm', { editId: plant.id }); }} style={s.menuItem}><Icon name="create-outline" size={18} /><Txt>Edit details</Txt></Press>
      <Divider />
      <Press label="Remove from garden" onPress={() => { setMenu(false); setConfirm(true); }} style={s.menuItem}><Icon name="trash-outline" size={18} tone={color.danger} /><Txt tone={color.danger}>Remove from garden</Txt></Press>
    </Reveal>}

    {confirm && <Banner tone="error" title={`Remove ${plant.name}?`} text="It leaves your garden and frees a plan spot. Its care history is kept." action={{ title: busy ? 'Removing…' : 'Remove', onPress: () => void remove() }} onClose={() => setConfirm(false)} />}
    {!!saved && <Reveal key={saved.title + (saved.to ?? '')}>
      <Banner tone="success" title={saved.title} onClose={() => navigation.setParams({ saved: undefined })}
        text={saved.to ? `Next step changed: ${saved.to}.` : saved.from === undefined && saved.title !== 'Details updated' ? 'Next step stays the same. Rootera keeps this in the plant’s history.' : undefined} />
    </Reveal>}

    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', gap: space.lg }}>
      <LeafBurst run={burst} />
      {!!width && <Specimen plant={plant} twin={twin} width={width} drops={drops} />}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Txt v="hero" center>{plant.name}</Txt>
        <Txt v="latin" center>{plant.species}</Txt>
        <Txt v="label" style={{ marginTop: 6 }}>{[plant.environment?.location, known(plant.room) && garden.plan === 'Plus' ? plant.room : null].filter(x => known(x as string)).join(' · ') || 'Location not set'}</Txt>
      </View>
    </View>

    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong }}>
      <Figure {...f.water} />
      <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: color.lineStrong }} />
      <Figure {...f.soil} />
      <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: color.lineStrong }} />
      <Figure {...f.cycles} />
    </View>

    <View style={{ gap: space.md }}>
      <Tag kind="inferred" />
      <Txt v="title">{g?.title ?? 'Start with a soil check'}</Txt>
      <Txt tone={color.inkSoft}>{g?.reason ?? 'A first check tells Rootera where this plant is starting from.'}</Txt>
      {!!g?.tip && <View style={{ flexDirection: 'row', gap: 10, paddingLeft: 12, borderLeftWidth: 2, borderColor: color.leaf }}>
        <Txt v="small" style={{ flex: 1 }}><Txt v="smallStrong">How to: </Txt>{g.tip}</Txt>
      </View>}
      {!!g?.basis.length && <Txt v="small" style={{ fontSize: 12 }}>Based on: {g.basis.join(' · ').toLowerCase()}</Txt>}
      {!!error && <Banner tone="error" title="Not saved" text={error} action={{ title: 'Try again', onPress: () => void waterNow() }} />}
      {primary
        ? <View style={{ gap: space.sm, marginTop: space.xs }}>
            <Button title={primary.title} icon={primary.icon} variant={primary.mode === 'water' ? 'water' : 'primary'} busy={busy && primary.mode === 'water'} onPress={() => primary.mode === 'water' ? void waterNow() : go(primary.mode)} />
            {primary.mode === 'water' && <Button title="Add amount or a note" variant="quiet" onPress={() => go('water')} />}
          </View>
        : <Txt v="smallStrong" tone={color.leafInk}>Nothing to do right now.</Txt>}
    </View>

    <View style={{ gap: space.sm }}>
      <Txt v="label">Record something</Txt>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {([['soil', 'Soil', 'finger-print-outline'], ['water', 'Watering', 'water-outline'], ['visual', 'Leaves', 'leaf-outline']] as const).map(([mode, label, icon]) =>
          <Press key={mode} label={`Record ${label.toLowerCase()}`} onPress={() => go(mode)} style={s.quick}>
            <Icon name={icon} size={20} tone={mode === 'water' ? color.water : color.olive} />
            <Txt v="smallStrong">{label}</Txt>
          </Press>)}
      </View>
    </View>

    <Section label="What Rootera knows">
      <View style={s.fact}>
        <Tag kind="inferred" text="Learned from your records" />
        {g?.baseline_days != null
          ? <Txt>In {g.completed_cycles} watering cycles, you first found the soil dry about {Math.round(g.baseline_days)} days after watering. {g.baseline_note}</Txt>
          : <>
              <Txt>A pattern needs 3 watering cycles that each end with a dry soil check. So far: {g?.completed_cycles ?? 0}.</Txt>
              <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`${g?.completed_cycles ?? 0} of 3 cycles`}>
                {[0, 1, 2].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < (g?.completed_cycles ?? 0) ? color.leaf : color.line }} />)}
              </View>
            </>}
      </View>
      <View style={s.fact}>
        <Tag kind="reference" text={plant.kind === 'other' ? 'Species note · none yet' : 'Species note · general'} />
        <Txt>{g?.reference.summary}</Txt>
        {plant.kind !== 'other' && <Txt v="small">{g?.reference.when_dry}</Txt>}
      </View>
      {twin?.measured && <View style={s.fact}>
        <Tag kind="user" text="Sensor reading" />
        <Txt>{Math.round(twin.measured.soil_moisture_percent)}% calibrated moisture · {ago(twin.measured.observed_at)}{twin.measured.stale ? ' · outdated' : ''}</Txt>
      </View>}
      <View style={[s.fact, { borderBottomWidth: 0 }]}>
        <Tag kind="off" />
        <Txt v="small">{twin?.sources.sensor.connected ? 'Weather' : 'Soil sensor · Weather'}. Guidance here uses only your records, the details you gave and general species notes.</Txt>
      </View>
    </Section>

    <Section label="Care calendar">
      <CareCalendar events={events} />
    </Section>

    <Section label="History" action={events.length > 4 ? { title: 'See all', onPress: () => navigation.navigate('Main', { tab: 'Journal' }) } : undefined}>
      {events.length ? events.slice(0, 5).map((e, i) => <View key={e.id} style={[s.event, i === Math.min(events.length, 5) - 1 && { borderBottomWidth: 0 }]}>
        <Icon name={e.type === 'Watered' ? 'water' : e.type === 'Soil check' ? 'finger-print' : 'leaf'} size={16} tone={e.type === 'Watered' ? color.water : color.olive} />
        <View style={{ flex: 1 }}>
          <Txt v="body">{describeEvent(e)}</Txt>
          {!!e.note && <Txt v="small">“{e.note}”</Txt>}
        </View>
        <Txt v="small">{ago(e.at)}</Txt>
      </View>) : <Txt v="small">Nothing recorded yet. Your first check will show up here.</Txt>}
    </Section>
  </Screen>;
}

const s = StyleSheet.create({
  line: { position: 'absolute', backgroundColor: color.lineStrong },
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: color.olive },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 48 },
  quick: { flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: color.surface },
  fact: { gap: 6, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong },
  event: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
});
