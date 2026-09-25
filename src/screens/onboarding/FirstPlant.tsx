/**
 * The first plant, one decision at a time. An empty pot waits; picking a species grows
 * it out of the pot. Then the notes arrive one by one (light, pot, soil), each as a
 * glass label on the plate with the plant showing through. "Not sure" is always an
 * answer. When all three are in, the choices step away and the plate is ready to plant.
 */
import React, { useEffect } from 'react';
import { Image, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { catalog, PlantKind, Soil } from '../../model';
import { plantArt } from '../../ds/plant';
import { useTheme } from '../../ds/theme';
import { fonts, radius, space, springs } from '../../ds/tokens';
import { Chip, Glass, SourceMark, T, Tap } from '../../ds/components';

const POT = require('../../../assets/plants/aloe-pot.png');
const RATIO = 406 / 560;

export type Slot = 'light' | 'pot' | 'soil';
export const ORDER: Slot[] = ['light', 'pot', 'soil'];
export const LIGHT: { label: string; value: string }[] = [{ label: 'Bright, indirect', value: 'Bright indirect light' }, { label: 'Low light', value: 'Low light' }, { label: 'Direct sun', value: 'Direct sun' }, { label: 'Not sure', value: 'Not sure' }];
export const POTS: { label: string; drainage: string; self: string }[] = [{ label: 'Has a drainage hole', drainage: 'Yes', self: 'No' }, { label: 'No drainage hole', drainage: 'No', self: 'No' }, { label: 'Self-watering pot', drainage: 'Not sure', self: 'Yes' }, { label: 'Not sure', drainage: 'Not sure', self: 'Not sure' }];
export const SOILS: { label: string; value: Soil }[] = [{ label: 'Dry', value: 'dry' }, { label: 'Slightly moist', value: 'slightly_moist' }, { label: 'Moist', value: 'moist' }, { label: 'Very wet', value: 'wet' }, { label: 'Not sure', value: 'not_sure' }];
const QUESTION: Record<Slot, string> = { light: 'How much light does it get?', pot: 'What is it planted in?', soil: 'Push a finger into the soil. How does it feel?' };
const LABEL: Record<Slot, string> = { light: 'Light', pot: 'Pot', soil: 'Soil' };
const options = (s: Slot) => (s === 'light' ? LIGHT : s === 'pot' ? POTS : SOILS).map(o => o.label);

export type Answers = Partial<Record<Slot, number>>;
/** The slot being asked: the one being edited, otherwise the first one without an answer. */
export const currentSlot = (answers: Answers, editing: Slot | null) => editing ?? ORDER.find(s => answers[s] === undefined) ?? null;

function Callout({ slot, side, top, value, active, onPress, anchor, width }: { slot: Slot; side: 'left' | 'right'; top: number; value?: string; active: boolean; onPress: () => void; anchor: number; width: number }) {
  const { c, reduceMotion } = useTheme();
  const boxW = 126;
  const line = useSharedValue(0);
  useEffect(() => { line.value = reduceMotion ? 1 : withDelay(120, withSpring(1, springs.smooth)); }, []);
  const len = side === 'left' ? anchor - boxW : width - boxW - anchor;
  const draw = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));
  const label = LABEL[slot];
  return <>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top + 25, left: side === 'left' ? boxW : anchor, width: Math.max(0, len), height: 1.5, backgroundColor: c.ink2, transformOrigin: side === 'left' ? 'left' : 'right' }, draw]} />
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(320)} style={{ position: 'absolute', top, [side]: 0, width: boxW }}>
      <Tap label={value ? `${label}: ${value}. Change` : `${label}. Choose below`} onPress={onPress} ring={radius.input}>
        <Glass level="callout" r={radius.input} shadow={active} style={{ minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1.5, borderColor: active ? c.ink : 'transparent', alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
          <View style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
            <SourceMark kind={slot === 'soil' ? 'observed' : 'told'} /><T v="caption" tone="ink2">{label}</T>
          </View>
          <T v={value ? 'subhead' : 'footnote'} tone={value ? 'ink' : 'ink2'} lines={2} style={{ textAlign: side, fontFamily: value ? fonts.medium : fonts.regular }}>{value ?? 'Choose below'}</T>
        </Glass>
      </Tap>
    </Animated.View>
  </>;
}

function Specimen({ kind, size }: { kind: PlantKind | null; size: number }) {
  const { c, reduceMotion } = useTheme();
  const grow = useSharedValue(kind ? 1 : 0);
  const pot = useSharedValue(kind ? 0 : 1);
  useEffect(() => {
    if (!kind) return;
    pot.value = reduceMotion ? 0 : withTiming(0, { duration: 240 });
    // A new species grows up out of the pot instead of swapping in.
    grow.value = 0;
    grow.value = reduceMotion ? 1 : withSpring(1, { damping: 13, stiffness: 120, mass: .9 });
  }, [kind]);
  const plantStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, grow.value * 2), transform: [{ scaleY: .25 + .75 * grow.value }, { scaleX: .7 + .3 * grow.value }] }));
  const potStyle = useAnimatedStyle(() => ({ opacity: pot.value }));
  return <View style={{ width: size, height: size, alignItems: 'center' }}>
    <View style={{ position: 'absolute', bottom: -size * .03, width: size * .56, height: size * .06, borderRadius: size, backgroundColor: c.hairline }} />
    <Animated.Image source={POT} resizeMode="contain" accessibilityLabel="An empty pot" style={[{ position: 'absolute', width: size * RATIO, height: size }, potStyle]} />
    {kind && <Animated.View key={kind} style={[{ position: 'absolute', width: size, height: size, transformOrigin: 'bottom' }, plantStyle]}>
      <Image source={plantArt[kind]} resizeMode="contain" accessibilityLabel={catalog.find(s => s.kind === kind)?.name} style={{ width: size, height: size }} />
    </Animated.View>}
  </View>;
}

export function FirstPlant({ width, kind, setKind, answers, onAnswer, editing, setEditing }: {
  width: number; kind: PlantKind | null; setKind: (k: PlantKind) => void;
  answers: Answers; onAnswer: (s: Slot, i: number) => void; editing: Slot | null; setEditing: (s: Slot) => void;
}) {
  const { c } = useTheme();
  const size = Math.min(210, width * .54);
  const left = (width - size) / 2;
  const slot = kind ? currentSlot(answers, editing) : null;
  const complete = !!kind && slot === null;
  const valueOf = (s: Slot) => answers[s] === undefined ? undefined : options(s)[answers[s]!];
  const visible = (s: Slot) => answers[s] !== undefined || s === slot;
  const place: Record<Slot, { side: 'left' | 'right'; top: number; anchor: number }> = {
    light: { side: 'left', top: size * .1, anchor: left + size * .42 },
    soil: { side: 'right', top: size * .5, anchor: left + size * .6 },
    pot: { side: 'left', top: size * .72, anchor: left + size * .38 },
  };

  return <View style={{ gap: space[4] }}>
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

    <View style={{ width, height: size + 16 }}>
      <View style={{ position: 'absolute', left, top: 0 }}><Specimen kind={kind} size={size} /></View>
      {kind && ORDER.filter(visible).map(s => <Callout key={s} slot={s} {...place[s]} value={valueOf(s)} active={s === slot} onPress={() => setEditing(s)} width={width} />)}
    </View>

    {slot && <Animated.View key={slot} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={{ gap: space[3] }}>
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
