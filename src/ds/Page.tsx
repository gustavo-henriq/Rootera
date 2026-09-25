/**
 * Page frame. Content scrolls on solid paper; the chrome floats above it:
 * round glass controls at the top, and a glass title capsule that appears once
 * the large title has scrolled away (continuity: the title moves into the bar).
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { Glass, GlassIcon, T } from './components';
import { GlyphName } from './icons';

export interface PageAction { icon: GlyphName; label: string; onPress: () => void }

export function Page({ title, back, close, actions, footer, tab, children, gap = space[6], scrollRef, titleInBar, header }: React.PropsWithChildren<{
  title?: string; back?: () => void; close?: () => void; actions?: PageAction[]; footer?: React.ReactNode; tab?: boolean; gap?: number;
  scrollRef?: React.RefObject<ScrollView | null>; titleInBar?: string; header?: React.ReactNode;
}>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { y.value = e.contentOffset.y; });
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [24, 64], [0, 1], 'clamp'), transform: [{ translateY: interpolate(y.value, [24, 64], [6, 0], 'clamp') }] }));
  const hasBar = !!(back || close || actions?.length || titleInBar || title);
  const top = insets.top + (hasBar ? 60 : space[4]);
  const barTitle = titleInBar ?? title;

  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Animated.ScrollView ref={scrollRef as any} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: (tab ? 110 : space[8]) + (footer ? 0 : insets.bottom), gap, flexGrow: 1 }}>
        {header}
        {!!title && <T v="largeTitle">{title}</T>}
        {children}
      </Animated.ScrollView>
      {footer && <View style={{ paddingHorizontal: space.gutter, paddingTop: space[3], paddingBottom: insets.bottom + space[3], gap: space[2], backgroundColor: c.canvas, borderTopWidth: 1, borderColor: c.hairline }}>{footer}</View>}
    </KeyboardAvoidingView>

    {hasBar && <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: space.gutter - 4, right: space.gutter - 4, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ minWidth: 44 }}>{back ? <GlassIcon name="back" label="Go back" onPress={back} /> : close ? <GlassIcon name="close" label="Close" onPress={close} /> : null}</View>
      {!!barTitle && <Animated.View pointerEvents="none" style={[{ flexShrink: 1, marginHorizontal: space[2] }, bar]}>
        <Glass level="chrome" r={radius.pill} style={{ paddingHorizontal: space[4], height: 40, justifyContent: 'center' }}>
          <T v="headline" lines={1}>{barTitle}</T>
        </Glass>
      </Animated.View>}
      <View style={{ minWidth: 44, flexDirection: 'row', gap: space[2], justifyContent: 'flex-end' }}>
        {actions?.map(a => <GlassIcon key={a.label} name={a.icon} label={a.label} onPress={a.onPress} />)}
      </View>
    </View>}
  </View>;
}
