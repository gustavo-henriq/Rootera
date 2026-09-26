import React, { useEffect, useMemo, useState } from 'react';
import { Image, TextInput, View, Platform } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { api, Candidate } from '../api';
import { atCapacity, catalog, matchesSpecies, PlantKind, Species } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space, type } from '../ds/tokens';
import { Btn, T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, PlantArt, plantArt } from '../ds/plant';
import { Stagger } from '../ds/motion';
import { photoData } from './Camera';
import { t } from '../i18n';

/** Specimen swatch: the plant rising out of its tile, a label underneath. */
function Swatch({ kind, title, latin, width, onPress }: { kind: PlantKind; title: string; latin: string; width: number; onPress: () => void }) {
  const { c } = useTheme();
  return <Tap label={`${title}, ${latin}`} onPress={onPress} ring={radius.card} style={{ width, paddingTop: width * .28 }}>
    <View style={{ height: width * .78, borderRadius: radius.card, backgroundColor: c.sunken, justifyContent: 'flex-end', padding: space[3] }}>
      <T v="headline" lines={1}>{title}</T>
      <T v="latin" tone="ink2" lines={1} style={{ fontSize: 15, lineHeight: 19 }}>{latin}</T>
    </View>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
      <PlantArt kind={kind} size={width * .72} />
    </View>
  </Tap>;
}

export function AddPlant({ navigation, route }: Props<'AddPlant'>) {
  const { garden } = useStore();
  const { c } = useTheme();
  const photo = route.params?.photo;
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  const [idState, setIdState] = useState<'idle' | 'loading' | 'off' | 'error'>('idle');
  const [w, setW] = useState(0);
  const col = w ? (w - space[3]) / 2 : 0;

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
    return t ? catalog.filter(s => matchesSpecies(q, s)) : catalog;
  }, [q]);
  const choose = (s: Pick<Species, 'kind' | 'name' | 'latin'>) => navigation.navigate('PlantForm', { kind: s.kind, species: s.latin, name: t(s.name), photo });
  const custom = () => choose({ kind: 'other', name: q.trim() || t('My plant'), latin: q.trim() || 'Unknown species' });

  if (atCapacity(garden)) {
    return <Page back={navigation.goBack} footer={<><Btn title={t("See Rootera+")} onPress={() => navigation.replace('Plans', { reason: 'limit' })} /><Btn kind="plain" title={t("Not now")} onPress={navigation.goBack} style={{ alignSelf: 'center' }} /></>}>
      <View style={{ alignItems: 'center', paddingTop: space[8], gap: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{(['pothos', 'monstera', 'zz'] as const).map((k, i) => <Image key={k} source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 124 : 92, height: i === 1 ? 124 : 92, marginHorizontal: -8 }} />)}</View>
        <Ground width={240} style={{ marginTop: -18 }} />
        <T v="title" center>{t("Your shelf is full")}</T>
        <T v="callout" tone="ink2" center>{t('The free plan keeps {n} plants. Rootera+ removes the limit and lets you group plants by room. Removing a plant also frees a spot, and its history is kept.', { n: garden.plan_capacity })}</T>
      </View>
    </Page>;
  }

  return <Page back={navigation.goBack} titleInBar={t("Add a plant")} gap={space[5]}>
    <View style={{ gap: space[2] }}>
      <T v="title">{photo ? t('Which plant is this?') : t('Add a plant')}</T>
      <T v="callout" tone="ink2">{photo ? t('Pick the closest match. You can rename it next.') : t('Search by name, or start from a photo.')}</T>
    </View>

    {photo && <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
      <Image source={{ uri: photo }} style={{ width: 88, height: 110, borderRadius: radius.control }} />
      <View style={{ flex: 1, gap: space[2] }}>
        {idState === 'loading' && <T v="subhead" tone="ink2">{t("Looking for matches with Pl@ntNet…")}</T>}
        {idState === 'off' && <T v="subhead" tone="ink2">{t("Automatic identification isn’t connected in this version. The photo will still be your plant’s picture.")}</T>}
        {idState === 'error' && <T v="subhead" tone="danger">{t("Identification failed. Choose the plant below instead.")}</T>}
        {matches && !matches.length && <T v="subhead" tone="ink2">{t("No confident match. Choose the plant below.")}</T>}
        {matches?.map(m => <Tap key={m.scientific_name} label={`${m.common_name}, ${m.scientific_name}`} onPress={() => choose({ kind: m.kind, name: m.common_name, latin: m.scientific_name })} ring={radius.inner} style={{ paddingVertical: 4 }}>
          <T v="headline">{m.common_name}</T>
          <T v="latin" tone="ink2" style={{ fontSize: 15 }}>{t('{name}, possible match', { name: m.scientific_name })}</T>
        </Tap>)}
      </View>
    </View>}

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], borderBottomWidth: 1, borderColor: c.ink3 }}>
      <Glyph name="search" size={20} tone={c.ink2} />
      <TextInput accessibilityLabel={t("Search plants")} value={q} onChangeText={setQ} placeholder={t("Monstera, pothos, babosa…")} placeholderTextColor={c.ink3} returnKeyType="search" maxFontSizeMultiplier={1.5}
        style={[type.body, { flex: 1, minHeight: 52, color: c.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
      {!photo && <Tap label={t("Identify from a photo")} onPress={() => navigation.navigate('Camera')} ring={radius.inner} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space[2] }}>
        <Glyph name="camera" size={20} tone={c.leafText} /><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Photo")}</T>
      </Tap>}
    </View>

    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: space[4] }}>
      {!!col && results.map((s, i) => <Stagger key={s.kind} index={i}><Swatch kind={s.kind} title={t(s.name)} latin={s.latin} width={col} onPress={() => choose(s)} /></Stagger>)}
    </View>

    <Tap label={q.trim() ? t('Add {name} as another plant', { name: q.trim() }) : t('Add a plant that isn’t listed')} onPress={custom} ring={radius.control} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.control, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'flex-end' }}><PlantArt kind="other" size={52} /></View>
      <View style={{ flex: 1 }}>
        <T v="headline">{q.trim() ? t('Add “{name}”', { name: q.trim() }) : t('Not listed?')}</T>
        <T v="footnote" tone="ink2">{t("Add it by name. Guidance will rely on your own checks.")}</T>
      </View>
      <Glyph name="forward" size={16} tone={c.ink3} />
    </Tap>
  </Page>;
}
