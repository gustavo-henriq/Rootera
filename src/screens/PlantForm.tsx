import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CommonActions } from '@react-navigation/native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { known, newId, Plant, PlantKind } from '../model';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, Chip, Field, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { Page } from '../ds/Page';
import { PlantArt } from '../ds/plant';
import { SeedDrop } from '../ds/SeedDrop';

const LOCATIONS = ['Indoors', 'Balcony / patio', 'Outdoors', 'Not sure'] as const;
const LIGHT = ['Low light', 'Indirect light', 'Bright indirect light', 'Direct sun', 'Not sure'] as const;
const YES_NO = ['Yes', 'No', 'Not sure'] as const;
const POT = ['Small pot', 'Medium pot', 'Large pot', 'Not sure'] as const;
const MATERIAL = ['Terracotta', 'Plastic', 'Ceramic', 'Other', 'Not sure'] as const;
const SUBSTRATE = ['Regular potting mix', 'Very draining / chunky', 'Dense / holds water', "I don't know"] as const;
const lightLabels: Record<string, string> = { 'Low light': 'Low', 'Indirect light': 'Indirect', 'Bright indirect light': 'Bright, indirect', 'Direct sun': 'Direct sun', 'Not sure': 'Not sure' };

const pick = <V extends string>(values: readonly V[], v: string | undefined, fallback: V): V => (values as readonly string[]).includes(v ?? '') ? v as V : fallback;

function Choices<V extends string>({ label, values, value, onChange, labels }: { label: string; values: readonly V[]; value: V; onChange: (v: V) => void; labels?: Record<string, string> }) {
  return <View style={{ gap: space[3] }}>
    <T v="headline">{label}</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{values.map(v => <Chip key={v} label={labels?.[v] ?? v} selected={v === value} onPress={() => onChange(v)} />)}</View>
  </View>;
}

