import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { BottomTabScreenProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useScrollToTop } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props, Routes, Tabs } from '../navigation';
import { useStore } from '../store';
import { api } from '../api';
import { atCapacity, byUrgency, CareEvent, describeEvent, experienceLabel, Garden, known, LOCALE, Plant, searchText } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space, type } from '../ds/tokens';
import { Btn, Chip, FloatingTabBar, Group, Row, SourceLabel, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, PlantArt, plantArt } from '../ds/plant';
import { Pop, Settle } from '../ds/motion';
import { PickerSheet } from '../ds/PickerSheet';
import { ActionSheet } from '../ds/ActionSheet';
import { measure, Rect } from '../ds/Flight';
import { NameInvite } from './NameInvite';
import { ROUND_SIZE } from './Round';
import Swipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { haptic } from '../ds/feedback';

const Tab = createBottomTabNavigator<Tabs>();
type TabProps<T extends keyof Tabs> = CompositeScreenProps<BottomTabScreenProps<Tabs, T>, NativeStackScreenProps<Routes>>;

const tabs: { key: keyof Tabs; label: string; icon: GlyphName }[] = [
  { key: 'Today', label: 'Today', icon: 'today' }, { key: 'Plants', label: 'Plants', icon: 'shelf' },
  { key: 'Journal', label: 'Journal', icon: 'journal' }, { key: 'You', label: 'You', icon: 'person' },
];

export function Main({ route }: Props<'Main'>) {
  const insets = useSafeAreaInsets();
  return <Tab.Navigator initialRouteName={route.params?.tab ?? 'Today'} screenOptions={{ headerShown: false }}
    tabBar={({ state, navigation }) => <FloatingTabBar bottomInset={insets.bottom} active={state.routes[state.index].name}
      onSelect={k => { const r = state.routes.find(x => x.name === k)!; const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true }); if (!e.defaultPrevented) navigation.navigate(k); }}
      items={tabs} />}>
    <Tab.Screen name="Today" component={Today} />
    <Tab.Screen name="Plants" component={Plants} />
    <Tab.Screen name="Journal" component={Journal} />
    <Tab.Screen name="You" component={You} />
  </Tab.Navigator>;
}

function Offline() {
  const { offline, refresh } = useStore();
  return offline ? <Toast tone="info" title="Showing your last saved garden" text="Rootera’s server can’t be reached. New records won’t save until it’s back." action={{ title: 'Try again', onPress: () => void refresh() }} /> : null;
}

// One entry point for care: the check-in asks about soil, watering and leaves in one go.
const CHECK_IN = { title: 'Check in', mode: 'checkin' as const, icon: 'soil' as GlyphName };
const quick: Record<string, typeof CHECK_IN | null> = { check_soil: CHECK_IN, log_water: CHECK_IN, observe: CHECK_IN, wait: null };

/**
 * The light of the day, as a faint wash behind Today: cool in the morning, leafy at midday,
 * warm late in the afternoon, dim at night. Set once when the screen opens; text sits on
 * solid paper below it, so contrast is unchanged.
 */
function daylight(scheme: 'light' | 'dark') {
  const h = new Date().getHours();
  const k = scheme === 'dark' ? .55 : 1;
  if (h >= 5 && h < 11) return `rgba(142,203,178,${.26 * k})`;
  if (h >= 11 && h < 16) return `rgba(214,236,160,${.30 * k})`;
  if (h >= 16 && h < 20) return `rgba(232,180,96,${.20 * k})`;
  return `rgba(70,110,130,${.18 * k})`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Plants by id, so rows look their plant up in O(1) instead of scanning the garden. */
function usePlantIndex(garden: Garden) {
  return useMemo(() => new Map(garden.plants.map(p => [p.id, p])), [garden.plants]);
}

const Thumb = memo(function Thumb({ plant, size = 64 }: { plant: Plant; size?: number }) {
  const { c } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: radius.control, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
    <PlantArt kind={plant.kind} photo={plant.photo} size={size * .95} />
  </View>;
});

/** The empty shelf, shared by Today and Plants: what happens next and one way to start. */
function EmptyShelf({ onAdd }: { onAdd: () => void }) {
  return <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[6] }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{(['snake-plant', 'monstera', 'pilea'] as const).map((k, i) => {
      const img = <Image key={k} source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 130 : 96, height: i === 1 ? 130 : 96, marginHorizontal: -10 }} />;
      return i === 1 ? <Settle key={k} delay={250}>{img}</Settle> : img;
    })}</View>
    <Ground width={240} style={{ marginTop: -18 }} />
    <T v="title2" center>Your shelf is empty</T>
    <T v="callout" tone="ink2" center>Add a plant and do a first soil check. Rootera starts learning from there.</T>
    <Btn title="Add a plant" icon="plus" onPress={onAdd} style={{ alignSelf: 'stretch' }} />
  </View>;
}

