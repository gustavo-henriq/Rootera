import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { BottomTabScreenProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props, Routes, Tabs } from '../navigation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store';
import { ago, atCapacity, byUrgency, CareEvent, describeEvent, experienceLabel, known, LOCALE, Plant } from '../model';
import { color, font, radius, space } from '../theme';
import { Banner, Button, Chips, Icon, IconButton, IconName, PlantArt, Press, Row, Screen, Section, Segmented, Tag, Txt } from '../ui';
import { API_URL } from '../api';
import { Pop, Stagger } from '../motion';

const Tab = createBottomTabNavigator<Tabs>();
type TabProps<T extends keyof Tabs> = CompositeScreenProps<BottomTabScreenProps<Tabs, T>, NativeStackScreenProps<Routes>>;

const tabIcons: Record<keyof Tabs, [IconName, IconName]> = {
  Today: ['sunny', 'sunny-outline'], Plants: ['leaf', 'leaf-outline'], Journal: ['book', 'book-outline'], You: ['person', 'person-outline'],
};

export function Main({ route }: Props<'Main'>) {
  const insets = useSafeAreaInsets();
  return <Tab.Navigator initialRouteName={route.params?.tab ?? 'Today'} screenOptions={({ route: r }) => ({
    headerShown: false,
    tabBarActiveTintColor: color.olive,
    tabBarInactiveTintColor: color.inkMuted,
    tabBarStyle: { backgroundColor: color.paper, borderTopColor: color.line, height: 66 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) },
    tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11 },
    tabBarIcon: ({ focused, color: c }) => <Icon name={tabIcons[r.name][focused ? 0 : 1]} size={22} tone={c} />,
  })}>
    <Tab.Screen name="Today" component={Today} />
    <Tab.Screen name="Plants" component={Plants} options={{ title: 'Plants' }} />
    <Tab.Screen name="Journal" component={Journal} />
    <Tab.Screen name="You" component={You} />
  </Tab.Navigator>;
}

function Offline() {
  const { offline, refresh } = useStore();
  return offline ? <Banner tone="info" title="Showing your last saved garden" text="Rootera’s server can’t be reached. New records won’t save until it’s back." action={{ title: 'Try again', onPress: () => void refresh() }} /> : null;
}

