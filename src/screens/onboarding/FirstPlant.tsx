/**
 * The first plant, one decision at a time, in three phases:
 *  1. pick: a dark silhouette waits above the species strip.
 *  2. light: the chosen species grows out of the silhouette; the first question appears.
 *  3. plate: the strip steps away, the plant rises and grows, and each answer is pinned
 *     to it as a small glass note (light, pot, stage, last watering, soil).
 * "Not sure" is always an answer. When all notes are in, the question steps away and
 * the plate is ready to plant. Tapping a note reopens its question.
 */
import React, { useEffect } from 'react';
import { Image, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, FadeOutUp, LinearTransition, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { catalog, PlantKind, Soil } from '../../model';
import { plantArt } from '../../ds/plant';
import { useTheme } from '../../ds/theme';
import { fonts, radius, space, springs } from '../../ds/tokens';
import { Chip, Glass, SourceMark, T, Tap } from '../../ds/components';

export type Slot = 'light' | 'pot' | 'stage' | 'watered' | 'soil';
// Soil comes last: it is the one thing you go and check, and it becomes the first observation.
export const ORDER: Slot[] = ['light', 'pot', 'stage', 'watered', 'soil'];
export const LIGHT: { label: string; value: string }[] = [{ label: 'Bright, indirect', value: 'Bright indirect light' }, { label: 'Low light', value: 'Low light' }, { label: 'Direct sun', value: 'Direct sun' }, { label: 'Not sure', value: 'Not sure' }];
export const POTS: { label: string; drainage: string; self: string }[] = [{ label: 'Has a drainage hole', drainage: 'Yes', self: 'No' }, { label: 'No drainage hole', drainage: 'No', self: 'No' }, { label: 'Self-watering pot', drainage: 'Not sure', self: 'Yes' }, { label: 'Not sure', drainage: 'Not sure', self: 'Not sure' }];
export const STAGES: { label: string; value: 'Seedling' | 'Young' | 'Mature' | 'Not sure' }[] = [{ label: 'Seedling', value: 'Seedling' }, { label: 'Young', value: 'Young' }, { label: 'Mature', value: 'Mature' }, { label: 'Not sure', value: 'Not sure' }];
/** Days ago, roughly. Stored as an approximate watering; "Don't remember" records nothing. */
export const WATERED: { label: string; days: number | null }[] = [{ label: 'Today', days: 0 }, { label: 'A few days ago', days: 3 }, { label: 'Over a week ago', days: 8 }, { label: 'Don’t remember', days: null }];
export const SOILS: { label: string; value: Soil }[] = [{ label: 'Dry', value: 'dry' }, { label: 'Slightly moist', value: 'slightly_moist' }, { label: 'Moist', value: 'moist' }, { label: 'Very wet', value: 'wet' }, { label: 'Not sure', value: 'not_sure' }];
const QUESTION: Record<Slot, string> = { light: 'How much light does it get?', pot: 'What is it planted in?', stage: 'How grown is it?', watered: 'When did you last water it?', soil: 'Push a finger into the soil. How does it feel?' };
const LABEL: Record<Slot, string> = { light: 'Light', pot: 'Pot', stage: 'Stage', watered: 'Watered', soil: 'Soil' };
const LISTS: Record<Slot, { label: string }[]> = { light: LIGHT, pot: POTS, stage: STAGES, watered: WATERED, soil: SOILS };
const options = (s: Slot) => LISTS[s].map(o => o.label);

export type Answers = Partial<Record<Slot, number>>;
/** The slot being asked: the one being edited, otherwise the first one without an answer. */
export const currentSlot = (answers: Answers, editing: Slot | null) => editing ?? ORDER.find(s => answers[s] === undefined) ?? null;

function Note({ slot, side, top, value, active, onPress, anchor, width }: { slot: Slot; side: 'left' | 'right'; top: number; value?: string; active: boolean; onPress: () => void; anchor: number; width: number }) {
  const { c, reduceMotion } = useTheme();
  const boxW = 122;
  const line = useSharedValue(reduceMotion ? 1 : .02);
  useEffect(() => { if (!reduceMotion) line.value = withDelay(140, withSpring(1, springs.smooth)); }, []);
  const len = side === 'left' ? anchor - boxW : width - boxW - anchor;
  const draw = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));
  const label = LABEL[slot];
  return <>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top + 25, left: side === 'left' ? boxW : anchor, width: Math.max(0, len), height: 1.5, backgroundColor: c.ink2, transformOrigin: side === 'left' ? 'left' : 'right' }, draw]} />
    <View pointerEvents="none" style={{ position: 'absolute', top: top + 21, left: anchor - 4, width: 9, height: 9, borderRadius: 5, backgroundColor: c.ink }} />
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(320)} style={{ position: 'absolute', top, [side]: 0, width: boxW }}>
      <Tap label={value ? `${label}: ${value}. Change` : `${label}. Choose below`} onPress={onPress} ring={radius.input}>
        <Glass level="callout" r={radius.input} shadow={active} style={{ minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1.5, borderColor: active ? c.ink : 'transparent', alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
          <View style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
            <SourceMark kind={slot === 'soil' || slot === 'watered' ? 'observed' : 'told'} /><T v="caption" tone="ink2">{label}</T>
          </View>
          <T v={value ? 'subhead' : 'footnote'} tone={value ? 'ink' : 'ink2'} lines={2} style={{ textAlign: side, fontFamily: value ? fonts.medium : fonts.regular }}>{value ?? 'Choose below'}</T>
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
  const plantStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, grow.value * 2), transform: [{ scaleY: .25 + .75 * grow.value }, { scaleX: .7 + .3 * grow.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ width: size.value * .56, height: size.value * .06, bottom: -size.value * .03 }));
  return <Animated.View style={[{ alignItems: 'center' }, box]}>
    <Animated.View style={[{ position: 'absolute', borderRadius: 400, backgroundColor: c.hairline }, shadowStyle]} />
    <Image source={plantArt[kind ?? 'monstera']} resizeMode="contain" tintColor={c.sunken} accessibilityLabel={kind ? undefined : 'A plant silhouette, waiting for you to choose'} style={{ position: 'absolute', width: '100%', height: '100%', opacity: kind ? 0 : 1 }} />
    {kind && <Animated.View key={kind} style={[{ position: 'absolute', width: '100%', height: '100%', transformOrigin: 'bottom' }, plantStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" accessibilityLabel={catalog.find(s => s.kind === kind)?.name} style={{ width: '100%', height: '100%' }} />
    </Animated.View>}
  </Animated.View>;
}

export function FirstPlant({ width, kind, setKind, answers, onAnswer, editing, setEditing }: {
  width: number; kind: PlantKind | null; setKind: (k: PlantKind) => void;
  answers: Answers; onAnswer: (s: Slot, i: number) => void; editing: Slot | null; setEditing: (s: Slot) => void;
}) {
  const { c, reduceMotion } = useTheme();
  const slot = kind ? currentSlot(answers, editing) : null;
  const complete = !!kind && slot === null;
  // The plate takes over once the first answer is in: the strip leaves and the plant grows.
  const plate = !!kind && answers.light !== undefined;
  const small = Math.min(210, width * .54), big = Math.min(320, width * .84);
  const size = useSharedValue(plate ? big : small);
  useEffect(() => { size.value = reduceMotion ? (plate ? big : small) : withTiming(plate ? big : small, { duration: 520, easing: Easing.inOut(Easing.cubic) }); }, [plate, width]);
  const areaStyle = useAnimatedStyle(() => ({ height: size.value + 18 }));
  const left = (width - big) / 2;
  const valueOf = (s: Slot) => answers[s] === undefined ? undefined : options(s)[answers[s]!];
  const visible = (s: Slot) => answers[s] !== undefined || s === slot;
  const place: Record<Slot, { side: 'left' | 'right'; top: number; anchor: number }> = {
    light: { side: 'left', top: big * .04, anchor: left + big * .4 },
    pot: { side: 'left', top: big * .7, anchor: left + big * .4 },
    stage: { side: 'right', top: big * .0, anchor: left + big * .64 },
    soil: { side: 'right', top: big * .35, anchor: left + big * .56 },
    watered: { side: 'right', top: big * .7, anchor: left + big * .6 },
  };

  return <View style={{ gap: space[4] }}>
    {!plate && <Animated.View exiting={reduceMotion ? undefined : FadeOutUp.duration(260)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingRight: space[4] }} style={{ marginHorizontal: -space.gutter, paddingLeft: space.gutter, flexGrow: 0 }}>
        {catalog.map(s => {
          const on = kind === s.kind;
          return <Tap key={s.kind} role="radio" selected={on} label={s.name} onPress={() => setKind(s.kind)} ring={radius.control}
            style={{ width: 84, alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: radius.control, backgroundColor: on ? c.raised : 'transparent', borderWidth: 1.5, borderColor: on ? c.ink : 'transparent' }}>
            <Image source={plantArt[s.kind]} style={{ width: 56, height: 56 }} resizeMode="contain" />
            <T v="caption" tone={on ? 'ink' : 'ink2'} lines={1}>{s.name}</T>
          </Tap>;
        })}
      </ScrollView>
    </Animated.View>}

    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(420)} style={[{ width, alignItems: 'center' }, areaStyle]}>
      <Specimen kind={kind} size={size} />
      {plate && ORDER.filter(visible).map(s => <Note key={s} slot={s} {...place[s]} value={valueOf(s)} active={s === slot} onPress={() => setEditing(s)} width={width} />)}
    </Animated.View>

    {slot && <Animated.View key={slot} layout={reduceMotion ? undefined : LinearTransition.duration(420)} entering={FadeIn.duration(240)} exiting={FadeOut.duration(140)} style={{ gap: space[3] }}>
      <T v="headline">{QUESTION[slot]}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {options(slot).map((o, i) => <Chip key={o} label={o} selected={answers[slot] === i} onPress={() => onAnswer(slot, i)} />)}
      </View>
    </Animated.View>}

    {complete && <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ gap: space[1] }}>
      <T v="headline">{SOILS[answers.soil!].value === 'not_sure' ? 'Its first soil check can wait.' : 'This is your first observation.'}</T>
      <T v="subhead" tone="ink2">{SOILS[answers.soil!].value === 'not_sure'
        ? 'Rootera will ask for one soon. Every later check is compared with it.'
        : 'Rootera compares every later check with it. Tap any note to change it.'}</T>
    </Animated.View>}
  </View>;
}
