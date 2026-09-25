import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { known, newId, Plant, PlantKind } from '../model';
import { color, space } from '../theme';
import { Banner, Button, Chips, Field, Icon, PlantArt, Press, Screen, Txt } from '../ui';
import { Reveal } from '../motion';

const LOCATIONS = ['Indoors', 'Balcony / patio', 'Outdoors', 'Not sure'] as const;
const LIGHT = ['Low light', 'Indirect light', 'Bright indirect light', 'Direct sun', 'Not sure'] as const;
const WINDOW = ['Yes', 'No', 'Not sure'] as const;
const DRAINAGE = ['Yes', 'No', 'Not sure'] as const;
const POT = ['Small pot', 'Medium pot', 'Large pot', 'Not sure'] as const;
const MATERIAL = ['Terracotta', 'Plastic', 'Ceramic', 'Other', 'Not sure'] as const;
const SUBSTRATE = ['Regular potting mix', 'Very draining / chunky', 'Dense / holds water', "I don't know"] as const;
const lightLabels = { 'Low light': 'Low', 'Indirect light': 'Indirect', 'Bright indirect light': 'Bright indirect', 'Direct sun': 'Direct sun', 'Not sure': 'Not sure' };

const pick = <T extends string>(values: readonly T[], v: string | undefined, fallback: T): T => (values as readonly string[]).includes(v ?? '') ? v as T : fallback;