const quick: Record<string, { title: string; mode: 'soil' | 'water' | 'visual' } | null> = {
  check_soil: { title: 'Check soil', mode: 'soil' }, log_water: { title: 'Log water', mode: 'water' }, observe: { title: 'Look', mode: 'visual' }, wait: null,
};

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Today({ navigation }: TabProps<'Today'>) {
  const { garden } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const sorted = byUrgency(garden);
  const needs = sorted.filter(p => garden.twins[p.id]?.guidance.action !== 'wait');
  const resting = sorted.filter(p => garden.twins[p.id]?.guidance.action === 'wait');
  const recent = garden.events.slice(-3).reverse();
  const first = garden.name.split(' ')[0];
  const open = (p: Plant) => navigation.navigate('Plant', { id: p.id });

  return <Screen tab scrollRef={ref} right={<IconButton name="add" label="Add a plant" onPress={() => navigation.navigate('AddPlant')} />}
    left={<Txt v="label" style={{ paddingLeft: 12 }}>{new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>}>
    <Txt v="hero">{greeting()}{first ? `,\n${first}` : '.'}</Txt>
    <Offline />

    {!garden.plants.length ? <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{(['snake-plant', 'monstera', 'pilea'] as const).map((k, i) => <PlantArt key={k} kind={k} size={i === 1 ? 130 : 96} style={{ marginHorizontal: -10 }} />)}</View>
      <Txt v="title" center>Your shelf is empty</Txt>
      <Txt center tone={color.inkSoft}>Add a plant and do a first soil check. Rootera starts learning from there.</Txt>
      <Button title="Add a plant" icon="add" onPress={() => navigation.navigate('AddPlant', { first: true })} style={{ alignSelf: 'stretch' }} />
    </View> : <>
      <Section label={needs.length ? `Needs you · ${needs.length}` : 'Needs you'}>
        {needs.length ? needs.map((p, i) => {
          const g = garden.twins[p.id]?.guidance;
          const q = g ? quick[g.action] : quick.check_soil;
          return <Stagger key={p.id} index={i} style={[s.need, i === needs.length - 1 && { borderBottomWidth: 0 }]}>
            <Press label={`${p.name}: ${g?.title}`} onPress={() => open(p)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={s.thumb}><PlantArt kind={p.kind} photo={p.photo} size={64} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="bodyStrong" lines={1}>{p.name}</Txt>
                <Txt v="small" lines={2}>{g?.title ?? 'Start with a soil check'}</Txt>
              </View>
            </Press>
            {q && <Button compact variant={q.mode === 'water' ? 'water' : 'secondary'} title={q.title} onPress={() => navigation.navigate('Care', { id: p.id, mode: q.mode })} />}
          </Stagger>;
        }) : <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md }}>
          <Icon name="checkmark-circle" size={22} tone={color.leaf} />
          <Txt v="body" style={{ flex: 1 }}>Nothing needs you right now. Rootera will show a plant here when a check would help.</Txt>
        </View>}
      </Section>

      {!!resting.length && <Section label="Resting">
        {resting.map((p, i) => <Stagger key={p.id} index={needs.length + i}><Press label={`${p.name}: ${garden.twins[p.id]?.guidance.title}`} onPress={() => open(p)} style={[s.need, { paddingVertical: 8 }, i === resting.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[s.thumb, { width: 48, height: 48 }]}><PlantArt kind={p.kind} photo={p.photo} size={46} /></View>
          <View style={{ flex: 1 }}><Txt v="body" lines={1}>{p.name}</Txt><Txt v="small" lines={1}>{garden.twins[p.id]?.guidance.title}</Txt></View>
          <Icon name="chevron-forward" size={16} tone={color.inkMuted} />
        </Press></Stagger>)}
      </Section>}

      {!!recent.length && <Section label="Recently recorded" action={{ title: 'Journal', onPress: () => navigation.navigate('Journal') }}>
        {recent.map((e, i) => <EventRow key={e.id} event={e} plant={garden.plants.find(p => p.id === e.plantId)} last={i === recent.length - 1} onPress={() => navigation.navigate('Plant', { id: e.plantId })} />)}
      </Section>}
    </>}
  </Screen>;
}

/** Plant tile where the plant rises above its frame, like a pot on a shelf edge. */
function Tile({ plant, width, onPress, status, delay = 0 }: { plant: Plant; width: number; onPress: () => void; status: 'needs' | 'rest'; delay?: number }) {
  const { garden } = useStore();
  const meta = [garden.plan === 'Plus' && known(plant.room) ? plant.room : null, known(plant.environment?.location) ? plant.environment!.location : null].filter(Boolean)[0] as string | undefined;
  return <Press label={`${plant.name}, ${status === 'needs' ? 'needs you' : 'resting'}`} onPress={onPress} style={{ width, paddingTop: width * .34 }}>
    <View style={[s.tile, { height: width * .92 }]}>
      <View style={{ padding: 12, gap: 2 }}>
        <Txt v="bodyStrong" lines={1}>{plant.name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status === 'needs' ? color.clay : color.leaf }} />
          <Txt v="label" style={{ fontSize: 10, flex: 1 }} lines={1} tone={status === 'needs' ? color.clay : color.leafInk}>{status === 'needs' ? 'Needs you' : 'Resting'}{meta ? <Txt v="label" style={{ fontSize: 10 }}> · {meta}</Txt> : null}</Txt>
        </View>
      </View>
    </View>
    <Pop delay={delay + 180} style={{ position: 'absolute', top: 0, left: width * .12, right: width * .12, alignItems: 'center' }}>
      <PlantArt kind={plant.kind} photo={plant.photo} size={width * .82} />
    </Pop>
  </Press>;
}

