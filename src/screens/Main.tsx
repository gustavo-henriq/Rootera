import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BottomTabScreenProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useScrollToTop } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props, Routes, Tabs } from '../navigation';
import { useStore } from '../store';
import { API_URL } from '../api';
import { atCapacity, byUrgency, CareEvent, describeEvent, experienceLabel, known, LOCALE, Plant } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, Chip, FloatingTabBar, Group, Row, Segmented, SourceLabel, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, PlantArt, plantArt } from '../ds/plant';
import { Pop, Stagger } from '../ds/motion';
import { NameInvite } from './NameInvite';

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

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Thumb({ plant, size = 64 }: { plant: Plant; size?: number }) {
  const { c } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: radius.control, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
    <PlantArt kind={plant.kind} photo={plant.photo} size={size * .95} />
  </View>;
}

function Today({ navigation }: TabProps<'Today'>) {
  const { garden } = useStore();
  const { c } = useTheme();
  // On narrow phones the quick action becomes an icon so the plant name keeps its room.
  const narrow = useWindowDimensions().width < 370;
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const sorted = byUrgency(garden);
  const needs = sorted.filter(p => garden.twins[p.id]?.guidance.action !== 'wait');
  const resting = sorted.filter(p => garden.twins[p.id]?.guidance.action === 'wait');
  const recent = garden.events.slice(-3).reverse();
  const first = garden.name.split(' ')[0];
  const open = (p: Plant) => navigation.navigate('Plant', { id: p.id });

  return <Page tab scrollRef={ref} titleInBar="Today" actions={[{ icon: 'plus', label: 'Add a plant', onPress: () => navigation.navigate('AddPlant') }]}
    header={<View style={{ gap: space[1] }}>
      <T v="footnote" tone="ink2">{new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })}</T>
      <T v="display">{greeting()}{first ? `,\n${first}` : ''}</T>
    </View>}>
    <Offline />
    <NameInvite />
    {!garden.plants.length ? <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[6] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{(['snake-plant', 'monstera', 'pilea'] as const).map((k, i) => <Image key={k} source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 130 : 96, height: i === 1 ? 130 : 96, marginHorizontal: -10 }} />)}</View>
      <Ground width={240} style={{ marginTop: -18 }} />
      <T v="title2" center>Your shelf is empty</T>
      <T v="callout" tone="ink2" center>Add a plant and do a first soil check. Rootera starts learning from there.</T>
      <Btn title="Add a plant" icon="plus" onPress={() => navigation.navigate('AddPlant', { first: true })} style={{ alignSelf: 'stretch' }} />
    </View> : <>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginBottom: space[2] }}>
          <T v="section">Needs you</T>
          {!!needs.length && <T v="footnote" tone="ink2">{needs.length} {needs.length === 1 ? 'plant' : 'plants'}</T>}
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
          {needs.length ? needs.map((p, i) => {
            const g = garden.twins[p.id]?.guidance;
            const q = g ? quick[g.action] : quick.check_soil;
            return <Stagger key={p.id} index={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
              <Tap label={`${p.name}: ${g?.title}`} onPress={() => open(p)} scaleTo={.99} ring={radius.control} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Thumb plant={p} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="headline" lines={1}>{p.name}</T>
                  <T v="subhead" tone="ink2" lines={2}>{g?.title ?? 'Start with a soil check'}</T>
                </View>
              </Tap>
              {q && (narrow
                ? <Tap label={`${q.title}, ${p.name}`} onPress={() => navigation.navigate('Care', { id: p.id, mode: q.mode })} ring={radius.control} style={{ width: 44, height: 44, borderRadius: radius.control, borderWidth: 1, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><Glyph name={q.icon} size={20} /></Tap>
                : <Btn size="regular" kind="outline" icon={q.icon} title={q.title} onPress={() => navigation.navigate('Care', { id: p.id, mode: q.mode })} />)}
            </Stagger>;
          }) : <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center', paddingVertical: space[4], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
            <Glyph name="leaf" tone={c.leafMark} />
            <T v="callout" style={{ flex: 1 }}>Nothing needs you right now. A plant shows up here when a check would help.</T>
          </View>}
        </View>
      </View>

      {!!resting.length && <Group header="Resting">
        {resting.map(p => <Tap key={p.id} label={`${p.name}: ${garden.twins[p.id]?.guidance.title}`} onPress={() => open(p)} scaleTo={.99} ring={radius.inner}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <Thumb plant={p} size={48} />
          <View style={{ flex: 1 }}><T v="body" lines={1}>{p.name}</T><T v="footnote" tone="ink2" lines={1}>{garden.twins[p.id]?.guidance.title}</T></View>
          <Glyph name="forward" size={15} tone={c.ink3} />
        </Tap>)}
      </Group>}

      {!!recent.length && <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[2] }}>
          <T v="section">Recently</T>
          <Tap label="Open the journal" onPress={() => navigation.navigate('Journal')} ring={radius.inner} style={{ minHeight: 44, justifyContent: 'center' }}><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>Journal</T></Tap>
        </View>
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
          {recent.map(e => <EventRow key={e.id} event={e} plant={garden.plants.find(p => p.id === e.plantId)} onPress={() => navigation.navigate('Plant', { id: e.plantId })} />)}
        </View>
      </View>}
    </>}
  </Page>;
}