export function PlantForm({ navigation, route }: Props<'PlantForm'>) {
  const { garden, addPlant, updatePlant } = useStore();
  const editing = 'editId' in route.params ? garden.plants.find(p => p.id === (route.params as { editId: string }).editId) : undefined;
  const base = 'editId' in route.params ? null : route.params;
  const kind: PlantKind = editing?.kind ?? base!.kind;
  const plus = garden.plan === 'Plus';
  const rooms = useMemo(() => Array.from(new Set(garden.plants.map(p => p.room).filter(known))), [garden.plants]);

  const [name, setName] = useState(editing?.name ?? base?.name ?? '');
  const [location, setLocation] = useState(pick(LOCATIONS, editing?.environment?.location, 'Indoors'));
  const [light, setLight] = useState(pick(LIGHT, editing?.light, 'Not sure'));
  const [room, setRoom] = useState(known(editing?.room) ? editing!.room : '');
  const [newRoom, setNewRoom] = useState('');
  const [more, setMore] = useState(false);
  const [nearWindow, setNearWindow] = useState(pick(WINDOW, editing?.environment?.near_window, 'Not sure'));
  const [drainage, setDrainage] = useState(pick(DRAINAGE, editing?.drainage, 'Not sure'));
  const [pot, setPot] = useState(pick(POT, editing?.pot, 'Not sure'));
  const [material, setMaterial] = useState(pick(MATERIAL, editing?.material, 'Not sure'));
  const [selfWatering, setSelfWatering] = useState(pick(DRAINAGE, editing?.self_watering, 'Not sure'));
  const [substrate, setSubstrate] = useState(pick(SUBSTRATE, editing?.substrate, "I don't know"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useRef(editing?.id ?? newId('plant'));

  if ('editId' in route.params && !editing) {
    return <Screen back={navigation.goBack}><Txt v="title">This plant is no longer in your garden.</Txt></Screen>;
  }

  const finalRoom = plus ? (newRoom.trim() || room || 'Not sure') : (editing?.room ?? 'Not sure');
  const context = {
    room: finalRoom, light, pot, drainage, material, self_watering: selfWatering, substrate,
    environment: { location, near_window: nearWindow },
  };

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
      navigation.dispatch(state => {
        const start = state.routes.findIndex(r => r.name === 'AddPlant' || r.name === 'Camera');
        const keep = state.routes.slice(0, start < 0 ? 1 : start);
        const routes: any[] = [...keep, { name: 'Plant', params: { id: plant.id } }];
        if (base!.first && garden.plan === 'Free') routes.push({ name: 'Plans', params: { reason: 'first' } });
        return CommonActions.reset({ ...state, routes, index: routes.length - 1 });
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /limit/i.test(e.message)) { navigation.navigate('Plans', { reason: 'limit' }); return; }
      setError(e instanceof Error ? e.message : 'Could not save this plant.');
    } finally { setBusy(false); }
  };

  return <Screen back={() => !busy && navigation.goBack()} title={editing ? 'Edit details' : 'New plant'}
    footer={<>
      {!!error && <Banner tone="error" title="Not saved" text={error} />}
      <Button title={editing ? 'Save changes' : 'Add to my garden'} busy={busy} onPress={() => void save()} />
    </>}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.lg }}>
      <PlantArt kind={kind} photo={editing?.photo ?? base?.photo} size={112} />
      <View style={{ flex: 1, gap: 2, paddingBottom: 8 }}>
        <Txt v="latin">{editing?.species ?? base!.species}</Txt>
        {kind === 'other' && <Txt v="small">No species notes yet. Your checks will guide it.</Txt>}
      </View>
    </View>

    <Field label="Name" value={name} onChangeText={setName} placeholder={base?.name ?? 'Name'} maxLength={60} />

    <View style={{ gap: space.md }}>
      <Txt v="bodyStrong">Where does it live?</Txt>
      <Chips values={LOCATIONS} value={location} onChange={setLocation} />
    </View>
    <View style={{ gap: space.md }}>
      <Txt v="bodyStrong">How much light does it get?</Txt>
      <Chips values={LIGHT} value={light} onChange={setLight} labels={lightLabels} />
    </View>

    {plus ? <View style={{ gap: space.md }}>
      <Txt v="bodyStrong">Room</Txt>
      {!!rooms.length && <Chips values={['', ...rooms] as string[]} value={newRoom ? '' : room} onChange={v => { setRoom(v); setNewRoom(''); }} labels={{ '': 'No room' }} />}
      <Field label="New room" value={newRoom} onChangeText={setNewRoom} placeholder="Living room, kitchen…" maxLength={40} />
    </View> : <Press label="Group plants by room with Rootera+" onPress={() => navigation.navigate('Plans', { reason: 'rooms' })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 }}>
      <Icon name="albums-outline" size={20} tone={color.inkSoft} />
      <View style={{ flex: 1 }}><Txt v="body">Group by room</Txt><Txt v="small">Living room, kitchen, balcony… with Rootera+</Txt></View>
      <Icon name="lock-closed-outline" size={16} tone={color.inkMuted} />
    </Press>}

    <Press label={more ? 'Hide pot and soil details' : 'Add pot and soil details, optional'} onPress={() => setMore(!more)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderTopWidth: 1, borderColor: color.line }}>
      <View><Txt v="bodyStrong">Pot and soil</Txt><Txt v="small">Optional · helps explain how fast it dries</Txt></View>
      <Icon name={more ? 'chevron-up' : 'chevron-down'} size={18} tone={color.inkSoft} />
    </Press>
    {more && <Reveal style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Drainage hole?</Txt><Chips values={DRAINAGE} value={drainage} onChange={setDrainage} /></View>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Self-watering pot?</Txt><Chips values={DRAINAGE} value={selfWatering} onChange={setSelfWatering} /></View>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Pot size</Txt><Chips values={POT} value={pot} onChange={setPot} /></View>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Pot material</Txt><Chips values={MATERIAL} value={material} onChange={setMaterial} /></View>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Soil mix</Txt><Chips values={SUBSTRATE} value={substrate} onChange={setSubstrate} /></View>
      <View style={{ gap: space.md }}><Txt v="bodyStrong">Near a window?</Txt><Chips values={WINDOW} value={nearWindow} onChange={setNearWindow} /></View>
    </Reveal>}
  </Screen>;
}
