/**
 * A plant leaving the garden: it died, was given away, or was left behind (a move, a trip).
 * The person says which, and gets a word that fits. When a plant dies, the words are there
 * to reassure: plants die even with attentive care, and nothing recorded is lost. No
 * "what went wrong", no sad faces, no celebration. The history is always kept.
 *
 * The plant is removed only when the person leaves this screen, so the words stay with them
 * (and the plant page behind does not change under it).
 */
import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plant } from '../model';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { Ground, PlantArt } from '../ds/plant';
import { t } from '../i18n';

export type Farewell = 'died' | 'given' | 'left' | 'removed';

const CHOICES: { key: Farewell; label: string; hint?: string }[] = [
  { key: 'died', label: 'It died' },
  { key: 'given', label: 'I gave it away' },
  { key: 'left', label: 'I left it behind', hint: 'A move, a trip, a change of home.' },
  { key: 'removed', label: 'Just remove it' },
];

const WORDS: Record<Exclude<Farewell, 'removed'>, { title: string; body: string }> = {
  died: {
    title: 'I’m sorry about your {name}.',
    body: 'Plants die even with careful, attentive care. It says nothing bad about you. Everything you recorded is kept, and it helps the next plant.',
  },
  given: {
    title: '{name} gets to keep growing.',
    body: 'A plant passed on is a plant that goes on. Its history stays here.',
  },
  left: {
    title: 'Sometimes life changes places.',
    body: '{name} stays in your history, with everything you recorded.',
  },
};

export function FarewellSheet({ plant, visible, onClose, onConfirm }: { plant: Plant; visible: boolean; onClose: () => void; onConfirm: (reason: Farewell) => Promise<void> }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<Farewell | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!visible) return null;

  const leave = async (r: Farewell) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onConfirm(r); }
    catch (e) { setError(e instanceof Error ? e.message : t('Could not remove.')); setBusy(false); }
  };
  const pick = (r: Farewell) => { if (r === 'removed') void leave(r); else setReason(r); };
  const close = () => { if (busy) return; setReason(null); onClose(); };
  const words = reason && reason !== 'removed' ? WORDS[reason] : null;

  return <Modal visible animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close} statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top + space[2], paddingBottom: insets.bottom + space[4], paddingHorizontal: space.gutter }}>
      {!words && <Tap label={t('Cancel')} onPress={close} ring={22} style={{ width: 44, height: 44, justifyContent: 'center' }}><Glyph name="close" size={20} /></Tap>}
      {!words
        ? <ScrollView contentContainerStyle={{ gap: space[5], paddingTop: space[4] }}>
            <View style={{ gap: space[2] }}>
              <T v="hero" accessibilityRole="header">{t('{name} is leaving your garden?', { name: plant.name })}</T>
              <T v="callout" tone="ink2">{t('Tell Rootera what happened. Its history is kept either way.')}</T>
            </View>
            <View accessibilityRole="radiogroup" style={{ borderTopWidth: 1, borderColor: c.leafMark }}>
              {CHOICES.map(o => <Tap key={o.key} role="radio" label={o.hint ? `${t(o.label)}. ${t(o.hint)}` : t(o.label)} onPress={() => pick(o.key)} scaleTo={.99} ring={radius.inner}
                style={{ minHeight: 58, justifyContent: 'center', paddingVertical: space[3], borderBottomWidth: 1, borderColor: c.leafMark }}>
                <T v="body">{t(o.label)}</T>
                {!!o.hint && <T v="footnote" tone="ink2">{t(o.hint)}</T>}
              </Tap>)}
            </View>
            {!!error && <Toast tone="error" title={t('Not saved')} text={error} onClose={() => setError('')} />}
          </ScrollView>
        : <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(500)} style={{ flex: 1, justifyContent: 'center', gap: space[6] }}>
            <View style={{ alignItems: 'center' }}>
              {/* The plant as it was, quiet: no motion, a little softer when it died. */}
              <View style={{ opacity: reason === 'died' ? .75 : 1 }}><PlantArt kind={plant.kind} photo={plant.photo} size={180} /></View>
              <Ground width={150} style={{ marginTop: -14 }} />
            </View>
            <View style={{ gap: space[3] }}>
              <T v="hero" center accessibilityRole="header">{t(words.title, { name: plant.name })}</T>
              <T v="callout" tone="ink2" center>{t(words.body, { name: plant.name })}</T>
            </View>
            {!!error && <Toast tone="error" title={t('Not saved')} text={error} onClose={() => setError('')} />}
            <View style={{ gap: space[2] }}>
              <Btn title={t('Back to my garden')} busy={busy} onPress={() => void leave(reason!)} />
              <Btn kind="plain" title={t('Cancel')} onPress={close} style={{ alignSelf: 'center' }} />
            </View>
          </Animated.View>}
    </View>
  </Modal>;
}
