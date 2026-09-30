/**
 * The first plant, one decision at a time, in three phases:
 *  1. pick: a dark silhouette waits above the species strip.
 *  2. light: the chosen species grows out of the silhouette; the first question appears.
 *  3. plate: the strip steps away, the plant rises and grows, and each answer is pinned
 *     to it as a small glass note (light, pot, stage, last watering, soil).
 * "Not sure" is always an answer. When all notes are in, the question steps away and
 * the plate is ready to plant. Tapping a note reopens its question.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, FadeOutUp, LinearTransition, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { catalog, layerLabel, matchesSpecies, PlantKind, SoilLayers } from '../../model';
import { layersComplete, SoilLayersInput } from '../../ds/SoilLayers';
import { plantArt } from '../../ds/plant';
import { useCompact, useTheme } from '../../ds/theme';
import { fonts, motion, radius, space, springs, type } from '../../ds/tokens';
import { Glyph } from '../../ds/icons';
import { Candidate } from '../../api';
import { Chip, Glass, SourceMark, T, Tap } from '../../ds/components';
import { t } from '../../i18n';
import { IdentifyResult } from '../Identify';
import { enter, pivot } from '../../ds/motion';

export type Slot = 'light' | 'pot' | 'stage' | 'watered' | 'soil';
// Soil comes last: it is the one thing you go and check, and it becomes the first observation.
export const ORDER: Slot[] = ['light', 'pot', 'stage', 'watered', 'soil'];
export const LIGHT: { label: string; value: string }[] = [{ label: 'Bright, indirect', value: 'Bright indirect light' }, { label: 'Low light', value: 'Low light' }, { label: 'Direct sun', value: 'Direct sun' }, { label: 'Not sure', value: 'Not sure' }];
export const POTS: { label: string; drainage: string; self: string }[] = [{ label: 'Has a drainage hole', drainage: 'Yes', self: 'No' }, { label: 'No drainage hole', drainage: 'No', self: 'No' }, { label: 'Self-watering pot', drainage: 'Not sure', self: 'Yes' }, { label: 'Not sure', drainage: 'Not sure', self: 'Not sure' }];
export const STAGES: { label: string; value: 'Seedling' | 'Young' | 'Mature' | 'Not sure' }[] = [{ label: 'Seedling', value: 'Seedling' }, { label: 'Young', value: 'Young' }, { label: 'Mature', value: 'Mature' }, { label: 'Not sure', value: 'Not sure' }];
/** Days ago, roughly. Stored as an approximate watering; "Don't remember" records nothing. */
export const WATERED: { label: string; days: number | null }[] = [{ label: 'Today', days: 0 }, { label: 'A few days ago', days: 3 }, { label: 'Over a week ago', days: 8 }, { label: 'Don’t remember', days: null }];
/** The soil is checked in three layers (see ds/SoilLayers); the answer is either the check or "later". */
export const SOILS: { label: string; checked: boolean }[] = [{ label: 'Checked', checked: true }, { label: 'Check later', checked: false }];
export const layersSummary = (l: Partial<SoilLayers>) => [l.top, l.middle, l.bottom].map(v => v ? layerLabel[v].toLowerCase() : '–').join(', ');
const QUESTION: Record<Slot, string> = { light: 'How much light does it get?', pot: 'What is it planted in?', stage: 'How grown is it?', watered: 'When did you last water it?', soil: 'Check the soil at the surface, the middle and the bottom.' };
const LABEL: Record<Slot, string> = { light: 'Light', pot: 'Pot', stage: 'Stage', watered: 'Watered', soil: 'Soil' };
const LISTS: Record<Slot, { label: string }[]> = { light: LIGHT, pot: POTS, stage: STAGES, watered: WATERED, soil: SOILS };
const options = (s: Slot) => LISTS[s].map(o => t(o.label));

export type Answers = Partial<Record<Slot, number>>;
/** The slot being asked: the one being edited, otherwise the first one without an answer. */
export const currentSlot = (answers: Answers, editing: Slot | null) => editing ?? ORDER.find(s => answers[s] === undefined) ?? null;