function SectionHead({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2], paddingTop: space[5], paddingBottom: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
    <T v="section" style={{ flex: 1 }}>{title}{count ? <T v="footnote" tone="ink2">{`  ${count} ${count === 1 ? 'plant' : 'plants'}`}</T> : null}</T>
    {action}
  </View>;
}

const NeedRow = memo(function NeedRow({ plant, title, action, narrow, onOpen, onCheck }: { plant: Plant; title?: string; action?: string; narrow: boolean; onOpen: (p: Plant) => void; onCheck: (p: Plant) => void }) {
  const { c } = useTheme();
  const q = action ? quick[action] : quick.check_soil;
  const swipe = useRef<SwipeableMethods>(null);
  // Swipe left for a one-handed check-in; the button stays for everyone else (and screen readers).
  return <Swipeable ref={swipe} friction={1.6} rightThreshold={64} overshootRight={false}
    onSwipeableOpen={() => { haptic.select(); swipe.current?.close(); onCheck(plant); }}
    renderRightActions={() => <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: 104, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.successSoft, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
      <Glyph name="soil" size={20} tone={c.leafText} /><T v="footnote" tone="leafText" style={{ fontFamily: fonts.medium }}>Check in</T>
    </View>}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.canvas }}>
    <Tap label={`${plant.name}: ${title}`} onPress={() => onOpen(plant)} scaleTo={.99} ring={radius.control} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Thumb plant={plant} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline" lines={1}>{plant.name}</T>
        <T v="subhead" tone="ink2" lines={2}>{title ?? 'Start with a soil check'}</T>
      </View>
    </Tap>
    {/* The accessible name carries the plant, so a list is never "Check in, Check in, Check in". */}
    {q && <Btn size="regular" kind="outline" icon={narrow ? undefined : q.icon} title={narrow ? 'Check' : q.title} label={`${q.title}, ${plant.name}`} onPress={() => onCheck(plant)} />}
  </View>
  </Swipeable>;
});

const RestRow = memo(function RestRow({ plant, title, onOpen }: { plant: Plant; title?: string; onOpen: (p: Plant) => void }) {
  const { c } = useTheme();
  return <Tap label={`${plant.name}: ${title}`} onPress={() => onOpen(plant)} scaleTo={.99} ring={radius.inner}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
    <Thumb plant={plant} size={48} />
    <View style={{ flex: 1 }}><T v="body" lines={1}>{plant.name}</T><T v="footnote" tone="ink2" lines={1}>{title}</T></View>
    <Glyph name="forward" size={15} tone={c.ink3} />
  </Tap>;
});

const NEEDS_PREVIEW = 5;
type TodayItem = { k: 'head'; title: string; count?: number; action?: React.ReactNode } | { k: 'need' | 'rest'; plant: Plant }
  | { k: 'event'; event: CareEvent } | { k: 'calm' } | { k: 'more'; hidden: number };