/** A plant rising out of its tile, like a pot on the edge of a shelf. */
function Tile({ plant, width, onPress, needs, delay }: { plant: Plant; width: number; onPress: () => void; needs: boolean; delay: number }) {
  const { garden } = useStore();
  const { c } = useTheme();
  const where = garden.plan === 'Plus' && known(plant.room) ? plant.room : known(plant.environment?.location) ? plant.environment!.location : null;
  return <Tap label={`${plant.name}, ${needs ? 'needs you' : 'resting'}`} onPress={onPress} ring={radius.card} style={{ width, paddingTop: width * .36 }}>
    <View style={{ height: width * .9, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: c.sunken, justifyContent: 'flex-end', padding: space[3], gap: 2 }}>
      <T v="headline" lines={1}>{plant.name}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: needs ? c.clay : c.leafMark }} />
        <T v="footnote" tone={needs ? 'clayText' : 'ink2'} lines={1}>{needs ? 'Needs you' : 'Resting'}</T>
      </View>
      {!!where && <T v="footnote" tone="ink2" lines={1}>{where}</T>}
    </View>
    <Pop delay={delay + 160} style={{ position: 'absolute', top: 0, left: width * .1, right: width * .1, alignItems: 'center' }}>
      <PlantArt kind={plant.kind} photo={plant.photo} size={width * .8} />
    </Pop>
  </Tap>;
}

function Plants({ navigation }: TabProps<'Plants'>) {
  const { garden } = useStore();
  const { c } = useTheme();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [w, setW] = useState(0);
  const [room, setRoom] = useState('All');
  const plus = garden.plan === 'Plus';
  const rooms = useMemo(() => Array.from(new Set(garden.plants.map(p => p.room).filter(known))), [garden.plants]);
  const list = byUrgency(garden).filter(p => !plus || room === 'All' || p.room === room);
  const col = w ? (w - space[3]) / 2 : 0;
  const full = atCapacity(garden);

  return <Page tab scrollRef={ref} title="Plants" actions={[{ icon: 'plus', label: 'Add a plant', onPress: () => navigation.navigate(full ? 'Plans' : 'AddPlant', full ? { reason: 'limit' } : undefined as any) }]} gap={space[5]}>
    <Offline />
    {plus
      ? rooms.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{['All', ...rooms].map(r => <Chip key={r} label={r} selected={room === r} onPress={() => setRoom(r)} />)}</View>
      : garden.plants.length > 0 && <Tap label="Group plants by room with Rootera+" onPress={() => navigation.navigate('Plans', { reason: 'rooms' })} ring={radius.input}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 40, paddingHorizontal: 12, borderRadius: radius.input, borderWidth: 1, borderColor: c.hairline }}>
          <Glyph name="rooms" size={16} tone={c.ink2} /><T v="subhead" tone="ink2">Group by room</T><Glyph name="lock" size={14} tone={c.ink3} />
        </Tap>}
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: space[4] }}>
      {!!col && list.map((p, i) => <Stagger key={p.id} index={i}><Tile plant={p} width={col} delay={Math.min(i, 8) * 55} needs={garden.twins[p.id]?.guidance.action !== 'wait'} onPress={() => navigation.navigate('Plant', { id: p.id })} /></Stagger>)}
      {!!col && <Tap label={full ? 'Plant limit reached. See Rootera+' : 'Add a plant'} onPress={() => navigation.navigate(full ? 'Plans' : 'AddPlant', full ? { reason: 'limit' } : undefined as any)} ring={radius.card} style={{ width: col, paddingTop: col * .36 }}>
        <View style={{ height: col * .9, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3, alignItems: 'center', justifyContent: 'center', gap: space[1], padding: space[3] }}>
          <Glyph name={full ? 'lock' : 'plus'} size={24} tone={c.ink2} />
          <T v="subhead" center style={{ fontFamily: fonts.medium }}>{full ? 'Shelf full' : 'Add a plant'}</T>
          {garden.plan_capacity !== null && <T v="footnote" tone="ink2" center>{garden.plants.length} of {garden.plan_capacity} on the free plan</T>}
        </View>
      </Tap>}
    </View>
  </Page>;
}

