/**
 * App-level states: loading and "can't reach Rootera".
 * Loading is a skeleton in the shape of Today (not a spinner), so the layout does not
 * jump when content arrives and the wait feels shorter. Offline with nothing cached is
 * an honest dead end with a retry, never a silent fall into onboarding.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { Btn, T } from './components';
import { t } from '../i18n';

/** A placeholder block with a slow light sweep. Static under Reduce Motion. */
export function Bone({ w, h, r = 6, style }: { w: number | `${number}%`; h: number; r?: number; style?: object }) {
  const { c, reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !width) return;
    x.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => cancelAnimation(x);
  }, [width, reduceMotion]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -width + x.value * width * 2 }] }));
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[{ width: w, height: h, borderRadius: r, backgroundColor: c.sunken, overflow: 'hidden' }, style]}>
    {!reduceMotion && !!width && <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['transparent', c.raised, 'transparent']} style={{ flex: 1, opacity: .7 }} />
    </Animated.View>}
  </View>;
}

/** Today, before the garden arrives. */
export function TodaySkeleton() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={t("Loading your garden")} accessibilityState={{ busy: true }}
    style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top + 64, paddingHorizontal: space.gutter, gap: space[3] }}>
    <Bone w={150} h={12} />
    <Bone w={230} h={36} r={8} />
    <View style={{ height: space[5] }} />
    <Bone w={110} h={18} />
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.ink3 }}>
      {[0, 1, 2].map(i => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        {/* leaf-shaped avatar: the plant thumbnail will land here */}
        <Bone w={52} h={52} r={0} style={{ borderTopLeftRadius: 26, borderBottomRightRadius: 26, borderTopRightRadius: 6, borderBottomLeftRadius: 6 }} />
        <View style={{ flex: 1, gap: 8 }}><Bone w="55%" h={14} /><Bone w="80%" h={12} /></View>
        <Bone w={92} h={40} r={radius.control} />
      </View>)}
    </View>
  </View>;
}

/** First launch with nothing cached and the server out of reach. */
export function Unreachable({ onRetry }: { onRetry: () => Promise<void> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const retry = async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } };
  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top, paddingBottom: insets.bottom + space[4], paddingHorizontal: space.gutter }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
      <Image source={require('../../assets/flower/0-empty.webp')} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 170, height: 190 }} />
      <T v="title" center accessibilityRole="header">{t("Can’t reach Rootera")}</T>
      <T v="callout" tone="ink2" center style={{ maxWidth: 320 }}>{t("Your garden is kept on the Rootera server, so the first start needs a connection. Check your Wi-Fi or mobile data and try again.")}</T>
    </View>
    <Btn title={t("Try again")} busy={busy} onPress={() => void retry()} />
  </View>;
}
