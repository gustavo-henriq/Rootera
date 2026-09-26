/**
 * Choose one item from a long list: a sheet with a search field and a virtualized list.
 * Replaces rows of chips once there are too many to scan (Hick's law): with 8 plants chips
 * are fine, with 500 they are not.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space, type } from './tokens';
import { T, Tap } from './components';
import { Glyph } from './icons';
import { searchText } from '../model';
import { t } from '../i18n';

export interface PickerItem { id: string; label: string; detail?: string }

export function PickerSheet({ visible, title, items, selected, onSelect, onClose }: { visible: boolean; title: string; items: PickerItem[]; selected?: string; onSelect: (id: string) => void; onClose: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const shown = useMemo(() => { const needle = searchText(q); return needle ? items.filter(i => searchText(`${i.label} ${i.detail ?? ''}`).includes(needle)) : items; }, [q, items]);
  if (!visible) return null;
  const close = () => { setQ(''); onClose(); };
  return <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close")} onPress={close} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)}
        style={{ width: '100%', maxWidth: 440, height: '78%', backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome, paddingTop: space[4], paddingHorizontal: space.gutter }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] }}>
          <T v="title2" accessibilityRole="header">{title}</T>
          <Tap label={t("Close")} onPress={close} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={18} /></Tap>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], borderBottomWidth: 1, borderColor: c.ink3 }}>
          <Glyph name="search" size={20} tone={c.ink2} />
          <TextInput accessibilityLabel={t('Search {what}', { what: title.toLowerCase() })} value={q} onChangeText={setQ} placeholder={t("Search")} placeholderTextColor={c.ink3} autoFocus={Platform.OS !== 'web'} maxFontSizeMultiplier={1.5}
            style={[type.body, { flex: 1, minHeight: 48, color: c.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
        </View>
        <FlatList data={shown} keyExtractor={i => i.id} keyboardShouldPersistTaps="handled" initialNumToRender={16}
          contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
          ListEmptyComponent={<T v="subhead" tone="ink2" style={{ paddingVertical: space[4] }}>{t('Nothing matches “{q}”.', { q })}</T>}
          renderItem={({ item }) => {
            const on = item.id === selected;
            return <Tap role="radio" selected={on} label={item.detail ? `${item.label}, ${item.detail}` : item.label} onPress={() => { onSelect(item.id); close(); }} scaleTo={.99} ring={radius.inner}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
              <View style={{ flex: 1 }}><T v="body" lines={1}>{item.label}</T>{!!item.detail && <T v="footnote" tone="ink2" lines={1}>{item.detail}</T>}</View>
              {on && <Glyph name="check" size={18} tone={c.leafText} />}
            </Tap>;
          }} />
      </Animated.View>
    </View>
  </Modal>;
}
