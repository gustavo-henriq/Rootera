/**
 * The payoff right after planting: what Rootera now knows about this plant and its
 * first real suggestion, built from the answers just given. Seeing the plan made from
 * your own answers is what makes the setup feel worth it (the "personal plan" moment).
 * Everything shown is either what the person said, or the Twin's suggestion with its basis.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PlantKind, Twin } from '../../model';
import { useTheme } from '../../ds/theme';
import { radius, space } from '../../ds/tokens';
import { Btn, SourceLabel, SourceMark, T } from '../../ds/components';
import { Ground, PlantArt } from '../../ds/plant';

export interface KnownRow { label: string; value: string; source: 'told' | 'observed' }

export function PlanReveal({ kind, name, photo, rows, twin, onContinue }: { kind: PlantKind; name: string; photo?: string; rows: KnownRow[]; twin?: Twin; onContinue: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const g = twin?.guidance;
  const enter = (i: number) => reduceMotion ? undefined : FadeInDown.delay(150 + i * 110).duration(420);
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + space[6], paddingHorizontal: space.gutter, paddingBottom: space[6], gap: space[5] }}>
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <T v="footnote" tone="ink2">Your plan</T>
          <T v="hero">What Rootera knows about your {name}</T>
        </View>
        <View style={{ alignItems: 'center' }}>
          <PlantArt kind={kind} photo={photo} size={96} />
          <Ground width={80} style={{ marginTop: -10 }} />
        </View>
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
        {rows.map(r => <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <SourceMark kind={r.source} />
          <T v="body" tone="ink2" style={{ width: 110 }}>{r.label}</T>
          <T v="body" style={{ flex: 1, textAlign: 'right' }} tone={r.value === 'Not sure yet' ? 'ink2' : 'ink'}>{r.value}</T>
        </View>)}
      </Animated.View>

      <Animated.View entering={enter(2)} style={{ padding: space[4], gap: space[2], borderRadius: radius.card, backgroundColor: c.successSoft }}>
        <SourceLabel kind="suggested" />
        <T v="title2">{g?.title ?? 'Start with a soil check'}</T>
        <T v="body" tone="ink2">{g?.reason ?? 'A first soil check tells Rootera where this plant is starting from. Every later check is compared with it.'}</T>
        {!!g?.basis?.length && <T v="footnote" tone="ink2">From: {g.basis.join(', ').toLowerCase()}.</T>}
      </Animated.View>

      {!!g?.reference.summary && <Animated.View entering={enter(3)} style={{ gap: space[1] }}>
        <SourceLabel kind="species" />
        <T v="body" tone="ink2">{g.reference.summary}</T>
      </Animated.View>}

      <Animated.View entering={enter(4)}>
        <T v="subhead" tone="ink2">Every check you add makes this more about your plant and less about the species in general.</T>
      </Animated.View>
    </ScrollView>
    <Animated.View entering={enter(5)} style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space[4], paddingTop: space[3], backgroundColor: c.canvas }}>
      <LinearGradient pointerEvents="none" colors={['transparent', c.canvas]} style={{ position: 'absolute', left: 0, right: 0, top: -28, height: 28 }} />
      <Btn title="Continue" onPress={onContinue} />
    </Animated.View>
  </View>;
}