function Plants({ navigation }: TabProps<'Plants'>) {
  const { garden } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [w, setW] = useState(0);
  const [room, setRoom] = useState('All');
  const plus = garden.plan === 'Plus';
  const rooms = useMemo(() => Array.from(new Set(garden.plants.map(p => p.room).filter(known))), [garden.plants]);
  const list = byUrgency(garden).filter(p => !plus || room === 'All' || p.room === room);
  const col = w ? (w - space.md) / 2 : 0;
  const full = atCapacity(garden);

  return <Screen tab scrollRef={ref} right={<IconButton name="add" label="Add a plant" onPress={() => navigation.navigate('AddPlant')} />}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Txt v="hero">My plants</Txt>
      <Txt v="smallStrong" style={{ marginLeft: 4, marginTop: 2 }}>{garden.plants.length}</Txt>
    </View>
    <Offline />
    {plus
      ? rooms.length > 0 && <Chips values={['All', ...rooms]} value={room} onChange={setRoom} />
      : garden.plants.length > 0 && <Press label="Group plants by room with Rootera+" onPress={() => navigation.navigate('Plans', { reason: 'rooms' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: color.lineStrong }}>
          <Icon name="albums-outline" size={15} tone={color.inkSoft} /><Txt v="small">Rooms</Txt><Icon name="lock-closed" size={12} tone={color.inkMuted} />
        </Press>}

    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.lg }}>
      {!!col && list.map((p, i) => <Stagger key={p.id} index={i}><Tile plant={p} width={col} delay={Math.min(i, 8) * 70} status={garden.twins[p.id]?.guidance.action === 'wait' ? 'rest' : 'needs'} onPress={() => navigation.navigate('Plant', { id: p.id })} /></Stagger>)}
      {!!col && <Press label={full ? 'Plant limit reached. See Rootera+' : 'Add a plant'} onPress={() => navigation.navigate(full ? 'Plans' : 'AddPlant', full ? { reason: 'limit' } : undefined as any)} style={{ width: col, paddingTop: col * .34 }}>
        <View style={[s.tile, s.addTile, { height: col * .92 }]}>
          <Icon name={full ? 'lock-closed-outline' : 'add'} size={26} tone={color.olive} />
          <Txt v="smallStrong" center>{full ? 'Shelf full' : 'Add a plant'}</Txt>
          {garden.plan_capacity !== null && <Txt v="label" style={{ fontSize: 10 }}>{garden.plants.length} of {garden.plan_capacity} · Free</Txt>}
        </View>
      </Press>}
    </View>
  </Screen>;
}

function EventRow({ event, plant, last, onPress }: { event: CareEvent; plant?: Plant; last?: boolean; onPress?: () => void }) {
  const icon: IconName = event.type === 'Watered' ? 'water' : event.type === 'Soil check' ? 'finger-print' : 'leaf';
  const body = <View style={[s.event, last && { borderBottomWidth: 0 }]}>
    <View style={[s.eventIcon, event.type === 'Watered' && { backgroundColor: color.waterSoft }]}><Icon name={icon} size={15} tone={event.type === 'Watered' ? color.water : color.olive} /></View>
    <View style={{ flex: 1, gap: 1 }}>
      <Txt v="body">{describeEvent(event)}</Txt>
      <Txt v="small">{plant?.name ?? 'Removed plant'} · {new Date(event.at).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}</Txt>
      {!!event.note && <Txt v="small" tone={color.ink}>“{event.note}”</Txt>}
    </View>
  </View>;
  return onPress && plant ? <Press label={`${describeEvent(event)}, ${plant.name}`} onPress={onPress}>{body}</Press> : body;
}

function dayLabel(iso: string) {
  const d = new Date(iso), t = new Date();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' });
}

