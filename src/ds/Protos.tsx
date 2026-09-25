/**
 * Phase 3 prototypes: the signature interaction of each onboarding concept.
 * Web preview: `?proto=A`, `?proto=B` or `?proto=C`. Throwaway code — the chosen
 * concept is rebuilt properly in phase 4.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space, springs } from './tokens';
import { Btn, Chip, Glass, Segmented, SourceMark, T, Tap } from './components';
import { Glyph } from './icons';

const art = {
  pot: require('../../assets/plants/aloe-pot.png'),
  aloe: require('../../assets/plants/aloe.png'),
  monstera: require('../../assets/plants/monstera.png'),
  pothos: require('../../assets/plants/pothos.png'),
  'peace-lily': require('../../assets/plants/peace-lily.png'),
  sprout: require('../../assets/plants/other.png'),
};

function Frame({ title, note, children }: React.PropsWithChildren<{ title: string; note: string }>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top + space[4], paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4] }}>
    <T v="footnote" tone="ink3">{note}</T>
    <T v="hero" style={{ marginTop: space[2] }}>{title}</T>
    <View style={{ flex: 1 }}>{children}</View>
  </View>;
}

/* ---------- A · Plant it yourself: drag the seed into the pot ---------- */
function ProtoA() {
  const { c, reduceMotion } = useTheme();
  const [planted, setPlanted] = useState(false);
  const x = useSharedValue(0), y = useSharedValue(0), grow = useSharedValue(0), lift = useSharedValue(1);
  const plant = () => {
    setPlanted(true);
    grow.value = reduceMotion ? 1 : withDelay(180, withSpring(1, springs.bouncy));
  };
  // Seed starts ~230pt above the pot mouth; releasing within 70pt of it plants it.
  const pan = Gesture.Pan().enabled(!planted)
    .onBegin(() => { lift.value = withSpring(1.25, springs.snappy); })
    .onChange(e => { x.value += e.changeX; y.value += e.changeY; })
    .onFinalize(() => {
      lift.value = withSpring(1, springs.snappy);
      const hit = Math.abs(x.value) < 70 && Math.abs(y.value - 230) < 70;
      if (hit) { x.value = withSpring(0, springs.smooth); y.value = withSpring(236, springs.smooth); runOnJS(plant)(); }
      else { x.value = withSpring(0, springs.smooth); y.value = withSpring(0, springs.smooth); }
    });
  const seed = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: lift.value * (1 - grow.value) }] }));
  const sprout = useAnimatedStyle(() => ({ opacity: grow.value, transform: [{ translateY: (1 - grow.value) * 60 }, { scale: .4 + .6 * grow.value }] }));
  return <Frame note="Concept A · Plant it yourself · step 1 of 5" title={planted ? 'It’s in. Now it can grow.' : 'Drop the seed in the pot.'}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space[8] }}>
      <GestureDetector gesture={pan}>
        <Animated.View accessible accessibilityRole="button" accessibilityLabel="Seed. Drag it into the pot" accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => plant()}
          style={[{ position: 'absolute', top: 40, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }, seed]}>
          <View style={{ width: 22, height: 30, borderRadius: 14, backgroundColor: '#8A6440', transform: [{ rotate: '-18deg' }] }} />
        </Animated.View>
      </GestureDetector>
      <View style={{ width: 240, height: 300, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Animated.Image source={art.sprout} resizeMode="contain" style={[{ position: 'absolute', bottom: 0, width: 220, height: 290 }, sprout]} />
        {!planted && <Image source={art.pot} resizeMode="contain" style={{ width: 170, height: 234 }} />}
      </View>
      {!planted && <T v="subhead" tone="ink2" center style={{ marginTop: space[4] }}>Rootera learns one plant at a time, starting now.</T>}
      {planted && <Animated.View entering={FadeIn.delay(400)} style={{ alignSelf: 'stretch', marginTop: space[4] }}><Btn title="Choose what it is" onPress={() => undefined} /></Animated.View>}
    </View>
    <GrowthProgress stage={planted ? 1 : 0} />
  </Frame>;
}

function GrowthProgress({ stage }: { stage: number }) {
  const { c } = useTheme();
  // Progress is a plant growing, not dots: seed, sprout, leaves, stem, plant.
  return <View accessible accessibilityLabel={`Step ${stage + 1} of 5`} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10, height: 28 }}>
    {[6, 10, 14, 19, 24].map((h, i) => <View key={i} style={{ width: 4, height: h, borderRadius: 2, backgroundColor: i <= stage ? c.leafMark : c.hairline }} />)}
  </View>;
}