function Today({ navigation }: TabProps<'Today'>) {
  const { garden, refresh } = useStore();
  const { c, scheme } = useTheme();
  // On narrow phones the quick action keeps a short text label so the plant name keeps its room.
  const narrow = useWindowDimensions().width < 370;
  const ref = useRef(null); useScrollToTop(ref);
  const [allNeeds, setAllNeeds] = useState(false);
  const index = usePlantIndex(garden);
  const sorted = useMemo(() => byUrgency(garden), [garden]);
  const needs = useMemo(() => sorted.filter(p => garden.twins[p.id]?.guidance.action !== 'wait'), [sorted, garden.twins]);
  const resting = useMemo(() => sorted.filter(p => garden.twins[p.id]?.guidance.action === 'wait'), [sorted, garden.twins]);
  const recent = garden.events.slice(-3).reverse();
  const first = garden.name.split(' ')[0];
  const open = useCallback((p: Plant) => navigation.navigate('Plant', { id: p.id }), [navigation]);
  const check = useCallback((p: Plant) => navigation.navigate('Care', { id: p.id, mode: 'checkin' }), [navigation]);

  // Long lists show the most urgent few; the rest is one tap away (Hick's law, less scanning).
  const shownNeeds = allNeeds || needs.length <= NEEDS_PREVIEW + 2 ? needs : needs.slice(0, NEEDS_PREVIEW);
  const items: TodayItem[] = !garden.plants.length ? [] : [
    { k: 'head', title: 'Needs you', count: needs.length },
    ...(needs.length ? shownNeeds.map(p => ({ k: 'need' as const, plant: p })) : [{ k: 'calm' as const }]),
    ...(shownNeeds.length < needs.length ? [{ k: 'more' as const, hidden: needs.length - shownNeeds.length }] : []),
    ...(allNeeds && needs.length > NEEDS_PREVIEW + 2 ? [{ k: 'more' as const, hidden: 0 }] : []),
    ...(recent.length ? [{ k: 'head' as const, title: 'Recently', action: <Tap label="Open the journal" onPress={() => navigation.navigate('Journal')} ring={radius.inner} style={{ minHeight: 44, justifyContent: 'center' }}><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>Journal</T></Tap> }, ...recent.map(e => ({ k: 'event' as const, event: e }))] : []),
    ...(resting.length ? [{ k: 'head' as const, title: 'Resting', count: resting.length }, ...resting.map(p => ({ k: 'rest' as const, plant: p }))] : []),
  ];

  return <Page tab scrollRef={ref} titleInBar="Today" gap={space[4]} glow={daylight(scheme)} onRefresh={refresh} actions={[{ icon: 'plus', label: 'Add a plant', onPress: () => navigation.navigate('AddPlant') }]}
    header={<View style={{ gap: space[1] }}>
      <T v="footnote" tone="ink2">{new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })}</T>
      <T v="display">{greeting()}{first ? `,\n${first}` : ''}</T>
    </View>}
    list={{
      data: items,
      keyExtractor: (i: TodayItem) => i.k === 'head' ? `h-${i.title}` : i.k === 'need' || i.k === 'rest' ? `${i.k}-${i.plant.id}` : i.k === 'event' ? `e-${i.event.id}` : i.k,
      renderItem: (i: TodayItem) => {
        if (i.k === 'head') return <SectionHead title={i.title} count={i.count} action={i.action} />;
        if (i.k === 'need') return <NeedRow plant={i.plant} title={garden.twins[i.plant.id]?.guidance.title} action={garden.twins[i.plant.id]?.guidance.action} narrow={narrow} onOpen={open} onCheck={check} />;
        if (i.k === 'rest') return <RestRow plant={i.plant} title={garden.twins[i.plant.id]?.guidance.title} onOpen={open} />;
        if (i.k === 'event') return <EventRow event={i.event} plant={index.get(i.event.plantId)} onPress={() => navigation.navigate('Plant', { id: i.event.plantId })} />;
        if (i.k === 'more') return <Tap label={i.hidden ? `Show all ${needs.length} plants that need you` : 'Show fewer'} onPress={() => setAllNeeds(!allNeeds)} ring={radius.inner} style={{ minHeight: 48, justifyContent: 'center' }}>
          <T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{i.hidden ? `Show all ${needs.length}` : 'Show fewer'}</T>
        </Tap>;
        return <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center', paddingVertical: space[4], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <Glyph name="leaf" tone={c.leafMark} />
          <T v="callout" style={{ flex: 1 }}>Nothing needs you right now. A plant shows up here when a check would help.</T>
        </View>;
      },
    }}>
    <Offline />
    <NameInvite />
    {needs.length >= 3 && <RoundCard count={needs.length} onStart={() => navigation.navigate('Round')} />}
    {!garden.plants.length && <EmptyShelf onAdd={() => navigation.navigate('AddPlant', { first: true })} />}
  </Page>;
}

