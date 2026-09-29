/**
 * "Why this suggestion?": the three sources from onboarding, lit for the ones this
 * suggestion actually used, each with the records behind it, joined into the suggestion.
 * The same picture people learned on day one, so explanations always look the same.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { fonts, radius, space } from './tokens';
import { Source, SourceMark, T, Tap } from './components';
import { Glyph } from './icons';
import { t } from '../i18n';

const GROUPS: { kind: Source; title: string; match: RegExp; empty: string }[] = [
  { kind: 'observed', title: 'You observed', match: /soil check|watering|appearance|care history/i, empty: 'Nothing you recorded was used for this one.' },
  { kind: 'told', title: 'You told us', match: /pot details|plant context/i, empty: 'Light, pot and drainage were not part of this one.' },
  { kind: 'species', title: 'Species notes', match: /species/i, empty: 'Species notes were not needed here.' },
];

export function WhySheet({ visible, onClose, title, reason, basis }: { visible: boolean; onClose: () => void; title: string; reason: string; basis: string[] }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close")} onPress={onClose} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View accessibilityViewIsModal entering={reduceMotion ? undefined : SlideInDown.springify().damping(26).stiffness(260)}
        style={{ width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: c.raised, borderTopLeftRadius: radius.chrome, borderTopRightRadius: radius.chrome }}>
        <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + space[6], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
            <T v="title2" style={{ flex: 1 }} accessibilityRole="header">{t("Why Rootera suggests this")}</T>
            <Tap label={t("Close")} onPress={onClose} ring={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8 }}><Glyph name="close" size={18} /></Tap>
          </View>
          <View style={{ gap: 0 }}>
            {GROUPS.map((gr, i) => {
              const used = basis.filter(b => gr.match.test(b));
              const on = used.length > 0;
              return <Animated.View key={gr.kind} entering={reduceMotion ? undefined : FadeInDown.delay(80 + i * 90).duration(260)}
                style={{ flexDirection: 'row', gap: space[3], opacity: on ? 1 : .55 }}>
                {/* the rail joins every used source down into the suggestion */}
                <View style={{ alignItems: 'center', width: 18 }}>
                  <View style={{ marginTop: 6 }}><SourceMark kind={gr.kind} size={10} /></View>
                  <View style={{ flex: 1, width: 1.5, marginTop: 4, backgroundColor: on ? c.ink2 : c.hairline }} />
                </View>
                <View style={{ flex: 1, gap: 2, paddingBottom: space[4] }}>
                  <T v="headline">{t(gr.title)}{on ? '' : t(', not used')}</T>
                  <T v="subhead" tone="ink2">{on ? used.map(b => t(b)).join(', ') : t(gr.empty)}</T>
                </View>
              </Animated.View>;
            })}
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(380).duration(280)}
              style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ width: 18, alignItems: 'center' }}><View style={{ marginTop: 6 }}><SourceMark kind="suggested" size={10} /></View></View>
              <View style={{ flex: 1, gap: space[1], padding: space[3], borderRadius: radius.control, backgroundColor: c.successSoft }}>
                <T v="footnote" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Rootera suggests")}</T>
                <T v="headline">{title}</T>
                <T v="subhead" tone="ink2">{reason}</T>
              </View>
            </Animated.View>
          </View>
          <T v="footnote" tone="ink2">{t("These sources never mix. Each suggestion says which it used.")}</T>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
