/**
 * The growth diary section of a plant page (Rootera+). A strip of dated photos, newest
 * last like a timeline, with one tile to add the next. On the free plan the same section
 * shows what it would hold and where to get it, without blocking anything else.
 */
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOCALE } from '../model';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, T, Tap } from '../ds/components';
import { Glyph } from '../ds/icons';
import { ActionSheet } from '../ds/ActionSheet';
import { addToDiary, DiaryEntry, loadDiary, removeFromDiary } from '../diary';
import { haptic } from '../ds/feedback';

const TILE = { w: 104, h: 130 };

export function GrowthDiary({ plantId, plantName, plus, onUpgrade }: { plantId: string; plantName: string; plus: boolean; onUpgrade: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [choose, setChoose] = useState(false);
  const [open, setOpen] = useState<DiaryEntry | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void loadDiary(plantId).then(setEntries); }, [plantId]);

  const pick = async (camera: boolean) => {
    setError('');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError('Camera access is off for Rootera. You can still choose a photo.'); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .7, allowsEditing: true, aspect: [4, 5] };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled) return;
      setEntries(await addToDiary(plantId, r.assets[0].uri));
      haptic.success();
    } catch { setError('The photo couldn’t be saved. Please try again.'); }
  };

  const date = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

  if (!plus) return <View style={{ gap: space[3] }}>
    <T v="section">Growth diary</T>
    <View style={{ flexDirection: 'row', gap: space[2] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map(i => <View key={i} style={{ width: TILE.w * .8, height: TILE.h * .8, borderRadius: radius.control, backgroundColor: c.sunken, opacity: 1 - i * .25, alignItems: 'center', justifyContent: 'center' }}>
        <Glyph name="camera" size={22} tone={c.ink3} />
      </View>)}
    </View>
    <T v="subhead" tone="ink2">A dated photo now and then shows how {plantName} grows. The growth diary is part of Rootera+; photos stay on this phone.</T>
    <Btn kind="outline" size="regular" title="See Rootera+" onPress={onUpgrade} style={{ alignSelf: 'flex-start' }} />
  </View>;

  return <View style={{ gap: space[3] }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <T v="section">Growth diary</T>
      {!!entries.length && <T v="footnote" tone="ink2">{entries.length} {entries.length === 1 ? 'photo' : 'photos'}</T>}
    </View>
    {!!error && <T v="subhead" tone="danger">{error}</T>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, flexGrow: 0 }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space.gutter }}>
      {entries.map((e, i) => <Animated.View key={e.id} entering={reduceMotion || i < entries.length - 1 ? undefined : ZoomIn.springify().damping(16)}>
        <Tap label={`Photo from ${date(e.at)}`} onPress={() => setOpen(e)} ring={radius.control} scaleTo={.97}>
          <Image source={{ uri: e.uri }} accessibilityIgnoresInvertColors style={{ width: TILE.w, height: TILE.h, borderRadius: radius.control, backgroundColor: c.sunken }} />
          <T v="caption" tone="ink2" style={{ marginTop: 4 }}>{date(e.at)}</T>
        </Tap>
      </Animated.View>)}
      <Tap label="Add a photo to the growth diary" onPress={() => Platform.OS === 'web' ? void pick(false) : setChoose(true)} ring={radius.control}>
        <View style={{ width: TILE.w, height: TILE.h, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3, alignItems: 'center', justifyContent: 'center', gap: space[1] }}>
          <Glyph name="camera" size={22} tone={c.ink2} />
          <T v="caption" tone="ink2" center>{entries.length ? 'Add today' : 'First photo'}</T>
        </View>
      </Tap>
    </ScrollView>
    {!entries.length && <T v="subhead" tone="ink2">Take a photo from the same spot every few weeks. Side by side, slow changes become easy to see.</T>}
    <ActionSheet visible={choose} title="Growth diary" onClose={() => setChoose(false)} actions={[
      { label: 'Take a photo', icon: 'camera', onPress: () => void pick(true) },
      { label: 'Choose from your photos', icon: 'leaf', onPress: () => void pick(false) },
    ]} />
    {open && <Modal transparent visible animationType="none" onRequestClose={() => setOpen(null)} statusBarTranslucent>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,6,0.92)', paddingTop: insets.top + space[3], paddingBottom: insets.bottom + space[4], paddingHorizontal: space.gutter, gap: space[3] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="headline" style={{ color: '#EEF2E6' }}>{date(open.at)}</T>
          <Tap label="Close" onPress={() => setOpen(null)} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={20} tone="#EEF2E6" /></Tap>
        </View>
        <Pressable accessibilityRole="image" accessibilityLabel={`${plantName}, ${date(open.at)}`} onPress={() => setOpen(null)} style={{ flex: 1 }}>
          <Image source={{ uri: open.uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={{ flex: 1, borderRadius: radius.card }} />
        </Pressable>
        <Tap label="Delete this photo" onPress={() => { const id = open.id; setOpen(null); void removeFromDiary(plantId, id).then(setEntries); }} ring={radius.control}
          style={{ alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3] }}>
          <Glyph name="trash" size={18} tone="#F08D78" /><T v="subhead" style={{ color: '#F08D78', fontFamily: fonts.medium }}>Delete photo</T>
        </Tap>
      </Animated.View>
    </Modal>}
  </View>;
}