/** One entry for many check-ins: the round asks one question per plant. About 10 s each. */
function RoundCard({ count, onStart }: { count: number; onStart: () => void }) {
  const { c } = useTheme();
  const size = Math.min(count, ROUND_SIZE);
  const minutes = Math.max(1, Math.round(size * 10 / 60));
  return <View style={{ padding: space[4], gap: space[3], borderRadius: radius.card, backgroundColor: c.successSoft }}>
    <View style={{ gap: 2 }}>
      <T v="headline">Check-in round</T>
      <T v="subhead" tone="ink2">{count > size ? `The ${size} most urgent of ${count}` : `${count} plants`}, about {minutes} {minutes === 1 ? 'minute' : 'minutes'}. One question each.</T>
    </View>
    <Btn title="Start the round" icon="soil" onPress={onStart} />
  </View>;
}

/** A plant rising out of its tile, like a pot on the edge of a shelf. */
const Tile = memo(function Tile({ plant, width, onPress, needs, where, animate }: { plant: Plant; width: number; onPress: (p: Plant, from?: Rect) => void; needs: boolean; where: string | null; animate: number | null }) {
  const { c } = useTheme();
  const artRef = useRef<View>(null);
  // The illustration's position is measured on tap so it can fly into the plant page.
  const art = <View ref={artRef} collapsable={false}><PlantArt kind={plant.kind} photo={plant.photo} size={width * .8} /></View>;
  return <Tap label={`${plant.name}, ${needs ? 'needs you' : 'resting'}`} onPress={() => { let done = false; const go = (r?: Rect) => { if (done) return; done = true; onPress(plant, r); }; measure(artRef, go); setTimeout(() => go(), 80); }} ring={radius.card} style={{ width, paddingTop: width * .36, marginBottom: space[4] }}>
    <View style={{ height: width * .9, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: c.sunken, justifyContent: 'flex-end', padding: space[3], gap: 2 }}>
      <T v="headline" lines={1}>{plant.name}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: needs ? c.clay : c.leafMark }} />
        <T v="footnote" tone={needs ? 'clayText' : 'ink2'} lines={1}>{needs ? 'Needs you' : 'Resting'}</T>
      </View>
      {!!where && <T v="footnote" tone="ink2" lines={1}>{where}</T>}
    </View>
    {/* Only the first screenful pops in; tiles further down just appear, so scrolling stays smooth. */}
    {animate !== null
      ? <Pop delay={animate} style={{ position: 'absolute', top: 0, left: width * .1, right: width * .1, alignItems: 'center' }}>{art}</Pop>
      : <View style={{ position: 'absolute', top: 0, left: width * .1, right: width * .1, alignItems: 'center' }}>{art}</View>}
  </Tap>;
});

