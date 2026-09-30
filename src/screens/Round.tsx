/**
 * The check-in round: every plant that needs you, one card at a time, one tap each.
 * Built for people with many plants: one card per plant, the same three-layer check every
 * time. Dry (at the species' depth) asks one follow-up (watered?); everything else moves on.
 * The list is frozen when the round starts so cards never shuffle under your finger, and
 * the last card can always be undone.
 */
import { useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Props } from '../navigation';
import { useStore } from '../store';
import { byUrgency, newId, Plant, Soil, SoilLayers, summarizeLayers } from '../model';
import { layersComplete, SoilLayersInput } from '../ds/SoilLayers';
import { useTheme } from '../ds/theme';
import { fonts, motion, radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph } from '../ds/icons';
import { Ground, PlantArt } from '../ds/plant';
import { enter, LeafBurst } from '../ds/motion';
import { haptic } from '../ds/feedback';
import { t, tn } from '../i18n';

/** A round is a few minutes, not an hour: the most urgent plants first, then "next" if you want more. */
export const ROUND_SIZE = 20;
type Done = { plantId: string; ids: string[]; soil: Soil | 'skip'; watered: boolean };

export function Round({ navigation }: Props<'Round'>) {
  const { garden, logCare, removeCare } = useStore();
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  // Frozen at the start: guidance changes as you record, but the round keeps its order.
  const [queue, setQueue] = useState<Plant[]>(() => byUrgency(garden).filter(p => garden.twins[p.id]?.guidance.action !== 'wait').slice(0, ROUND_SIZE));
  const seen = useRef(new Set(queue.map(p => p.id)));
  // Plants that still need you after this round (for "Next 20").
  const remaining = byUrgency(garden).filter(p => garden.twins[p.id]?.guidance.action !== 'wait' && !seen.current.has(p.id));
  const nextRound = () => {
    const more = remaining.slice(0, ROUND_SIZE);
    more.forEach(p => seen.current.add(p.id));
    setQueue(more); setI(0); setDone([]);
  };
  const [i, setI] = useState(0);
  const [askWater, setAskWater] = useState(false);
  const [layers, setLayers] = useState<Partial<SoilLayers>>({});
  const [done, setDone] = useState<Done[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ soilId: string; at: string } | null>(null);
  const plant = queue[i];
  const g = plant ? garden.twins[plant.id]?.guidance : undefined;
  const finished = i >= queue.length;

  const next = (entry: Done) => { setDone(d => [...d, entry]); setAskWater(false); setLayers({}); pending.current = null; setI(n => n + 1); };

  const answer = async (l: SoilLayers) => {
    if (busy || !plant) return;
    setBusy(true); setError('');
    const soilId = newId('care'), at = new Date().toISOString();
    const soil = summarizeLayers(l, plant.kind === 'other' ? 'unknown' : g?.reference.dryness);
    try {
      await logCare({ id: soilId, plantId: plant.id, type: 'Soil check', layers: l, note: '', at, source: 'USER' });
      haptic.success();
      if (soil === 'dry') { pending.current = { soilId, at }; setAskWater(true); }
      else next({ plantId: plant.id, ids: [soilId], soil, watered: false });
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };

  const watered = async (yes: boolean) => {
    if (busy || !plant || !pending.current) return;
    const { soilId, at } = pending.current;
    if (!yes) { next({ plantId: plant.id, ids: [soilId], soil: 'dry', watered: false }); return; }
    setBusy(true); setError('');
    const waterId = newId('water');
    try {
      await logCare({ id: waterId, plantId: plant.id, type: 'Watered', note: '', at: new Date(new Date(at).getTime() + 1000).toISOString(), source: 'USER' });
      next({ plantId: plant.id, ids: [soilId, waterId], soil: 'dry', watered: true });
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not save.')); }
    finally { setBusy(false); }
  };

  const skip = () => { haptic.select(); next({ plantId: plant!.id, ids: [], soil: 'skip', watered: false }); };

  const undo = async () => {
    const last = done[done.length - 1];
    if (!last || busy) return;
    setBusy(true); setError('');
    try {
      for (const id of [...last.ids].reverse()) await removeCare(last.plantId, id);
      setDone(d => d.slice(0, -1)); setAskWater(false); pending.current = null; setI(n => n - 1);
    } catch (e) { setError(e instanceof Error ? e.message : t('Could not undo.')); }
    finally { setBusy(false); }
  };

  const checked = done.filter(d => d.soil !== 'skip').length;
  const wateredCount = done.filter(d => d.watered).length;
  const nextCount = Math.min(ROUND_SIZE, remaining.length);
  const progress = queue.length ? Math.min(i, queue.length) / queue.length : 1;

  return <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top + space[2], paddingBottom: insets.bottom + space[4], paddingHorizontal: space.gutter }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
      <Tap label={t("End the round")} onPress={() => navigation.goBack()} ring={22} style={{ width: 44, height: 44, justifyContent: 'center' }}><Glyph name="close" size={20} /></Tap>
      <T v="subhead" tone="ink2" accessibilityLabel={t('Plant {i} of {n}', { i: Math.min(i + 1, queue.length), n: queue.length })} style={{ fontVariant: ['tabular-nums'] }}>{finished ? t('Done') : t('{i} of {n}', { i: i + 1, n: queue.length })}</T>
      <View style={{ width: 44 }}>
        {!!done.length && !finished && <Tap label={t("Undo the last plant")} onPress={() => void undo()} ring={radius.inner} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}><T v="subhead" tone="leafText" style={{ fontFamily: fonts.medium }}>{t("Undo")}</T></Tap>}
      </View>
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 3, borderRadius: 2, backgroundColor: c.sunken, overflow: 'hidden' }}>
      <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: c.leafMark }} />
    </View>

    {!!error && <View style={{ marginTop: space[3] }}><Toast tone="error" title={t("Not saved")} text={error} onClose={() => setError('')} /></View>}

    {finished
      ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
          <LeafBurst run={checked ? 1 : 0} />
          <Animated.View entering={reduceMotion ? undefined : enter.pop()}><Glyph name="check" size={44} tone={c.leafText} /></Animated.View>
          <T v="hero" center accessibilityRole="header">{queue.length ? t('Round done') : t('Nothing needs you')}</T>
          <T v="callout" tone="ink2" center>{queue.length
            ? `${tn(checked, '{n} plant checked', '{n} plants checked')}${wateredCount ? t(', {n} watered', { n: wateredCount }) : ''}. ${t('Rootera updated each plant’s next step.')}`
            : t('Every plant is resting.')}</T>
        </View>
      : <Animated.View key={plant.id + (askWater ? '-w' : '')} entering={reduceMotion ? undefined : askWater ? enter.fade() : SlideInRight.springify().damping(24).stiffness(220)} exiting={reduceMotion ? undefined : SlideOutLeft.duration(motion.dur.fast)}
          style={{ flex: 1, justifyContent: 'center', gap: space[4] }}>
          <View style={{ alignItems: 'center' }}>
            <PlantArt kind={plant.kind} photo={plant.photo} size={180} />
            <Ground width={150} style={{ marginTop: -14 }} />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <T v="title" center lines={2} fit>{plant.name}</T>
            <T v="subhead" tone="ink2" center lines={2}>{g?.title ?? t('Start with a soil check')}</T>
          </View>
          {askWater
            ? <Animated.View entering={reduceMotion ? undefined : enter.rise()} style={{ gap: space[3] }}>
                <T v="headline" center>{t("Dry at its depth. Did you water it?")}</T>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <Btn title={t("Yes, watered")} icon="water" busy={busy} onPress={() => void watered(true)} style={{ flex: 1 }} />
                  <Btn title={t("Not now")} kind="outline" onPress={() => void watered(false)} style={{ flex: 1 }} />
                </View>
              </Animated.View>
            : <View style={{ gap: space[3] }}>
                <T v="headline" center>{t("How does the soil feel?")}</T>
                <SoilLayersInput value={layers} onChange={setLayers} />
                {layersComplete(layers) && <Btn title={t('Save check')} busy={busy} onPress={() => void answer(layers as SoilLayers)} />}
                <Tap label={t("Skip this plant")} onPress={skip} ring={radius.inner} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}><T v="subhead" tone="ink2">{t("Skip")}</T></Tap>
              </View>}
        </Animated.View>}

    {finished && <View style={{ gap: space[2] }}>
      {remaining.length > 0 && <Btn title={tn(nextCount, 'Next plant', 'Next {n} plants')} onPress={nextRound} />}
      <Btn title={t("Back to Today")} kind={remaining.length ? 'outline' : 'filled'} onPress={() => navigation.goBack()} />
    </View>}
  </View>;
}
