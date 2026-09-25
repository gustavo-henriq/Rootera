/** Living reference for the design system. Web preview: add `?gallery=1` (and `&scheme=dark`). */
import React, { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Palette, radius, space, type } from './tokens';
import { Glyph, glyphNames } from './icons';
import { Btn, Chip, Field, Figure, FloatingTabBar, Glass, GlassIcon, Group, Row, Segmented, SourceLabel, T, Toast } from './components';

const swatches: (keyof Palette)[] = ['canvas', 'raised', 'sunken', 'ink', 'ink2', 'ink3', 'action', 'leaf', 'leafText', 'leafMark', 'clay', 'clayText', 'water', 'danger'];

export function Gallery() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState('Indoors');
  const [seg, setSeg] = useState<'Guided' | 'Concise'>('Guided');
  const [tab, setTab] = useState('today');
  const [name, setName] = useState('');
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ padding: space.gutter, paddingTop: insets.top + space[6], paddingBottom: 140, gap: space[8] }}>
      <View style={{ gap: space[2] }}>
        <T v="footnote" tone="ink2" style={{ fontWeight: '600' }}>Rootera design system · {scheme}</T>
        <T v="largeTitle">Greenhouse Glass</T>
        <T v="body" tone="ink2">Content grows on solid paper. Glass is only for what floats above it.</T>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Colour</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {swatches.map(k => <View key={k} style={{ width: '31%', gap: 4 }}>
            <View style={{ height: 44, borderRadius: radius.input, backgroundColor: c[k] as string, borderWidth: 1, borderColor: c.hairline }} />
            <T v="caption" tone="ink2">{k}</T>
          </View>)}
        </View>
        <View style={{ flexDirection: 'row', height: 18, borderRadius: radius.inner, overflow: 'hidden' }}>{c.soil.map(s => <View key={s} style={{ flex: 1, backgroundColor: s }} />)}</View>
        <T v="footnote" tone="ink3">Soil scale: dry → very wet. Used only for soil checks.</T>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Type</T>
        <T v="display">Monstera</T>
        <T v="latin" tone="ink2">Monstera deliciosa</T>
        {(['largeTitle', 'title', 'title2', 'headline', 'body', 'subhead', 'footnote', 'caption'] as const).map(v => <View key={v} style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[3] }}>
          <T v="caption" tone="ink3" style={{ width: 70 }}>{v} {type[v].fontSize}</T>
          <T v={v} style={{ flex: 1 }} lines={1}>The soil is still moist</T>
        </View>)}
        <View style={{ flexDirection: 'row', gap: space[6] }}>
          <Figure value="4" unit="days" caption="Since watering" />
          <Figure value="2/3" caption="Cycles to a pattern" />
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Glass, over content</T>
        <View style={{ height: 260, borderRadius: radius.card, backgroundColor: c.sunken, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../assets/plants/monstera.png')} style={{ width: 230, height: 230 }} resizeMode="contain" />
          <View style={{ position: 'absolute', top: space[3], left: space[3], right: space[3], flexDirection: 'row', justifyContent: 'space-between' }}>
            <GlassIcon name="back" label="Back" onPress={() => undefined} />
            <GlassIcon name="more" label="More" onPress={() => undefined} />
          </View>
          <View style={{ position: 'absolute', left: space[3], right: space[3], bottom: space[3] }}>
            <Toast title="Soil check saved" text="Next step changed: you found the soil dry." onClose={() => undefined} />
          </View>
        </View>
        <T v="footnote" tone="ink3">Chrome (tab bar, headers) · Control (buttons, toasts) · Clear (no text). With Reduce Transparency, all become solid.</T>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Controls</T>
        <Btn title="Check the soil" icon="soil" onPress={() => undefined} />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Btn title="Log water" icon="water" kind="tinted" size="regular" onPress={() => undefined} />
          <Btn title="Not now" kind="plain" size="regular" onPress={() => undefined} />
          <Btn title="Remove" kind="destructive" size="regular" onPress={() => undefined} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {['Indoors', 'Balcony', 'Outdoors', 'Not sure'].map(v => <Chip key={v} label={v} selected={chip === v} onPress={() => setChip(v)} />)}
        </View>
        <Segmented values={['Guided', 'Concise'] as const} value={seg} onChange={setSeg} labels={{ Guided: 'Explain the how-to', Concise: 'Just the essentials' }} />
        <Field label="Name" value={name} onChangeText={setName} placeholder="Monstera" help="Optional. The species name is used otherwise." />
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Lists and sources</T>
        <Group header="Plant care profile" footer="Changes apply to every plant.">
          <Row icon="person" title="Name and experience" detail="A few plants" onPress={() => undefined} />
          <Row icon="bell" title="Care nudges" value="On" />
          <Row icon="book" title="How Rootera learns" onPress={() => undefined} />
        </Group>
        <View style={{ gap: space[2] }}>
          <SourceLabel kind="observed" />
          <SourceLabel kind="told" />
          <SourceLabel kind="species" />
          <SourceLabel kind="suggested" />
          <SourceLabel kind="off" />
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <T v="title2">Glyphs</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
          {glyphNames.map(n => <View key={n} style={{ width: 52, alignItems: 'center', gap: 4 }}><Glyph name={n} size={24} /><T v="caption" tone="ink3" lines={1}>{n}</T></View>)}
        </View>
      </View>
    </ScrollView>
    <FloatingTabBar bottomInset={insets.bottom} active={tab} onSelect={setTab} items={[
      { key: 'today', label: 'Today', icon: 'today' }, { key: 'plants', label: 'Plants', icon: 'shelf' }, { key: 'journal', label: 'Journal', icon: 'journal' }, { key: 'you', label: 'You', icon: 'person' },
    ]} />
  </View>;
}