function SearchField({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], borderBottomWidth: 1, borderColor: c.ink3 }}>
    <Glyph name="search" size={20} tone={c.ink2} />
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={c.ink3} returnKeyType="search" maxFontSizeMultiplier={1.5}
      style={[type.body, { flex: 1, minHeight: 48, color: c.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
    {!!value && <Tap label="Clear search" onPress={() => onChange('')} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={16} tone={c.ink2} /></Tap>}
  </View>;
}

type PlantCell = { k: 'plant'; plant: Plant } | { k: 'add' };

function Plants({ navigation }: TabProps<'Plants'>) {
  const { garden, refresh } = useStore();
  const { c } = useTheme();
  const ref = useRef(null); useScrollToTop(ref);
  const screenW = Math.min(useWindowDimensions().width, 440);
  const col = (screenW - space.gutter * 2 - space[3]) / 2;
  const [room, setRoom] = useState('All');
  const [q, setQ] = useState('');
  const plus = garden.plan === 'Plus';
  // Rooms in natural order ("Room 2" before "Room 10"), each with how many plants it holds.
  const rooms = useMemo(() => {
    const count = new Map<string, number>();
    garden.plants.forEach(p => { if (known(p.room)) count.set(p.room, (count.get(p.room) ?? 0) + 1); });
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
  }, [garden.plants]);
  const t = searchText(q);
  const list = useMemo(() => byUrgency(garden)
    .filter(p => !plus || room === 'All' || p.room === room)
    .filter(p => !t || searchText(`${p.name} ${p.species} ${p.room}`).includes(t)), [garden, plus, room, t]);
  const full = atCapacity(garden);
  const add = () => navigation.navigate(full ? 'Plans' : 'AddPlant', full ? { reason: 'limit' } : undefined as any);
  const openPlant = useCallback((p: Plant, from?: Rect) => navigation.navigate('Plant', { id: p.id, from }), [navigation]);
  const cells: PlantCell[] = garden.plants.length ? [...list.map(p => ({ k: 'plant' as const, plant: p })), ...(t ? [] : [{ k: 'add' as const }])] : [];

  return <Page tab scrollRef={ref} title="Plants" gap={space[4]} onRefresh={refresh} actions={[{ icon: 'plus', label: 'Add a plant', onPress: add }]}
    list={{
      data: cells, numColumns: 2, columnGap: space[3],
      keyExtractor: (i: PlantCell) => i.k === 'plant' ? i.plant.id : 'add',
      renderItem: (i: PlantCell, n: number) => i.k === 'plant'
        ? <Tile plant={i.plant} width={col} onPress={openPlant} needs={garden.twins[i.plant.id]?.guidance.action !== 'wait'} animate={n < 8 ? n * 55 : null}
            where={plus && known(i.plant.room) ? i.plant.room : known(i.plant.environment?.location) ? i.plant.environment!.location : null} />
        : <Tap label={full ? 'Plant limit reached. See Rootera+' : 'Add a plant'} onPress={add} ring={radius.card} style={{ width: col, paddingTop: col * .36, marginBottom: space[4] }}>
            <View style={{ height: col * .9, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3, alignItems: 'center', justifyContent: 'center', gap: space[1], padding: space[3] }}>
              <Glyph name={full ? 'lock' : 'plus'} size={24} tone={c.ink2} />
              <T v="subhead" center style={{ fontFamily: fonts.medium }}>{full ? 'Shelf full' : 'Add a plant'}</T>
              {garden.plan_capacity !== null && <T v="footnote" tone="ink2" center>{garden.plants.length} of {garden.plan_capacity} on the free plan</T>}
            </View>
          </Tap>,
      footer: !!t && !list.length ? <T v="callout" tone="ink2">No plant matches “{q}”.</T> : undefined,
    }}>
    <Offline />
    {!garden.plants.length && <EmptyShelf onAdd={() => navigation.navigate('AddPlant', { first: true })} />}
    {garden.plants.length > 6 && <SearchField value={q} onChange={setQ} label="Search your plants" />}
    {plus
      ? rooms.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <Chip label="All" count={garden.plants.length} selected={room === 'All'} onPress={() => setRoom('All')} />
          {rooms.map(([r, n]) => <Chip key={r} label={r} count={n} selected={room === r} onPress={() => setRoom(r)} />)}
        </View>
      : garden.plants.length > 0 && <Tap label="Group plants by room with Rootera+" onPress={() => navigation.navigate('Plans', { reason: 'rooms' })} ring={radius.input}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 40, paddingHorizontal: 12, borderRadius: radius.input, borderWidth: 1, borderColor: c.hairline }}>
          <Glyph name="rooms" size={16} tone={c.ink2} /><T v="subhead" tone="ink2">Group by room</T><Glyph name="lock" size={14} tone={c.ink3} />
        </Tap>}
  </Page>;
}

const eventGlyph = (e: CareEvent): GlyphName => e.type === 'Watered' ? 'water' : e.type === 'Soil check' ? 'soil' : 'leaf';