export function PlantForm({ navigation, route }: Props<'PlantForm'>) {
  const { garden, addPlant, updatePlant } = useStore();
  const { c } = useTheme();
  const editing = 'editId' in route.params ? garden.plants.find(p => p.id === (route.params as { editId: string }).editId) : undefined;
  const base = 'editId' in route.params ? null : route.params;
  const kind: PlantKind = editing?.kind ?? base?.kind ?? 'other';
  const plus = garden.plan === 'Plus';
  const rooms = useMemo(() => Array.from(new Set(garden.plants.map(p => p.room).filter(known))), [garden.plants]);

  const [name, setName] = useState(editing?.name ?? base?.name ?? '');
  const [location, setLocation] = useState(pick(LOCATIONS, editing?.environment?.location, 'Indoors'));
  const [light, setLight] = useState(pick(LIGHT, editing?.light, 'Not sure'));
  const [room, setRoom] = useState(known(editing?.room) ? editing!.room : '');
  const [newRoom, setNewRoom] = useState('');
  const [more, setMore] = useState(false);
  const [nearWindow, setNearWindow] = useState(pick(YES_NO, editing?.environment?.near_window, 'Not sure'));
  const [drainage, setDrainage] = useState(pick(YES_NO, editing?.drainage, 'Not sure'));
  const [pot, setPot] = useState(pick(POT, editing?.pot, 'Not sure'));
  const [material, setMaterial] = useState(pick(MATERIAL, editing?.material, 'Not sure'));
  const [selfWatering, setSelfWatering] = useState(pick(YES_NO, editing?.self_watering, 'Not sure'));
  const [substrate, setSubstrate] = useState(pick(SUBSTRATE, editing?.substrate, "I don't know"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [planted, setPlanted] = useState<string | null>(null);
  const id = useRef(editing?.id ?? newId('plant'));

  if ('editId' in route.params && !editing) return <Page back={navigation.goBack}><T v="title">This plant is no longer in your garden.</T></Page>;

  if (planted) {
    return <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center', gap: space[6], padding: space.gutter }}>
      <SeedDrop size={230} run={1} kind={kind} onDone={() => setTimeout(() => navigation.dispatch(state => {
        const start = state.routes.findIndex(r => r.name === 'AddPlant' || r.name === 'Camera');
        const routes: any[] = [...state.routes.slice(0, start < 0 ? 1 : start), { name: 'Plant', params: { id: planted } }];
        return CommonActions.reset({ ...state, routes, index: routes.length - 1 });
      }), 900)} />
      <Animated.View entering={FadeIn.delay(900)}><T v="hero" center>{name.trim() || base?.name} is in your garden.</T></Animated.View>
    </View>;
  }

  const finalRoom = plus ? (newRoom.trim() || room || 'Not sure') : (editing?.room ?? 'Not sure');
  const context = { room: finalRoom, light, pot, drainage, material, self_watering: selfWatering, substrate, environment: { location, near_window: nearWindow } };

  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (editing) {
        await updatePlant(editing.id, { name: name.trim() || editing.name, ...context });
        navigation.navigate('Plant', { id: editing.id, saved: { title: 'Details updated' } });
        return;
      }
      const plant: Plant = { id: id.current, kind, species: base!.species, name: name.trim() || base!.name, photo: base!.photo ?? null, ...context };
      await addPlant(plant);
      setPlanted(plant.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /limit/i.test(e.message)) { navigation.navigate('Plans', { reason: 'limit' }); return; }
      setError(e instanceof Error ? e.message : 'Could not save this plant.');
    } finally { setBusy(false); }
  };

  return <Page back={() => !busy && navigation.goBack()} titleInBar={editing ? 'Edit details' : 'New plant'} gap={space[6]}
    footer={<>
      {!!error && <Toast tone="error" title="Not saved" text={error} onClose={() => setError('')} />}
      <Btn title={editing ? 'Save changes' : 'Plant it'} busy={busy} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
      <View style={{ width: 104, height: 112, borderRadius: radius.card, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <PlantArt kind={kind} photo={editing?.photo ?? base?.photo} size={100} />
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: space[1] }}>
        <T v="footnote" tone="ink2">{editing ? 'Edit details' : 'New plant'}</T>
        <T v="latin" tone="ink2">{editing?.species ?? base?.species}</T>
        {kind === 'other' && <T v="footnote" tone="ink2">No species notes yet. Your checks will guide it.</T>}
      </View>
    </View>

    <Field label="Name" value={name} onChangeText={setName} placeholder={base?.name ?? 'Name'} maxLength={60} />
    <Choices label="Where does it live?" values={LOCATIONS} value={location} onChange={setLocation} />
    <Choices label="How much light does it get?" values={LIGHT} value={light} onChange={setLight} labels={lightLabels} />

    {plus ? <View style={{ gap: space[3] }}>
      <T v="headline">Room</T>
      {!!rooms.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{['', ...rooms].map(r => <Chip key={r || 'none'} label={r || 'No room'} selected={!newRoom && room === r} onPress={() => { setRoom(r); setNewRoom(''); }} />)}</View>}
      <Field label="New room" value={newRoom} onChangeText={setNewRoom} placeholder="Living room, kitchen…" maxLength={40} />
    </View> : <Tap label="Group plants by room with Rootera+" onPress={() => navigation.navigate('Plans', { reason: 'rooms' })} ring={radius.inner}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
      <Glyph name="rooms" size={20} tone={c.ink2} />
      <View style={{ flex: 1 }}><T v="body">Group by room</T><T v="footnote" tone="ink2">Living room, kitchen, balcony. Available with Rootera+.</T></View>
      <Glyph name="lock" size={16} tone={c.ink3} />
    </Tap>}

    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
      <Tap label={more ? 'Hide pot and soil details' : 'Add pot and soil details, optional'} onPress={() => setMore(!more)} scaleTo={.99} ring={radius.inner}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60 }}>
        <View><T v="headline">Pot and soil</T><T v="footnote" tone="ink2">Optional. Helps explain how fast it dries.</T></View>
        <View style={{ transform: [{ rotate: more ? '-90deg' : '90deg' }] }}><Glyph name="forward" size={18} tone={c.ink2} /></View>
      </Tap>
    </View>
    {more && <Animated.View entering={FadeIn.duration(220)} style={{ gap: space[6] }}>
      <Choices label="Drainage hole?" values={YES_NO} value={drainage} onChange={setDrainage} />
      <Choices label="Self-watering pot?" values={YES_NO} value={selfWatering} onChange={setSelfWatering} />
      <Choices label="Pot size" values={POT} value={pot} onChange={setPot} />
      <Choices label="Pot material" values={MATERIAL} value={material} onChange={setMaterial} />
      <Choices label="Soil mix" values={SUBSTRATE} value={substrate} onChange={setSubstrate} />
      <Choices label="Near a window?" values={YES_NO} value={nearWindow} onChange={setNearWindow} />
    </Animated.View>}
  </Page>;
}
