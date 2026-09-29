import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Props } from '../navigation';
import { api } from '../api';
import { useStore } from '../store';
import { ago, CareEvent, describeEvent, known, Plant as PlantT, soilLabel, Twin, visualLabel } from '../model';
import { useCompact, useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Group, Row, T, Tap, Toast } from '../ds/components';
import { Page } from '../ds/Page';
import { Ground, PlantArt } from '../ds/plant';
import { Appear, DrawLine, LeafBurst, pivot, Pop, Settle, WaterDrops } from '../ds/motion';
import { ActionSheet } from '../ds/ActionSheet';
import { SeedDrop } from '../ds/SeedDrop';
import { announce, haptic } from '../ds/feedback';
import { WhySheet } from '../ds/WhySheet';
import { Farewell, FarewellSheet } from './Farewell';
import { CareCalendar } from '../ds/CareCalendar';
import { DryWindow } from '../ds/DryWindow';
import Svg, { Circle } from 'react-native-svg';
import { Flight, measure, Rect } from '../ds/Flight';
import { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { springs } from '../ds/tokens';
import { t } from '../i18n';

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
function Specimen({ plant, twin, width, drops, events, arriving, artRef }: { plant: PlantT; twin?: Twin; width: number; drops: number; events: CareEvent[]; arriving?: boolean; artRef?: React.RefObject<View | null> }) {
  const { c, reduceMotion } = useTheme();
  const compact = useCompact();
  // The plant "drinks" when a watering is recorded: a small squash, then it straightens.
  const drink = useSharedValue(1);
  useEffect(() => {
    if (!drops || reduceMotion) return;
    drink.value = withDelay(380, withSequence(withTiming(.94, { duration: 180 }), withTiming(1.03, { duration: 200 }), withSpring(1, springs.bouncy)));
  }, [drops]);
  const [open, setOpen] = useState<string | null>(null);
  const g = twin?.guidance;
  const narrow = width < 330;
  const S = Math.min(240, width * (narrow ? .42 : .5));
  const drinkStyle = useAnimatedStyle(() => ({ transform: pivot(S, S, .5, 1, [{ scaleY: drink.value }]) }));
  const x0 = (width - S) / 2;
  const at = (fx: number, fy: number): [number, number] => [x0 + S * fx, 8 + S * fy];
  const drainage = plant.drainage === 'No' ? t('No drainage') : plant.drainage === 'Yes' ? t('Drains') : plant.self_watering === 'Yes' ? t('Self-watering') : null;
  const light = known(plant.light) ? t(plant.light.replace(' light', '').replace('Bright indirect', 'Bright, indirect')) : null;
  // Latest records (events arrive newest first).
  const lastSoil = events.find(e => e.type === 'Soil check' && e.soil && e.soil !== 'not_sure');
  const lastLeaves = events.find(e => e.type === 'Observation' && e.visual && e.visual !== 'not_sure');
  // Soil is current only as the Twin defines it: checked in the last day and after the last watering.
  const soilStatus: Status = g?.soil ? 'fresh' : lastSoil ? (ageStatus(lastSoil.at, 0, 7) === 'overdue' ? 'overdue' : 'aging') : 'none';
  const leafStatus = ageStatus(lastLeaves?.at, 3, 14);
  const soilBeforeWatering = !!(lastSoil && g?.last_watered_at && new Date(g.last_watered_at) > new Date(lastSoil.at));
  const wateredSince = soilBeforeWatering && g?.last_watered_at ? g.last_watered_at : null;
  const soilValue = wateredSince ? (Date.now() - new Date(wateredSince).getTime() < DAY ? t('Just watered') : t('Watered {ago}', { ago: ago(wateredSince) })) : lastSoil?.soil ? soilLabel[lastSoil.soil] : null;
  const soilNow: Status = wateredSince ? ageStatus(wateredSince, 1, 7) : soilStatus;
  const callouts: Callout[] = [
    { side: 'left', y: 0, anchor: at(.47, .1), label: t('Light'), value: light, current: true, detail: light ? t('You told us') : t('Add it in Edit details'), status: light ? 'fresh' : 'none' },
    { side: 'right', y: S * .12, anchor: at(.76, .3), label: t('Leaves'), value: lastLeaves?.visual ? visualLabel[lastLeaves.visual] : null, current: leafStatus === 'fresh',
      detail: lastLeaves ? t('You looked {ago}', { ago: ago(lastLeaves.at) }) : t('No note yet'), status: leafStatus },
    { side: 'right', y: S * (narrow ? .72 : .64), anchor: at(.6, .64), label: t('Soil'), value: soilValue, current: soilNow === 'fresh',
      detail: !lastSoil ? t('Not checked yet') : wateredSince ? t('Not checked since the watering. Before it, the soil was {v}.', { v: soilLabel[lastSoil.soil!].toLowerCase() }) : t('Checked {ago}', { ago: ago(lastSoil.at) }), status: soilNow },
    { side: 'left', y: S * (narrow ? .74 : .66), anchor: at(.34, .84), label: t('Pot'), value: drainage, current: true, detail: drainage ? t('You told us') : t('Add it in Edit details'), status: drainage ? 'fresh' : 'none' },
  ];
  const labelW = Math.max(90, x0 - 4);
  if (compact) return <View style={{ width, alignItems: 'center', gap: space[3] }}>
    <View style={{ width: Math.min(200, width * .6), height: Math.min(200, width * .6) }}>
      <Settle><PlantArt kind={plant.kind} photo={plant.photo} size={Math.min(200, width * .6)} /></Settle>
      <WaterDrops width={Math.min(200, width * .6)} height={Math.min(200, width * .6) * .62} run={drops} />
    </View>
    <View style={{ alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
      {callouts.map(k => <View key={k.label} accessible accessibilityLabel={`${k.label}: ${k.value ?? t('not set')}, ${t(statusSpeech[k.status])}. ${k.detail}`}
        style={{ paddingVertical: space[3], gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}><StatusMark status={k.status} /><T v="footnote" tone="ink2">{k.label}</T></View>
        <T v="headline">{k.value ?? t('Not set')}</T>
        <T v="footnote" tone="ink2">{k.detail}</T>
      </View>)}
    </View>
  </View>;
  return <View style={{ width, height: S + (narrow ? 60 : 30) }}>
    <View ref={artRef} collapsable={false} style={{ position: 'absolute', left: x0, top: 8, width: S, height: S, opacity: arriving ? 0 : 1 }}>
      <Ground width={S * .8} style={{ position: 'absolute', bottom: -S * .06 }} />
      <Animated.View style={[{ width: S, height: S }, drinkStyle]}>
        {/* Arriving from a tile, the plant has already moved; settling again would be double motion. */}
        {artRef && arriving !== undefined ? <PlantArt kind={plant.kind} photo={plant.photo} size={S} /> : <Settle><PlantArt kind={plant.kind} photo={plant.photo} size={S} /></Settle>}
      </Animated.View>
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
          <Tap label={`${k.label}: ${k.value ?? t('not set')}, ${t(statusSpeech[k.status])}. ${k.detail}`} onPress={() => setOpen(expanded ? null : k.label)} scaleTo={.97} ring={radius.inner}
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

/**
 * Three watering cycles make a pattern. Each finished cycle closes one arc of the ring,
 * so the next step toward "what Rootera learned" is visible (goal gradient), and the new
 * arc pops in when a cycle completes.
 */
function CycleRing({ done }: { done: number }) {
  const { c } = useTheme();
  const R = 17, C = 2 * Math.PI * R, gap = 5, len = C / 3 - gap;
  return <View accessible accessibilityLabel={t('{n} of 3 watering cycles toward a pattern', { n: done })} style={{ flex: 1, gap: 2 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 38 }}>
      <Pop key={done} delay={120}>
        <Svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: [{ rotate: '-90deg' }] }}>
          {[0, 1, 2].map(k => <Circle key={k} cx={20} cy={20} r={R} fill="none" strokeWidth={5} strokeLinecap="round"
            stroke={k < done ? c.leafMark : c.sunken} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-(k * C / 3)} />)}
        </Svg>
      </Pop>
      <T v="figure" style={{ fontSize: 24, lineHeight: 28 }}>{done}/3</T>
    </View>
    <T v="footnote" tone="ink2">{t("Cycles to a pattern")}</T>
  </View>;
}

/** A plant reaching its next stage: the same growing moment as planting it, then back to the page. */
function Milestone({ plant, stage, onDone }: { plant: PlantT; stage: string; onDone: () => void }) {
  const { c, reduceMotion } = useTheme();
  const line = t('{name} is now {stage}', { name: plant.name, stage: t(stage).toLowerCase() });
  useEffect(() => { haptic.bloom(); announce(line); }, []);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${line}. ${t('Continue')}`} onPress={onDone}
    style={[StyleSheet.absoluteFill, { zIndex: 40, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', gap: space[5], padding: space.gutter }]}>
    <SeedDrop size={260} run={1} kind={plant.kind} onDone={() => setTimeout(onDone, reduceMotion ? 900 : 1600)} />
    <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(900)} style={{ alignItems: 'center', gap: space[1] }}>
      <T v="footnote" tone="ink2">{t("New stage")}</T>
      <T v="hero" center>{line}</T>
      <T v="callout" tone="ink2" center>{t("Tap to continue")}</T>
    </Animated.View>
  </Pressable>;
}

export function Plant({ navigation, route }: Props<'Plant'>) {
  const { garden, archivePlant, removeCare, updatePlant } = useStore();
  const { c } = useTheme();
  const plant = garden.plants.find(p => p.id === route.params.id);
  const twin = garden.twins[route.params.id];
  const g = twin?.guidance;
  const [width, setWidth] = useState(0);
  const [menu, setMenu] = useState(false);
  const [why, setWhy] = useState(false);
  const [notes, setNotes] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);
  const shownMilestone = useRef<string | undefined>(undefined);
  useEffect(() => {
    const m = route.params.saved?.milestone;
    if (m && shownMilestone.current !== route.params.saved?.title + m) { shownMilestone.current = route.params.saved?.title + m; setMilestone(m); }
  }, [route.params.saved?.milestone]);
  const [confirm, setConfirm] = useState(false);
  const leaving = useRef(false);
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
    if (saved.title === t('Check-in and watering saved') || saved.title === t('Watering recorded')) setDrops(d => d + 1);
    if (saved.to === 'Probably not dry yet' || saved.to === 'Around when it usually dries') setBurst(b => b + 1);
  }, [saved]);

  // Shared-element flight from the tile that was tapped (see ds/Flight).
  const { reduceMotion } = useTheme();
  const flyFrom = !reduceMotion ? route.params.from : undefined;
  const artRef = useRef<View>(null);
  const [landing, setLanding] = useState<Rect | null>(null);
  const [flight, setFlight] = useState<'waiting' | 'flying' | 'done'>(flyFrom ? 'waiting' : 'done');
  useEffect(() => {
    if (!flyFrom || !width || flight !== 'waiting') return;
    const timer = setTimeout(() => measure(artRef, r => { setLanding(r); setFlight('flying'); }), 30);
    const safety = setTimeout(() => setFlight('done'), 1200);
    return () => { clearTimeout(timer); clearTimeout(safety); };
  }, [width, flyFrom]);

  // The garden snapshot carries only recent records; a plant's own page fetches its full history.
  const [older, setOlder] = useState<CareEvent[]>([]);
  useEffect(() => {
    if (garden.events_complete !== false) { setOlder([]); return; }
    let live = true;
    api.journal({ plant: route.params.id, limit: 500 }).then(r => { if (live) setOlder(r.events); }).catch(() => undefined);
    return () => { live = false; };
  }, [route.params.id, garden.events_complete, garden.events.length]);

  // Just said goodbye: the page is on its way back to Today, not a missing plant.
  if (!plant && leaving.current) return <View style={{ flex: 1, backgroundColor: c.canvas }} />;
  if (!plant) {
    return <Page back={navigation.goBack}>
      <T v="title">{t("This plant isn’t in your garden")}</T>
      <T v="callout" tone="ink2">{t("It may have been removed. Its history is kept.")}</T>
      <Btn title={t("Back to my plants")} onPress={() => navigation.navigate('Main', { tab: 'Plants' })} />
    </Page>;
  }

  const recentHere = garden.events.filter(e => e.plantId === plant.id).slice().reverse();
  const seen = new Set(recentHere.map(e => e.id));
  const events = [...recentHere, ...older.filter(e => !seen.has(e.id))].sort((a, b) => b.at.localeCompare(a.at));
  const where = [known(plant.stage) ? t(`${plant.stage} plant`) : null, known(plant.environment?.location) ? t(plant.environment!.location) : null, garden.plan === 'Plus' && known(plant.room) ? plant.room : null].filter(Boolean).join(', ');
  // Long names step down in size and stop at three lines instead of pushing the page down.
  const titleStyle = plant.name.length > 40 ? { fontSize: 26, lineHeight: 31 } : plant.name.length > 22 ? { fontSize: 32, lineHeight: 36 } : undefined;

  // Undo removes exactly the records this save created (newest first) and restores a changed stage.
  const undo = async () => {
    const u = saved?.undo;
    if (!u || busy) return;
    setBusy(true);
    try {
      for (const id of [...u.ids].reverse()) await removeCare(plant.id, id);
      if (u.stage) await updatePlant(plant.id, { stage: u.stage });
      navigation.setParams({ saved: { title: t('Check-in undone') } });
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not undo.')); }
    finally { setBusy(false); }
  };
  // Leaving through the farewell: the plant is archived with its reason, then Today.
  const leave = async (reason: Farewell) => {
    leaving.current = true;
    try { await archivePlant(plant.id, reason); }
    catch (e) { leaving.current = false; throw e; }
    navigation.navigate('Main', { tab: 'Today' });
  };

  return <View style={{ flex: 1 }}>
    <Page back={navigation.goBack} scrollRef={scroll} titleInBar={plant.name} gap={space[6]}
      actions={[{ icon: 'more', label: t('Plant options'), onPress: () => { setMenu(true); setConfirm(false); } }]}>
      {!!saved && <Animated.View key={saved.title + (saved.to ?? '')} entering={FadeIn.duration(240)}>
        <Toast title={saved.title} onClose={() => navigation.setParams({ saved: undefined })}
          text={saved.to ? t('Next step changed: {v}.', { v: t(saved.to).toLowerCase() }) : saved.title !== t('Details updated') && saved.title !== t('Check-in undone') ? t('The next step stays the same. It’s in the plant’s history.') : undefined}
          action={saved.undo?.ids.length ? { title: busy ? t('Undoing…') : t('Undo'), onPress: () => void undo() } : undefined} />
      </Animated.View>}

      {/* The page reads top to bottom as: the plant, what to do now, its rhythm, then the rest.
          Everything else (history, photos, species notes) is one tap away in plain rows. */}
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center', gap: space[4] }}>
        <LeafBurst run={burst} />
        {!!width && <Specimen plant={plant} twin={twin} width={width} drops={drops} events={events} artRef={flyFrom ? artRef : undefined} arriving={flyFrom ? flight !== 'done' : undefined} />}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="display" center lines={3} style={titleStyle}>{plant.name}</T>
          <T v="latin" tone="ink2" center>{plant.species}</T>
          {!!where && <T v="footnote" tone="ink2">{where}</T>}
          {plant.example && <T v="footnote" tone="ink2" center style={{ marginTop: space[2], maxWidth: 320 }}>{t('Example plant, with three demo cycles. It does not count toward your plan.')}</T>}
        </View>
      </View>

      {/* What to do now: the next step and the one button that acts on it. */}
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <T v="title" style={{ flex: 1 }}>{g?.title ?? t('Start with a soil check')}</T>
          {!!g?.basis?.length && <Tap label={t("Why this suggestion?")} onPress={() => setWhy(true)} ring={radius.inner} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
            <T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Why?")}</T>
          </Tap>}
        </View>
        <T v="body" tone="ink2">{g?.reason ?? t('A first soil check tells Rootera where this plant is starting from.')}</T>
        {!!error && <Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} />}
        {/* One check-in covers soil, watering and leaves; resting plants can still be checked. */}
        <Btn title={t("Check in")} icon="soil" kind={g?.action === 'wait' ? 'outline' : 'filled'} onPress={() => navigation.navigate('Care', { id: plant.id, mode: 'checkin' })} style={{ marginTop: space[2] }} />
      </View>

      {/* Its rhythm: when it usually dries, and the month of care that taught Rootera that. */}
      <View style={{ gap: space[5] }}>
        {g?.forecast ? <DryWindow forecast={g.forecast} lastWatered={g.last_watered_at} compact /> : <CycleRing done={Math.min(g?.completed_cycles ?? 0, 3)} />}
        <CareCalendar events={events} />
      </View>

      <Group>
        <Row title={t('Plant history')} detail={events.length ? t('{n} records, the latest {ago}', { n: events.length, ago: ago(events[0].at) }) : t('Nothing recorded yet')}
          onPress={() => navigation.navigate('Main', { screen: 'Journal', params: { plant: plant.id, show: 'history' } } as never)} />
        <Row title={t('Plant photos')} detail={garden.plan === 'Plus' ? t('Growth diary') : t('Growth diary, with Rootera+')}
          onPress={() => navigation.navigate('Main', { screen: 'Journal', params: { plant: plant.id, show: 'photos' } } as never)} />
        {plant.kind !== 'other' && !!g?.reference.summary && <Row title={t('{genus} in general', { genus: plant.species.split(' ')[0] })} detail={notes ? g.reference.summary : t('What the species usually likes')}
          onPress={() => setNotes(n => !n)} />}
      </Group>
    </Page>

    <FarewellSheet plant={plant} visible={confirm} onClose={() => setConfirm(false)} onConfirm={leave} />
    {!!milestone && <Milestone plant={plant} stage={milestone} onDone={() => setMilestone(null)} />}
    {flight === 'flying' && flyFrom && landing && <Flight kind={plant.kind} photo={plant.photo} from={flyFrom} to={landing} onDone={() => setFlight('done')} />}
    <WhySheet visible={why} onClose={() => setWhy(false)} title={g?.title ?? ''} reason={[g?.reason, g?.tip].filter(Boolean).join('\n\n')} basis={g?.basis ?? []} />
    <ActionSheet visible={menu} title={plant.name} onClose={() => setMenu(false)} actions={[
      { label: t('Edit details'), icon: 'edit', onPress: () => navigation.navigate('PlantForm', { editId: plant.id }) },
      { label: t('Remove from garden'), icon: 'trash', destructive: true, onPress: () => setConfirm(true) },
    ]} />
  </View>;
}