function Note({ slot, side, top, value, active, onPress, anchor, width }: { slot: Slot; side: 'left' | 'right'; top: number; value?: string; active: boolean; onPress: () => void; anchor: number; width: number }) {
  const { c, reduceMotion } = useTheme();
  const boxW = 122;
  const line = useSharedValue(reduceMotion ? 1 : .02);
  useEffect(() => { if (!reduceMotion) line.value = withDelay(140, withSpring(1, springs.smooth)); }, []);
  const len = side === 'left' ? anchor - boxW : width - boxW - anchor;
  const lineW = Math.max(0, len);
  const draw = useAnimatedStyle(() => ({ transform: pivot(lineW, 1.5, side === 'left' ? 0 : 1, .5, [{ scaleX: line.value }]) }));
  const label = t(LABEL[slot]);
  return <>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top + 25, left: side === 'left' ? boxW : anchor, width: lineW, height: 1.5, backgroundColor: c.ink2 }, draw]} />
    <View pointerEvents="none" style={{ position: 'absolute', top: top + 21, left: anchor - 4, width: 9, height: 9, borderRadius: 5, backgroundColor: c.ink }} />
    <Animated.View entering={reduceMotion ? undefined : enter.fade()} style={{ position: 'absolute', top, [side]: 0, width: boxW }}>
      <Tap label={value ? `${label}: ${value}. ${t('Change')}` : `${label}. ${t('Choose below')}`} onPress={onPress} ring={radius.input}>
        <Glass level="callout" r={radius.input} shadow={active} style={{ minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1.5, borderColor: active ? c.ink : 'transparent', alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
          <View style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
            <SourceMark kind={slot === 'soil' || slot === 'watered' ? 'observed' : 'told'} /><T v="caption" tone="ink2">{label}</T>
          </View>
          <T v={value ? 'subhead' : 'footnote'} tone={value ? 'ink' : 'ink2'} lines={2} style={{ textAlign: side, fontFamily: value ? fonts.medium : fonts.regular }}>{value ?? t('Choose below')}</T>
        </Glass>
      </Tap>
    </Animated.View>
  </>;
}

/** The plant: a silhouette until a species is picked, then that species grows out of it. */
function Specimen({ kind, size }: { kind: PlantKind | null; size: SharedValue<number> }) {
  const { c, reduceMotion } = useTheme();
  const grow = useSharedValue(kind ? 1 : 0);
  useEffect(() => {
    if (!kind) return;
    // Starts from a quarter height, never from zero (a zero scale flickers on iOS).
    grow.value = reduceMotion ? 1 : 0;
    if (!reduceMotion) grow.value = withSpring(1, { damping: 13, stiffness: 120, mass: .9 });
  }, [kind]);
  const box = useAnimatedStyle(() => ({ width: size.value, height: size.value }));
  const plantStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, grow.value * 2), transform: pivot(size.value, size.value, .5, 1, [{ scaleY: .25 + .75 * grow.value }, { scaleX: .7 + .3 * grow.value }]) }));
  const shadowStyle = useAnimatedStyle(() => ({ width: size.value * .56, height: size.value * .06, bottom: -size.value * .03 }));
  return <Animated.View style={[{ alignItems: 'center' }, box]}>
    <Animated.View style={[{ position: 'absolute', borderRadius: 400, backgroundColor: c.hairline }, shadowStyle]} />
    <Image source={plantArt[kind ?? 'monstera']} resizeMode="contain" tintColor={c.sunken} accessibilityLabel={kind ? undefined : t('A plant silhouette, waiting for you to choose')} style={{ position: 'absolute', width: '100%', height: '100%', opacity: kind ? 0 : 1 }} />
    {kind && <Animated.View key={kind} style={[{ position: 'absolute', width: '100%', height: '100%' }, plantStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" accessibilityLabel={speciesLabel(kind)} style={{ width: '100%', height: '100%' }} />
    </Animated.View>}
  </Animated.View>;
}

const speciesLabel = (kind: PlantKind) => { const s = catalog.find(x => x.kind === kind); return s ? t(s.name) : t('Your plant'); };

export interface Choice { kind: PlantKind; name: string; latin: string; via: 'featured' | 'search' | 'photo' | 'custom' }
export type IdState = 'idle' | 'loading' | 'off' | 'error' | 'limit';

/** Search, photo identification and "add by name", above the carousel. */
function Finder({ q, setQ, choice, onChoose, photo, idState, matches, attempt, onCamera }: {
  q: string; setQ: (q: string) => void; choice: Choice | null; onChoose: (c: Choice) => void;
  photo?: string; idState: IdState; matches: Candidate[] | null; attempt: number; onCamera: () => void;
}) {
  const { c } = useTheme();
  const needle = q.trim().toLowerCase();
  // The carousel shows the illustrated favourites; search reaches the whole catalog.
  const list = needle ? catalog.filter(s => matchesSpecies(q, s)) : catalog.filter(s => s.featured);
  // 4.5 tiles fit the width: the half tile at the edge tells people the row scrolls.
  const screenW = Math.min(useWindowDimensions().width, 440);
  const tileW = Math.max(68, Math.floor((screenW - space.gutter - 4.5 * space[2]) / 4.5));
  const tile = (key: string, on: boolean, label: string, onPress: () => void, art: React.ReactNode, a11y: string) =>
    <Tap key={key} role="radio" selected={on} label={a11y} onPress={onPress} ring={radius.control}
      style={{ width: tileW, alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: radius.control, backgroundColor: on ? c.raised : 'transparent', borderWidth: 1.5, borderColor: on ? c.ink : 'transparent' }}>
      {art}
      <T v="caption" tone={on ? 'ink' : 'ink2'} lines={2} fit center>{label}</T>
    </Tap>;
  return <View style={{ gap: space[3] }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], borderBottomWidth: 1, borderColor: c.ink3 }}>
      <Glyph name="search" size={20} tone={c.ink2} />
      <TextInput accessibilityLabel={t("Search plants")} value={q} onChangeText={setQ} placeholder={t("Search: orchid, girassol, basil…")} placeholderTextColor={c.ink3} returnKeyType="search" maxFontSizeMultiplier={1.5}
        style={[type.body, { flex: 1, minHeight: 48, color: c.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} />
      {/* Identification is free: it is how many people find out what their plant is. */}
      <Tap label={t("Identify from a photo")} onPress={onCamera} ring={radius.inner} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space[2] }}>
        <Glyph name="camera" size={20} tone={c.leafText} /><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Photo")}</T>
      </Tap>
    </View>
    {!!photo && <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
      <Image source={{ uri: photo }} accessibilityLabel={t("Your photo")} style={{ width: 52, height: 64, borderRadius: radius.input }} />
      <View style={{ flex: 1, gap: space[1] }}>
        <IdentifyResult state={idState} matches={matches} attempt={attempt} onRetry={onCamera} selected={choice?.latin}
          onPick={m => onChoose({ kind: m.kind, name: m.common_name || m.scientific_name, latin: m.scientific_name, via: 'photo' })} />
      </View>
    </View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[2], paddingRight: space[4] }} style={{ marginHorizontal: -space.gutter, paddingLeft: space.gutter, flexGrow: 0 }}>
      {list.map(s => tile(s.kind, choice?.kind === s.kind && choice.via !== 'custom', t(s.name), () => onChoose({ kind: s.kind, name: t(s.name), latin: s.latin, via: needle ? 'search' : 'featured' }),
        <Image source={plantArt[s.kind]} style={{ width: 56, height: 56 }} resizeMode="contain" />, t(s.name)))}
      {!!needle && tile('custom', choice?.via === 'custom', t('Add “{name}”', { name: q.trim() }), () => onChoose({ kind: 'other', name: q.trim(), latin: q.trim(), via: 'custom' }),
        <View style={{ width: 56, height: 56, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}><Glyph name="plus" size={22} tone={c.ink2} /></View>,
        t('Add {name}. Guidance will come from your checks.', { name: q.trim() }))}
    </ScrollView>
    {!!needle && !list.length && <T v="footnote" tone="ink2">{t("Not in the list. Add it by name; Rootera learns from your checks.")}</T>}
  </View>;
}