function Journal({ navigation }: TabProps<'Journal'>) {
  const { garden } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [plant, setPlant] = useState('all');
  const events = garden.events.filter(e => plant === 'all' || e.plantId === plant).slice().reverse();
  const groups: [string, CareEvent[]][] = [];
  events.forEach(e => { const k = dayLabel(e.at); const g = groups.find(x => x[0] === k); g ? g[1].push(e) : groups.push([k, [e]]); });
  const names = Object.fromEntries(garden.plants.map(p => [p.id, p.name]));

  return <Screen tab scrollRef={ref}>
    <View style={{ gap: space.sm }}>
      <Txt v="hero">Journal</Txt>
      <Tag kind="user" text="Everything here was recorded by you" />
    </View>
    <Offline />
    {garden.plants.length > 1 && <Chips values={['all', ...garden.plants.map(p => p.id)]} value={plant} onChange={setPlant} labels={{ all: 'All plants', ...names }} />}
    {groups.length ? groups.map(([day, list]) => <Section key={day} label={day}>
      {list.map((e, i) => <Stagger key={e.id} index={i}><EventRow event={e} plant={garden.plants.find(p => p.id === e.plantId)} last={i === list.length - 1} onPress={() => navigation.navigate('Plant', { id: e.plantId })} /></Stagger>)}
    </Section>) : <View style={{ gap: space.sm, paddingTop: space.xl }}>
      <Txt v="heading">Nothing recorded yet</Txt>
      <Txt tone={color.inkSoft}>Soil checks, watering and notes about the leaves appear here, newest first.</Txt>
    </View>}
  </Screen>;
}

function You({ navigation }: TabProps<'You'>) {
  const { garden, saveProfile } = useStore();
  const ref = useRef<ScrollView>(null); useScrollToTop(ref);
  const [error, setError] = useState('');
  const detail = garden.caregiver?.detail ?? 'Guided';
  const save = async (changes: Parameters<typeof saveProfile>[0]) => {
    setError('');
    try { await saveProfile(changes); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };
  const host = API_URL.replace(/^https?:\/\//, '');

  return <Screen tab scrollRef={ref}>
    <Txt v="hero">{garden.name || 'You'}</Txt>
    <Offline />
    {!!error && <Banner tone="error" title="Not saved" text={error} onClose={() => setError('')} />}

    <Section label="Plant care profile">
      <Row icon="person-outline" title="Name and experience" detail={garden.caregiver ? experienceLabel[garden.caregiver.experience] : 'Not set'} onPress={() => navigation.navigate('Experience')} />
      <View style={{ gap: space.sm, paddingVertical: space.md }}>
        <Txt v="body">How much should Rootera explain?</Txt>
        <Segmented values={['Guided', 'Concise'] as const} value={detail} onChange={v => void save({ caregiver: { experience: garden.caregiver?.experience ?? 'first', detail: v } })} labels={{ Guided: 'Explain the how-to', Concise: 'Just the essentials' }} />
      </View>
    </Section>

    <Section label="Plan">
      <Row icon="sparkles-outline" title={garden.plan === 'Plus' ? 'Rootera+' : 'Rootera Free'}
        detail={garden.plan === 'Plus' ? `Unlimited plants · rooms${garden.plan_source === 'demo' ? ' · preview' : ''}` : `${garden.plants.length} of ${garden.plan_capacity} plants used`}
        onPress={() => navigation.navigate('Plans')} last />
    </Section>

    <Section label="Reminders">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
        <Icon name="notifications-outline" size={20} tone={color.inkSoft} />
        <View style={{ flex: 1 }}>
          <Txt>Care nudges</Txt>
          <Txt v="small">Push delivery isn’t connected yet. Nudges appear on your Today screen.</Txt>
        </View>
        <Switch accessibilityLabel="Care nudges" value={garden.reminders} onValueChange={v => void save({ reminders: v })} trackColor={{ true: color.leaf, false: color.lineStrong }} thumbColor={color.white} />
      </View>
    </Section>

    <Section label="About">
      <Row icon="git-branch-outline" title="How Rootera learns" onPress={() => navigation.navigate('About')} />
      <Row icon="server-outline" title="Preview data" detail={`Saved on ${host}. Photos stay on this device.`} last />
    </Section>
  </Screen>;
}

const s = StyleSheet.create({
  need: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: color.paperDeep, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
  tile: { backgroundColor: color.paperDeep, borderRadius: radius.lg, borderCurve: 'continuous', justifyContent: 'flex-end' },
  addTile: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 4 },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  eventIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.oliveSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