const eventGlyph = (e: CareEvent): GlyphName => e.type === 'Watered' ? 'water' : e.type === 'Soil check' ? 'soil' : 'leaf';

function EventRow({ event, plant, onPress }: { event: CareEvent; plant?: Plant; onPress?: () => void }) {
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
  return onPress && plant ? <Tap label={`${describeEvent(event)}, ${plant.name}`} onPress={onPress} scaleTo={.99} ring={radius.inner}>{body}</Tap> : body;
}

function dayLabel(iso: string) {
  const d = new Date(iso), t = new Date();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

function Journal({ navigation }: TabProps<'Journal'>) {
  const { garden } = useStore();
  const { c } = useTheme();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [plant, setPlant] = useState('all');
  const events = garden.events.filter(e => plant === 'all' || e.plantId === plant).slice().reverse();
  const groups: [string, CareEvent[]][] = [];
  events.forEach(e => { const k = dayLabel(e.at); const g = groups.find(x => x[0] === k); g ? g[1].push(e) : groups.push([k, [e]]); });

  return <Page tab scrollRef={ref} title="Journal" gap={space[5]}>
    <SourceLabel kind="observed" text="Everything here was recorded by you" />
    <Offline />
    {garden.plants.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, flexGrow: 0 }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space.gutter }}>
      {[{ id: 'all', name: 'All plants' }, ...garden.plants].map(p => <Chip key={p.id} label={p.name} selected={plant === p.id} onPress={() => setPlant(p.id)} />)}
    </ScrollView>}
    {groups.length ? groups.map(([day, list]) => <View key={day}>
      <T v="section" style={{ marginBottom: space[2] }}>{day}</T>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        {list.map((e, i) => <Stagger key={e.id} index={i}><EventRow event={e} plant={garden.plants.find(p => p.id === e.plantId)} onPress={() => navigation.navigate('Plant', { id: e.plantId })} /></Stagger>)}
      </View>
    </View>) : <View style={{ gap: space[2], paddingTop: space[4] }}>
      <T v="title2">Nothing recorded yet</T>
      <T v="callout" tone="ink2">Soil checks, watering and notes about the leaves appear here, newest first.</T>
    </View>}
  </Page>;
}

const nudgeNames: Record<string, string> = { soil_check: 'soil checks', pattern: 'patterns', leaves: 'leaf reminders', weekly: 'a weekly recap' };

function You({ navigation }: TabProps<'You'>) {
  const { garden, saveProfile } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [error, setError] = useState('');
  const detail = garden.caregiver?.detail ?? 'Guided';
  const save = async (changes: Parameters<typeof saveProfile>[0]) => {
    setError('');
    try { await saveProfile(changes); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };
  const nudges = garden.nudges;
  const nudgeText = !garden.reminders || !nudges?.kinds.length ? 'Off' : `${nudges.kinds.map(k => nudgeNames[k]).join(', ').replace(/^./, s => s.toUpperCase())}, at ${nudges.time}`;
  const host = API_URL.replace(/^https?:\/\//, '');

  return <Page tab scrollRef={ref} title={garden.name || 'You'}>
    <Offline />
    {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
    <Group header="Plant care">
      <Row title="Name and experience" detail={garden.caregiver ? experienceLabel[garden.caregiver.experience] : 'Not set'} onPress={() => navigation.navigate('Experience')} />
      <Row title="Nudges" detail={nudgeText} onPress={() => navigation.navigate('Nudges')} />
      <View style={{ paddingVertical: space[3], gap: space[2] }}>
        <T v="body">How much Rootera explains</T>
        <Segmented values={['Guided', 'Concise'] as const} value={detail} onChange={v => void save({ caregiver: { experience: garden.caregiver?.experience ?? 'first', detail: v } })} labels={{ Guided: 'Walk me through it', Concise: 'Just tell me' }} />
      </View>
    </Group>
    <Group header="Plan">
      <Row title={garden.plan === 'Plus' ? 'Rootera+' : 'Rootera Free'} detail={garden.plan === 'Plus' ? `Unlimited plants and rooms${garden.plan_source === 'demo' ? ', preview activation' : ''}` : `${garden.plants.length} of ${garden.plan_capacity} plants used`} onPress={() => navigation.navigate('Plans')} />
    </Group>
    <Group header="About" footer={`Preview data is saved on ${host}. Photos stay on this device.`}>
      <Row title="How Rootera learns" onPress={() => navigation.navigate('About')} />
      <Row title="Preview onboarding" detail="Plays it again. Nothing is saved." onPress={() => navigation.navigate('Welcome', { preview: true })} />
    </Group>
  </Page>;
}
