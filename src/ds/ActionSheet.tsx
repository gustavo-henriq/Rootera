/**
 * A list of actions for one thing (a plant's options). On iOS this is the system action
 * sheet: familiar, accessible and dismissible by design. Elsewhere it is a bottom sheet
 * over a scrim, with its own focus scope (Modal), Escape and back to close, and a Cancel row.
 */
import React, { useEffect } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { T, Tap } from './components';
import { Glyph, GlyphName } from './icons';
import { haptic } from './feedback';
import { t } from '../i18n';

export interface SheetAction { label: string; icon: GlyphName; onPress: () => void; destructive?: boolean }

export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: SheetAction[]; onClose: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'ios') {
      haptic.tap();
      ActionSheetIOS.showActionSheetWithOptions({
        title, options: [...actions.map(a => a.label), t('Cancel')], cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex(a => a.destructive),
      }, i => { onClose(); actions[i]?.onPress(); });
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }
  }, [visible]);

  if (Platform.OS === 'ios' || !visible) return null;
  return <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close")} onPress={onClose} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)} exiting={SlideOutDown.duration(160)}
        style={{ width: '100%', maxWidth: 440, backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome, paddingTop: space[2], paddingBottom: insets.bottom + space[3], paddingHorizontal: space[3] }}>
        {!!title && <T v="footnote" tone="ink2" center style={{ paddingVertical: space[2] }}>{title}</T>}
        {actions.map(a => <Tap key={a.label} label={a.label} onPress={() => { onClose(); a.onPress(); }} ring={radius.control}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingHorizontal: space[3] }}>
          <Glyph name={a.icon} size={20} tone={a.destructive ? c.danger : c.ink} /><T v="body" tone={a.destructive ? 'danger' : 'ink'}>{a.label}</T>
        </Tap>)}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginVertical: space[1] }} />
        <Tap label={t("Cancel")} onPress={onClose} ring={radius.control} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <T v="headline">{t("Cancel")}</T>
        </Tap>
      </Animated.View>
    </View>
  </Modal>;
}