const EventRow = memo(function EventRow({ event, plant, onPress, onLongPress }: { event: CareEvent; plant?: Plant; onPress?: () => void; onLongPress?: () => void }) {
  const { c } = useTheme();
  const water = event.type === 'Watered';
  const body = <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
    <View style={{ width: 32, height: 32, borderRadius: radius.control, backgroundColor: water ? c.waterSoft : c.sunken, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph name={eventGlyph(event)} size={17} tone={water ? c.water : c.ink2} />
    </View>
    <View style={{ flex: 1, gap: 1 }}>
      <T v="body">{describeEvent(event)}</T>
      <T v="footnote" tone="ink2">{plant?.name ?? 'Removed plant'}</T>
      {!!event.note && <T v="subhead" style={{ marginTop: 2 }}>“{event.note}”</T>}
    </View>
    <T v="footnote" tone="ink2">{new Date(event.at).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' })}</T>
  </View>;
  return onPress && plant ? <Tap label={`${describeEvent(event)}, ${plant.name}`} onPress={onPress} onLongPress={onLongPress} longPressLabel="Delete this record" scaleTo={.99} ring={radius.inner}>{body}</Tap> : body;
});

function dayLabel(iso: string) {
  const d = new Date(iso), t = new Date();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

type JournalItem = { k: 'day'; label: string } | { k: 'event'; event: CareEvent };
const CHIP_LIMIT = 8;

function Journal({ navigation }: TabProps<'Journal'>) {
  const { garden, refresh } = useStore();
  const { c } = useTheme();
  const ref = useRef(null); useScrollToTop(ref);
  const index = usePlantIndex(garden);
  const [plant, setPlant] = useState('all');
  const [picker, setPicker] = useState(false);
  // Records older than the snapshot window, paged in as the list nears its end.
  const [older, setOlder] = useState<CareEvent[]>([]);
  const [more, setMore] = useState(garden.events_complete === false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setOlder([]); setMore(garden.events_complete === false); }, [plant, garden.events_complete]);

  const base = useMemo(() => garden.events.filter(e => plant === 'all' || e.plantId === plant).slice().reverse(), [garden.events, plant]);
  const events = useMemo(() => { const seen = new Set(base.map(e => e.id)); return [...base, ...older.filter(e => !seen.has(e.id))]; }, [base, older]);
  const loadMore = async () => {
    if (!more || loading) return;
    setLoading(true);
    try {
      const oldest = events[events.length - 1]?.at;
      const page = await api.journal({ before: oldest, limit: 100, plant: plant === 'all' ? undefined : plant });
      setOlder(o => [...o, ...page.events]); setMore(page.more);
    } catch { setMore(false); } finally { setLoading(false); }
  };
  const items = useMemo(() => {
    const out: JournalItem[] = []; let last = '';
    for (const e of events) { const d = dayLabel(e.at); if (d !== last) { out.push({ k: 'day', label: d }); last = d; } out.push({ k: 'event', event: e }); }
    return out;
  }, [events]);
  const selectedName = plant === 'all' ? 'All plants' : index.get(plant)?.name ?? 'All plants';
  // Editing the timeline: a record can be deleted (and restored with Undo, same id and time).
  const { removeCare, logCare } = useStore();
  const [menuFor, setMenuFor] = useState<CareEvent | null>(null);
  const [deleted, setDeleted] = useState<CareEvent | null>(null);
  const [editError, setEditError] = useState('');
  const removeRecord = async (e: CareEvent) => {
    setEditError('');
    try { await removeCare(e.plantId, e.id); setOlder(o => o.filter(x => x.id !== e.id)); setDeleted(e); }
    catch (err) { setEditError(err instanceof Error ? err.message : 'Could not delete.'); }
  };

  return <Page tab scrollRef={ref} title="Journal" gap={space[4]} onRefresh={refresh}
    list={{
      data: items, onEndReached: () => void loadMore(),
      keyExtractor: (i: JournalItem) => i.k === 'day' ? `d-${i.label}` : i.event.id,
      renderItem: (i: JournalItem) => i.k === 'day'
        ? <T v="section" style={{ paddingTop: space[5], paddingBottom: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>{i.label}</T>
        : <EventRow event={i.event} plant={index.get(i.event.plantId)} onPress={() => navigation.navigate('Plant', { id: i.event.plantId })} onLongPress={() => setMenuFor(i.event)} />,
      footer: loading ? <T v="subhead" tone="ink2">Loading older records…</T>
        : !items.length ? <View style={{ gap: space[2] }}><T v="title2">Nothing recorded yet</T><T v="callout" tone="ink2">Soil checks, watering and notes about the leaves appear here, newest first.</T></View>
        : undefined,
    }}>
    <SourceLabel kind="observed" text="Everything here was recorded by you" />
    <Offline />
    {!!deleted && <Toast title="Record deleted" text={`${describeEvent(deleted)}, ${index.get(deleted.plantId)?.name ?? ''}`} onClose={() => setDeleted(null)}
      action={{ title: 'Undo', onPress: () => { const e = deleted; setDeleted(null); void logCare(e).catch(() => undefined); } }} />}
    {!!editError && <Toast tone="error" title="Not deleted" text={editError} onClose={() => setEditError('')} />}
    <ActionSheet visible={!!menuFor} title={menuFor ? describeEvent(menuFor) : undefined} onClose={() => setMenuFor(null)} actions={menuFor ? [
      { label: 'Delete this record', icon: 'trash', destructive: true, onPress: () => void removeRecord(menuFor) },
    ] : []} />
    {garden.plants.length > 1 && (garden.plants.length <= CHIP_LIMIT
      ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, flexGrow: 0 }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space.gutter }}>
          {[{ id: 'all', name: 'All plants' }, ...garden.plants].map(p => <Chip key={p.id} label={p.name} selected={plant === p.id} onPress={() => setPlant(p.id)} />)}
        </ScrollView>
      // Too many plants for chips: one control that opens a searchable list.
      : <Tap label={`Showing ${selectedName}. Choose a plant`} onPress={() => setPicker(true)} ring={radius.input}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44, paddingHorizontal: 12, borderRadius: radius.input, borderWidth: 1, borderColor: plant === 'all' ? c.hairline : c.ink }}>
          <Glyph name="search" size={16} tone={c.ink2} /><T v="subhead" lines={1}>{selectedName}</T><Glyph name="forward" size={13} tone={c.ink3} />
        </Tap>)}
    <PickerSheet visible={picker} title="Plants" selected={plant} onSelect={setPlant} onClose={() => setPicker(false)}
      items={[{ id: 'all', label: 'All plants' }, ...garden.plants.map(p => ({ id: p.id, label: p.name, detail: known(p.room) ? p.room : p.species }))]} />
  </Page>;
}

