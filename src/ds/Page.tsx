/**
 * Page frame. Content scrolls on solid paper; the chrome floats above it:
 * round glass controls at the top, and a glass title capsule that appears once
 * the large title has scrolled away (continuity: the title moves into the bar).
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn, interpolate, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { Glass, GlassIcon, T } from './components';
import { GlyphName } from './icons';

export interface PageAction { icon: GlyphName; label: string; onPress: () => void }

/**
 * Long content as a virtualized list: only the rows on screen are rendered, so a garden of
 * hundreds of plants scrolls like one of five. Everything passed as children becomes the
 * list header; `footer` sits after the last row.
 */
export interface PageList<T> {
  data: T[]; renderItem: (item: T, index: number) => React.ReactElement | null; keyExtractor: (item: T) => string;
  onEndReached?: () => void; footer?: React.ReactNode; numColumns?: number; columnGap?: number; rowGap?: number;
}

export function Page({ title, back, close, actions, footer, tab, children, gap = space[6], scrollRef, titleInBar, header, list, glow, onRefresh }: React.PropsWithChildren<{
  title?: string; back?: () => void; close?: () => void; actions?: PageAction[]; footer?: React.ReactNode; tab?: boolean; gap?: number;
  scrollRef?: React.RefObject<any>; titleInBar?: string; header?: React.ReactNode; list?: PageList<any>;
  /** A soft wash of colour behind the top of the page (Today uses the light of the day). */
  glow?: string;
  /** Pull to refresh (list pages). */
  onRefresh?: () => Promise<void>;
}>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const pull = onRefresh ? async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } } : undefined;
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { y.value = e.contentOffset.y; });
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [24, 64], [0, 1], 'clamp'), transform: [{ translateY: interpolate(y.value, [24, 64], [6, 0], 'clamp') }] }));
  const hasBar = !!(back || close || actions?.length || titleInBar || title);
  const top = insets.top + (hasBar ? 60 : space[4]);
  const barTitle = titleInBar ?? title;

  // The floating bar comes first in the tree so keyboard and screen-reader order start at
  // the top of the screen (back, then actions), and zIndex keeps it painted above content.
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    {!!glow && <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(900)} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}>
      <LinearGradient colors={[glow, 'transparent']} style={{ flex: 1 }} />
    </Animated.View>}
    {hasBar && <View pointerEvents="box-none" style={{ position: 'absolute', zIndex: 10, top: insets.top + 6, left: space.gutter - 4, right: space.gutter - 4, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {list
        ? <Animated.FlatList ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            data={list.data} keyExtractor={list.keyExtractor} renderItem={({ item, index }: { item: any; index: number }) => list.renderItem(item, index)}
            numColumns={list.numColumns} key={list.numColumns ?? 1}
            itemLayoutAnimation={reduceMotion ? undefined : LinearTransition.springify().damping(26).stiffness(190)}
            columnWrapperStyle={list.numColumns && list.numColumns > 1 ? { gap: list.columnGap ?? space[3] } : undefined}
            onEndReached={list.onEndReached} onEndReachedThreshold={.6}
            refreshControl={pull ? <RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={c.leafMark} colors={[c.leafMark]} progressViewOffset={top} /> : undefined}
            initialNumToRender={12} maxToRenderPerBatch={12} windowSize={9} removeClippedSubviews={Platform.OS === 'android'}
            ListHeaderComponent={<View style={{ gap, marginBottom: gap }}>{header}{!!title && <T v="largeTitle">{title}</T>}{children}</View>}
            ListFooterComponent={list.footer ? <View style={{ marginTop: gap }}>{list.footer}</View> : null}
            contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: (tab ? 110 : space[8]) + (footer ? 0 : insets.bottom), gap: list.rowGap ?? 0, flexGrow: 1 }} />
        : <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.gutter, paddingBottom: (tab ? 110 : space[8]) + (footer ? 0 : insets.bottom), gap, flexGrow: 1 }}>
            {header}
            {!!title && <T v="largeTitle">{title}</T>}
            {children}
          </Animated.ScrollView>}
      {footer && <View style={{ paddingHorizontal: space.gutter, paddingTop: space[3], paddingBottom: insets.bottom + space[3], gap: space[2], backgroundColor: c.canvas, borderTopWidth: 1, borderColor: c.hairline }}>{footer}</View>}
    </KeyboardAvoidingView>

  </View>;
}
