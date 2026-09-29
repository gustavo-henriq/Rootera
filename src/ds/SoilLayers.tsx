/**
 * The soil check in three layers: the surface, the middle and the bottom of the pot, each
 * dry, moist or wet. One layer is asked at a time; the hand goes down to it and each answer
 * is painted into the pot, so the drawing ends up as the pot's moisture profile.
 *
 * The bottom needs a wooden skewer or a look through the drainage hole. The skewer is a
 * suggestion, never a requirement: "Couldn't reach" is a valid answer (the backend then
 * never calls a plant that dries through "dry" on that check alone).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Layer, LayerKey, SoilLayers, layerLabel } from '../model';
import { useTheme } from './theme';
import { fonts, radius, space } from './tokens';
import { Chip, T, Tap } from './components';
import { DepthRuler } from './DepthRuler';
import { haptic } from './feedback';
import { t } from '../i18n';

export const LAYER_KEYS: LayerKey[] = ['top', 'middle', 'bottom'];
const INFO: Record<LayerKey, { name: string; how: string; at: number }> = {
  top: { name: 'Surface', how: 'Touch the soil with a fingertip.', at: .1 },
  middle: { name: 'Middle', how: 'Push a finger in, about 5 cm.', at: .5 },
  bottom: { name: 'Bottom', how: 'A wooden skewer to the bottom helps, or look through the drainage hole.', at: .9 },
};
const HINT: Record<Layer | 'unreached', string> = {
  dry: 'Crumbly, no coolness',
  moist: 'Cool, some soil sticks',
  wet: 'Soggy or muddy',
  unreached: 'That’s fine. The next check can go deeper.',
};

export const layersComplete = (v: Partial<SoilLayers>): v is SoilLayers => LAYER_KEYS.every(k => !!v[k]);

export function SoilLayersInput({ value, onChange }: { value: Partial<SoilLayers>; onChange: (v: Partial<SoilLayers>) => void }) {
  const { c } = useTheme();
  const [editing, setEditing] = useState<LayerKey | null>(null);
  const next = LAYER_KEYS.find(k => !value[k]) ?? null;
  const focus = editing ?? next;
  const shown = LAYER_KEYS.filter(k => !!value[k] || k === focus);
  const pick = (k: LayerKey, v: SoilLayers[LayerKey]) => { haptic.select(); onChange({ ...value, [k]: v }); setEditing(null); };

  return <View style={{ gap: space[4] }}>
    <DepthRuler depth={INFO[focus ?? 'bottom'].at} heading={focus ? t(INFO[focus].name) : t('All three layers checked')}
      label={focus ? t(INFO[focus].how) : t('Tap a layer to change it.')}
      bands={[value.top, value.middle, value.bottom]} />
    <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
      {shown.map(k => {
        const open = k === focus;
        const v = value[k];
        const options = (k === 'bottom' ? ['dry', 'moist', 'wet', 'unreached'] : ['dry', 'moist', 'wet']) as SoilLayers[LayerKey][];
        return <Animated.View key={k} entering={FadeIn.duration(220)} style={{ paddingVertical: space[3], gap: space[2], borderBottomWidth: 1, borderColor: c.hairline }}>
          {open
            ? <>
                <T v="headline">{t(INFO[k].name)}</T>
                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {options.map(o => <Chip key={o} label={layerLabel[o]} selected={v === o} onPress={() => pick(k, o)} />)}
                </View>
                {!!v && <T v="footnote" tone="ink2">{t(HINT[v])}</T>}
              </>
            : <Tap label={`${t(INFO[k].name)}: ${layerLabel[v!]}. ${t('Change')}`} onPress={() => setEditing(k)} ring={radius.inner}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
                <T v="body">{t(INFO[k].name)}</T>
                <T v="body" style={{ fontFamily: fonts.medium }}>{layerLabel[v!]}</T>
              </Tap>}
        </Animated.View>;
      })}
    </View>
  </View>;
}