export function FirstPlant({ width, choice, onChoose, answers, onAnswer, editing, setEditing, photo, idState, matches, attempt, onCamera, layers, onLayers }: {
  width: number; choice: Choice | null; onChoose: (c: Choice) => void; layers: Partial<SoilLayers>; onLayers: (l: Partial<SoilLayers>) => void;
  answers: Answers; onAnswer: (s: Slot, i: number) => void; editing: Slot | null; setEditing: (s: Slot) => void;
  photo?: string; idState: IdState; matches: Candidate[] | null; attempt: number; onCamera: () => void;
}) {
  const kind = choice?.kind ?? null;
  const [q, setQ] = useState('');
  const { c, reduceMotion } = useTheme();
  const compact = useCompact();
  const slot = kind ? currentSlot(answers, editing) : null;
  const complete = !!kind && slot === null;
  // A question waits for the plant to settle the first time it appears: after the species is
  // chosen (the title leaves and the plant grows) and after the first answer (the plate opens
  // and the plant grows larger). Shown at once, it slid over the plant while that moved.
  const asked = useRef(new Set<Slot>());
  const questionDelay = !slot || reduceMotion || asked.current.has(slot) ? 0 : slot === 'light' ? 460 : slot === 'pot' ? 560 : 0;
  useEffect(() => { if (slot) asked.current.add(slot); }, [slot]);
  // The plate takes over once the first answer is in: the strip leaves and the plant grows.
  const plate = !!kind && answers.light !== undefined;
  const small = Math.min(210, width * .54), big = Math.min(320, width * .84);
  const size = useSharedValue(plate ? big : small);
  useEffect(() => { size.value = reduceMotion ? (plate ? big : small) : withTiming(plate ? big : small, { duration: motion.dur.slow, easing: Easing.inOut(Easing.cubic) }); }, [plate, width]);
  const areaStyle = useAnimatedStyle(() => ({ height: size.value + 18 }));
  const left = (width - big) / 2;
  const valueOf = (s: Slot) => answers[s] === undefined ? undefined : s === 'soil' && SOILS[answers[s]!].checked ? layersSummary(layers) : options(s)[answers[s]!];
  const visible = (s: Slot) => answers[s] !== undefined || s === slot;
  const place: Record<Slot, { side: 'left' | 'right'; top: number; anchor: number }> = {
    light: { side: 'left', top: big * .04, anchor: left + big * .4 },
    pot: { side: 'left', top: big * .7, anchor: left + big * .4 },
    stage: { side: 'right', top: big * .0, anchor: left + big * .64 },
    soil: { side: 'right', top: big * .35, anchor: left + big * .56 },
    watered: { side: 'right', top: big * .7, anchor: left + big * .6 },
  };

  return <View style={{ gap: space[4] }}>
    {!plate && <Animated.View exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.dur.fast)}>
      <Finder q={q} setQ={setQ} choice={choice} onChoose={onChoose} photo={photo} idState={idState} matches={matches} attempt={attempt} onCamera={onCamera} />
    </Animated.View>}

    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(motion.dur.slow)} style={[{ width, alignItems: 'center' }, areaStyle]}>
      <Specimen kind={kind} size={size} />
      {plate && !compact && ORDER.filter(visible).map(s => <Note key={s} slot={s} {...place[s]} value={valueOf(s)} active={s === slot} onPress={() => setEditing(s)} width={width} />)}
    </Animated.View>

    {/* Large text: the notes become a plain list under the plant instead of labels pinned to it. */}
    {plate && compact && <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
      {ORDER.filter(visible).map(s => <Tap key={s} label={valueOf(s) ? `${t(LABEL[s])}: ${valueOf(s)}. ${t('Change')}` : `${t(LABEL[s])}. ${t('Choose below')}`} onPress={() => setEditing(s)} ring={radius.inner}
        style={{ paddingVertical: space[2], gap: 2, borderBottomWidth: 1, borderColor: c.hairline }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><SourceMark kind={s === 'soil' || s === 'watered' ? 'observed' : 'told'} /><T v="footnote" tone="ink2">{t(LABEL[s])}</T></View>
        <T v="headline" tone={valueOf(s) ? 'ink' : 'ink2'}>{valueOf(s) ?? t('Choose below')}</T>
      </Tap>)}
    </View>}

    {slot && <Animated.View key={slot} entering={reduceMotion ? undefined : FadeIn.delay(questionDelay).duration(240)} exiting={reduceMotion ? undefined : FadeOut.duration(motion.dur.fast)} style={{ gap: space[3] }}>
      <T v="headline">{t(QUESTION[slot])}</T>
      {slot === 'soil'
        ? <>
            <SoilLayersInput value={layers} onChange={l => { onLayers(l); if (layersComplete(l)) onAnswer('soil', 0); }} />
            <Tap label={t('Check later')} onPress={() => onAnswer('soil', 1)} ring={radius.inner} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
              <T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t('Check later')}</T>
            </Tap>
          </>
        : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {options(slot).map((o, i) => <Chip key={o} label={o} selected={answers[slot] === i} onPress={() => onAnswer(slot, i)} />)}
          </View>}
    </Animated.View>}

    {complete && <Animated.View entering={reduceMotion ? undefined : enter.rise(180)} style={{ gap: space[1] }}>
      <T v="headline">{!SOILS[answers.soil!].checked ? t('Its first soil check can wait.') : t('This is your first observation.')}</T>
      <T v="subhead" tone="ink2">{!SOILS[answers.soil!].checked
        ? t('Rootera will ask for one soon.')
        : t('Later checks are compared with it. Tap a note to change it.')}</T>
    </Animated.View>}
  </View>;
}