/* ---------- B · Your first nudge: every answer rewrites the notification live ---------- */
const species = [
  { key: 'monstera', name: 'Monstera', tip: 'when the top third of the soil has dried' },
  { key: 'pothos', name: 'Pothos', tip: 'when the top few centimetres are dry' },
  { key: 'peace-lily', name: 'Peace lily', tip: 'once the top layer is dry, before the pot dries out' },
  { key: 'aloe', name: 'Aloe', tip: 'only once the soil is dry all the way down' },
] as const;
function ProtoB() {
  const { c } = useTheme();
  const [plant, setPlant] = useState<(typeof species)[number]['key']>('monstera');
  const [spot, setSpot] = useState('Bright window');
  const [detail, setDetail] = useState<'Guided' | 'Concise'>('Guided');
  const sp = species.find(s => s.key === plant)!;
  const text = detail === 'Guided'
    ? `Push a finger into the soil. ${sp.name}s usually want water ${sp.tip}. Tell me what you feel and I’ll start learning your ${spot.toLowerCase()} spot.`
    : `Check the soil. Water ${sp.tip}.`;
  return <Frame note="Concept B · Your first nudge · steps 1–3 on one screen" title="Build the first message Rootera will send you.">
    <View style={{ gap: space[5], marginTop: space[5] }}>
      <Animated.View key={plant + spot + detail} entering={FadeIn.duration(220)}>
        <Glass level="control" r={radius.card} style={{ padding: space[4], gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Glyph name="sprout" size={16} tone={c.leafMark} />
            <T v="caption" tone="ink2" style={{ flex: 1 }}>Rootera, about your {sp.name.toLowerCase()}</T>
            <T v="caption" tone="ink3">now</T>
          </View>
          <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="headline">Time for a first soil check</T>
              <T v="subhead" tone="ink2">{text}</T>
            </View>
            <Image source={art[plant]} style={{ width: 56, height: 56 }} resizeMode="contain" />
          </View>
        </Glass>
      </Animated.View>
      <View style={{ gap: space[2] }}>
        <T v="footnote" tone="ink2">Which plant?</T>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {species.map(s => <Tap key={s.key} role="radio" selected={plant === s.key} label={s.name} onPress={() => setPlant(s.key)} ring={radius.control}
            style={{ flex: 1, height: 84, borderRadius: radius.control, backgroundColor: plant === s.key ? c.raised : c.sunken, borderWidth: plant === s.key ? 1.5 : 0, borderColor: c.ink, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
            <Image source={art[s.key]} style={{ width: 62, height: 70 }} resizeMode="contain" />
          </Tap>)}
        </View>
      </View>
      <View style={{ gap: space[2] }}>
        <T v="footnote" tone="ink2">Where does it live?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{['Bright window', 'Shaded room', 'Balcony'].map(v => <Chip key={v} label={v} selected={spot === v} onPress={() => setSpot(v)} />)}</View>
      </View>
      <View style={{ gap: space[2] }}>
        <T v="footnote" tone="ink2">How much should it explain?</T>
        <Segmented values={['Guided', 'Concise'] as const} value={detail} onChange={setDetail} labels={{ Guided: 'Walk me through it', Concise: 'Just tell me' }} />
      </View>
    </View>
  </Frame>;
}

/* ---------- C · The specimen plate: fill in the diagram of your plant ---------- */
type Slot = 'plant' | 'light' | 'pot' | 'soil';
const slotChoices: Record<Exclude<Slot, 'plant'>, string[]> = {
  light: ['Bright, indirect', 'Low light', 'Direct sun'],
  pot: ['Drains', 'No drainage hole', 'Self-watering'],
  soil: ['Dry', 'Slightly moist', 'Moist', 'Wet'],
};
function Callout({ side, top, label, value, active, onPress }: { side: 'left' | 'right'; top: number; label: string; value?: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const line = useSharedValue(value ? 1 : 0);
  React.useEffect(() => { line.value = withSpring(value ? 1 : 0, springs.smooth); }, [value]);
  const draw = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));
  return <View style={{ position: 'absolute', top, [side]: 0, width: '50%', flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center' }}>
    <Tap label={value ? `${label}: ${value}. Change` : `Add ${label}`} onPress={onPress} ring={radius.input}
      style={{ width: 118, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.input, borderWidth: 1, borderStyle: value ? 'solid' : 'dashed', borderColor: active ? c.ink : value ? c.hairline : c.ink3, backgroundColor: value ? c.raised : 'transparent', alignItems: side === 'left' ? 'flex-start' : 'flex-end' }}>
      <View style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6 }}>
        <SourceMark kind={label === 'Soil' ? 'observed' : 'told'} />
        <T v="caption" tone="ink2">{label}</T>
      </View>
      <T v={value ? 'headline' : 'footnote'} tone={value ? 'ink' : 'ink3'} lines={1}>{value ?? 'Tap to add'}</T>
    </Tap>
    <Animated.View style={[{ flex: 1, height: 1.5, backgroundColor: c.ink3, transformOrigin: side === 'left' ? 'left' : 'right' }, draw]} />
  </View>;
}
function ProtoC() {
  const { c } = useTheme();
  const [plant, setPlant] = useState<'monstera' | 'pothos' | 'aloe' | null>(null);
  const [values, setValues] = useState<Partial<Record<Slot, string>>>({});
  const [open, setOpen] = useState<Slot>('plant');
  const done = Object.keys(values).length;
  const reveal = useSharedValue(0);
  const pick = (p: 'monstera' | 'pothos' | 'aloe') => { setPlant(p); setValues(v => ({ ...v, plant: p })); reveal.value = withSequence(withTiming(0, { duration: 1 }), withSpring(1, springs.bouncy)); setOpen('light'); };
  const set = (slot: Exclude<Slot, 'plant'>, v: string) => { setValues(x => ({ ...x, [slot]: v })); setOpen(slot === 'light' ? 'pot' : slot === 'pot' ? 'soil' : slot); };
  const colour = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ scale: .9 + .1 * reveal.value }] }));
  return <Frame note={`Concept C · The specimen plate · ${done} of 4 filled`} title={plant ? 'Now fill in what you know.' : 'Which plant is yours?'}>
    <View style={{ height: 330, marginTop: space[4] }}>
      <View style={{ position: 'absolute', left: '50%', marginLeft: -95, top: 20, width: 190, height: 250, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', bottom: -6, width: 150, height: 22, borderRadius: 100, backgroundColor: c.hairline }} />
        {/* Silhouette until a species is chosen, then the illustration settles in. */}
        <Image source={art[plant ?? 'monstera']} resizeMode="contain" tintColor={c.sunken} style={{ position: 'absolute', width: 190, height: 250 }} />
        {plant && <Animated.Image source={art[plant]} resizeMode="contain" style={[{ position: 'absolute', width: 190, height: 250 }, colour]} />}
      </View>
      {plant && <>
        <Callout side="left" top={30} label="Light" value={values.light} active={open === 'light'} onPress={() => setOpen('light')} />
        <Callout side="right" top={110} label="Soil" value={values.soil} active={open === 'soil'} onPress={() => setOpen('soil')} />
        <Callout side="left" top={200} label="Pot" value={values.pot} active={open === 'pot'} onPress={() => setOpen('pot')} />
      </>}
    </View>
    <Glass level="control" r={radius.card} style={{ padding: space[4], gap: space[3], marginTop: 'auto' }}>
      {open === 'plant'
        ? <><T v="headline">Start with the plant</T>
            <View style={{ flexDirection: 'row', gap: space[2] }}>{(['monstera', 'pothos', 'aloe'] as const).map(p => <Chip key={p} label={p === 'aloe' ? 'Aloe' : p === 'pothos' ? 'Pothos' : 'Monstera'} selected={plant === p} onPress={() => pick(p)} />)}</View></>
        : <><T v="headline">{open === 'soil' ? 'Push a finger into the soil. How does it feel?' : open === 'light' ? 'How much light does it get?' : 'What is it planted in?'}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{slotChoices[open].map(v => <Chip key={v} label={v} selected={values[open] === v} onPress={() => set(open, v)} />)}</View>
            {done === 4 && <Btn title="Open my plant" onPress={() => undefined} />}</>}
    </Glass>
  </Frame>;
}

export function Proto({ which }: { which: string }) {
  return which === 'B' ? <ProtoB /> : which === 'C' ? <ProtoC /> : <ProtoA />;
}
export const protoParam = typeof location !== 'undefined' ? /[?&]proto=([ABC])/.exec(location.search)?.[1] : undefined;