const nudgeNames: Record<string, string> = { soil_check: 'soil checks', pattern: 'patterns', leaves: 'leaf reminders', weekly: 'a weekly recap' };

function You({ navigation }: TabProps<'You'>) {
  const { garden } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const detail = garden.caregiver?.detail ?? 'Guided';
  const nudges = garden.nudges;
  const nudgeText = !garden.reminders || !nudges?.kinds.length ? 'Off' : `${nudges.kinds.map(k => nudgeNames[k]).join(', ').replace(/^./, s => s.toUpperCase())}, at ${nudges.time}`;

  return <Page tab scrollRef={ref} title={garden.name || 'You'}>
    <Offline />
    <Group header="Plant care">
      <Row title="Name and experience" detail={garden.caregiver ? experienceLabel[garden.caregiver.experience] : 'Not set'} onPress={() => navigation.navigate('Experience')} />
      {/* How much Rootera explains lives with the nudges (one control, one place); here it is summarised. */}
      <Row title="Nudges" detail={`${nudgeText}. ${detail === 'Guided' ? 'Walk me through it' : 'Just tell me'}`} onPress={() => navigation.navigate('Nudges')} />
    </Group>
    <Group header="Plan">
      <Row title={garden.plan === 'Plus' ? 'Rootera+' : 'Rootera Free'} detail={garden.plan === 'Plus' ? `Unlimited plants and rooms${garden.plan_source === 'demo' ? ', preview activation' : ''}` : `${garden.plants.length} of ${garden.plan_capacity} plants used`} onPress={() => navigation.navigate('Plans')} />
    </Group>
    <Group header="About" footer="In this preview your garden is kept on the Rootera preview server. Photos stay on this device.">
      <Row title="How Rootera learns" onPress={() => navigation.navigate('About')} />
      <Row title="Preview onboarding" detail="Plays it again. Nothing is saved." onPress={() => navigation.navigate('Welcome', { preview: true })} />
    </Group>
  </Page>;
}
