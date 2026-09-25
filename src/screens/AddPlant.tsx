import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { api, Candidate } from '../api';
import { atCapacity, catalog, PlantKind, Species } from '../model';
import { color, font, radius, space } from '../theme';
import { Button, Icon, PlantArt, Press, Screen, Txt, webNoOutline } from '../ui';
import { photoData } from './Camera';

/** Pantone-style specimen swatch: the plant on paper, a label strip underneath. */
export function Swatch({ kind, title, subtitle, onPress, width, selected }: { kind: PlantKind; title: string; subtitle: string; onPress: () => void; width: number; selected?: boolean }) {
  return <Press label={`${title}, ${subtitle}`} onPress={onPress} style={{ width }}>
    <View style={{ height: width * 1.02, backgroundColor: color.paperDeep, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>
      <PlantArt kind={kind} size={width * .84} />
    </View>
    <View style={{ backgroundColor: color.surface, paddingHorizontal: 10, paddingVertical: 9, borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, borderColor: selected ? color.olive : color.line }}>
      <Txt v="label" tone={color.ink} lines={1} style={{ fontSize: 12 }}>{title}</Txt>
      <Txt v="latin" lines={1} style={{ fontSize: 13 }}>{subtitle}</Txt>
    </View>
  </Press>;
}

export function useGrid() {
  const [w, setW] = useState(0);
  const col = w ? (w - space.md) / 2 : 0;
  return { onLayout: (e: any) => setW(e.nativeEvent.layout.width), col };
}

export function AddPlant({ navigation, route }: Props<'AddPlant'>) {
  const { garden } = useStore();
  const first = !!route.params?.first;
  const photo = route.params?.photo;
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  const [idState, setIdState] = useState<'idle' | 'loading' | 'off' | 'error'>('idle');
  const grid = useGrid();

  useEffect(() => {
    if (!photo) return;
    const data = photoData.get(photo);
    if (!garden.integrations.identification || !data) { setIdState('off'); return; }
    let live = true;
    setIdState('loading');
    api.identify(data).then(r => { if (live) { setMatches(r.results); setIdState('idle'); } }).catch(() => live && setIdState('error'));
    return () => { live = false; };
  }, [photo, garden.integrations.identification]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? catalog.filter(s => `${s.name} ${s.latin} ${s.aliases}`.toLowerCase().includes(t)) : catalog;
  }, [q]);

  const choose = (s: Pick<Species, 'kind' | 'name' | 'latin'>) => navigation.navigate('PlantForm', { kind: s.kind, species: s.latin, name: s.name, photo, first });
  const custom = () => choose({ kind: 'other', name: q.trim() || 'My plant', latin: q.trim() || 'Unknown species' });

  if (atCapacity(garden)) {
    return <Screen back={navigation.goBack} footer={<><Button title="See Rootera+" onPress={() => navigation.replace('Plans', { reason: 'limit' })} /><Button title="Not now" variant="quiet" onPress={navigation.goBack} /></>}>
      <View style={{ alignItems: 'center', paddingTop: space.xxl, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{(['pothos', 'monstera', 'zz'] as const).map((k, i) => <PlantArt key={k} kind={k} size={i === 1 ? 120 : 90} style={{ marginHorizontal: -8 }} />)}</View>
        <Txt v="title" center>Your shelf is full</Txt>
        <Txt center tone={color.inkSoft}>The free plan keeps {garden.plan_capacity} plants. Rootera+ removes the limit and lets you group plants by room. Removing a plant from your garden also frees a spot; its history is kept.</Txt>
      </View>
    </Screen>;
  }

  return <Screen
    back={navigation.goBack}
    right={first ? <Press label="Add a plant later" onPress={() => navigation.goBack()} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Txt v="smallStrong" tone={color.inkSoft}>Later</Txt></Press> : undefined}
  >
    <View style={{ gap: space.sm }}>
      <Txt v="title">{photo ? 'Which plant is this?' : first ? 'Let’s meet your first plant' : 'Add a plant'}</Txt>
      <Txt tone={color.inkSoft}>{photo ? 'Pick the closest match. You can rename it next.' : 'Search by name, or start from a photo.'}</Txt>
    </View>

    {photo && <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
      <Image source={{ uri: photo }} style={{ width: 88, height: 110, borderRadius: radius.md }} />
      <View style={{ flex: 1, gap: 6 }}>
        {idState === 'loading' && <Txt v="small">Looking for matches with Pl@ntNet…</Txt>}
        {idState === 'off' && <Txt v="small">Automatic identification isn’t connected in this version. Your photo will still be used for this plant.</Txt>}
        {idState === 'error' && <Txt v="small" tone={color.danger}>Identification failed. Choose the plant below instead.</Txt>}
        {matches && !matches.length && <Txt v="small">No confident match. Choose the plant below.</Txt>}
        {matches?.map(m => <Press key={m.scientific_name} label={`${m.common_name}, ${m.scientific_name}`} onPress={() => choose({ kind: m.kind, name: m.common_name, latin: m.scientific_name })} style={{ paddingVertical: 6 }}>
          <Txt v="smallStrong">{m.common_name}</Txt>
          <Txt v="latin" style={{ fontSize: 13 }}>{m.scientific_name} · possible match</Txt>
        </Press>)}
      </View>
    </View>}

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: 1, borderColor: color.lineStrong }}>
      <Icon name="search" size={18} tone={color.inkSoft} />
      <TextInput accessibilityLabel="Search plants" value={q} onChangeText={setQ} placeholder="Monstera, pothos, babosa…" placeholderTextColor={color.inkMuted} returnKeyType="search" maxFontSizeMultiplier={1.4}
        style={[{ flex: 1, minHeight: 50, fontFamily: font.body, fontSize: 17, color: color.ink }, webNoOutline]} />
      {!photo && <Press label="Identify from a photo" onPress={() => navigation.navigate('Camera', { first })} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
        <Icon name="camera-outline" size={20} tone={color.olive} /><Txt v="smallStrong" tone={color.olive}>Photo</Txt>
      </Press>}
    </View>

    <View onLayout={grid.onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {!!grid.col && results.map(s => <Swatch key={s.kind} kind={s.kind} title={s.name} subtitle={s.latin} width={grid.col} onPress={() => choose(s)} />)}
    </View>

    <Press label={q.trim() ? `Add ${q.trim()} as another plant` : 'Add a plant that isn’t listed'} onPress={custom} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
      <PlantArt kind="other" size={48} />
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong">{q.trim() ? `Add “${q.trim()}”` : 'Not listed?'}</Txt>
        <Txt v="small">Add it by name. Guidance will rely on your own checks.</Txt>
      </View>
      <Icon name="chevron-forward" size={16} tone={color.inkMuted} />
    </Press>
  </Screen>;
}
