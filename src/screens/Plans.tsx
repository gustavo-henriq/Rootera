import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { billingEnabled, loadOffers, Offer, purchase, restore } from '../billing';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, plantArt } from '../ds/plant';
import { LeafBurst, Pop, Stagger } from '../ds/motion';

const heads = {
  first: { title: 'Room to grow', text: 'Rootera Free keeps up to 3 plants. Rootera+ is for a growing collection.' },
  limit: { title: 'Make room for more plants', text: 'Your free shelf holds 3 plants. Rootera+ removes the limit.' },
  rooms: { title: 'Organize plants by room', text: 'Group plants by living room, kitchen or balcony, and filter your shelf.' },
  default: { title: 'Rootera+', text: 'For people whose plant collection keeps growing.' },
};
const benefits: { icon: GlyphName; title: string; text: string }[] = [
  { icon: 'infinite', title: 'Unlimited plants', text: 'Free keeps 3 at a time.' },
  { icon: 'rooms', title: 'Rooms', text: 'Group plants by where they live and filter your shelf.' },
  { icon: 'spark', title: 'The same honest guidance', text: 'Every plan learns from your records the same way.' },
];
// Only when no store is connected, so the preview can still be walked through.
const previewPrices = { monthly: 'R$ 12,90 a month', annual: 'R$ 89,90 a year' };

function Shelf() {
  return <View style={{ alignItems: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {(['zz', 'monstera', 'pothos'] as const).map((k, i) => <Pop key={k} delay={[120, 0, 240][i]}><Image source={plantArt[k]} resizeMode="contain" style={{ width: i === 1 ? 120 : 86, height: i === 1 ? 120 : 86, marginHorizontal: -6 }} /></Pop>)}
    </View>
    <Ground width={180} style={{ marginTop: -14 }} />
  </View>;
}

export function Plans({ navigation, route }: Props<'Plans'>) {
  const { garden, setDemoPlan, syncBilling } = useStore();
  const { c } = useTheme();
  const reason = route.params?.reason ?? 'default';
  const head = heads[reason];
  const [period, setPeriod] = useState<'annual' | 'monthly'>('annual');
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [loading, setLoading] = useState(billingEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const plus = garden.plan === 'Plus';

  useEffect(() => {
    if (!billingEnabled || !garden.user_id) return;
    loadOffers(garden.user_id).then(setOffers).catch(() => setError('The store didn’t respond. Check your connection and try again.')).finally(() => setLoading(false));
  }, [garden.user_id]);

  const offer = offers?.find(o => o.period === period);
  const price = billingEnabled ? offer?.price : previewPrices[period];

  const buy = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (billingEnabled) {
        if (!offer) throw new Error('This plan isn’t available in the store yet.');
        if (!(await purchase(offer))) return;
        try { await syncBilling(); }
        catch (e) {
          if (e instanceof ApiError && e.status === 503) throw new Error('Purchase complete, but the Rootera server can’t confirm it yet. It will update once the server’s RevenueCat key is set.');
          throw e;
        }
      } else await setDemoPlan('Plus', period === 'annual');
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };
  const doRestore = async () => {
    setBusy(true); setError('');
    try { await restore(garden.user_id); await syncBilling(); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nothing to restore.'); }
    finally { setBusy(false); }
  };

  if (done || plus) {
    return <Page close={navigation.goBack} footer={<>
      <Btn title="Continue" onPress={navigation.goBack} />
      {plus && !done && garden.plan_source === 'demo' && garden.integrations.demo && <Btn kind="plain" title="Switch the preview back to Free" onPress={() => void setDemoPlan('Free', false)} style={{ alignSelf: 'center' }} />}
    </>}>
      <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[8] }}>
        <View><Shelf /><LeafBurst run={done ? 1 : 0} /></View>
        <T v="hero" center>{done ? 'Rootera+ is on' : 'You’re on Rootera+'}</T>
        <T v="callout" tone="ink2" center>Unlimited plants and rooms are ready.{garden.plan_source === 'demo' || (!billingEnabled && done) ? ' This is a preview activation, so no payment was taken.' : ''}</T>
      </View>
    </Page>;
  }

  return <Page close={navigation.goBack} gap={space[6]}
    footer={<>
      {!!error && <Toast tone="error" title="Not completed" text={error} onClose={() => setError('')} />}
      <Btn title={billingEnabled ? `Continue, ${price ?? '…'}` : 'Activate the preview, no charge'} busy={busy || loading} disabled={billingEnabled ? !offer : !garden.integrations.demo} onPress={() => void buy()} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[6] }}>
        <Btn kind="plain" size="regular" title="Not now" onPress={navigation.goBack} />
        {billingEnabled && <Btn kind="plain" size="regular" title="Restore purchases" onPress={() => void doRestore()} />}
      </View>
    </>}>
    <Shelf />
    <View style={{ gap: space[2] }}>
      <T v="hero">{head.title}</T>
      <T v="callout" tone="ink2">{head.text}</T>
    </View>
    <View style={{ gap: space[4] }}>
      {benefits.map((b, i) => <Stagger key={b.title} index={i + 1} style={{ flexDirection: 'row', gap: space[3] }}>
        <Glyph name={b.icon} size={22} tone={c.leafText} />
        <View style={{ flex: 1 }}><T v="headline">{b.title}</T><T v="subhead" tone="ink2">{b.text}</T></View>
      </Stagger>)}
    </View>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[3] }}>
      {(['annual', 'monthly'] as const).map(p => {
        const on = p === period;
        const label = billingEnabled ? offers?.find(o => o.period === p)?.price ?? (loading ? '…' : 'Unavailable') : previewPrices[p];
        return <Tap key={p} role="radio" selected={on} label={`${p === 'annual' ? 'Yearly' : 'Monthly'}, ${label}`} onPress={() => setPeriod(p)} ring={radius.control}
          style={{ flex: 1, padding: space[4], borderRadius: radius.control, borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c.hairline, backgroundColor: on ? c.raised : 'transparent', gap: 4 }}>
          <T v="footnote" tone="ink2" style={{ fontFamily: fonts.medium }}>{p === 'annual' ? 'Yearly' : 'Monthly'}</T>
          <T v="headline">{label}</T>
        </Tap>;
      })}
    </View>
    <T v="footnote" tone="ink2">{billingEnabled ? 'Billed through your App Store or Google Play account. Cancel any time in your store settings.' : 'Store payments aren’t connected in this preview. Prices are examples; the App Store or Google Play sets the real ones.'}</T>
  </Page>;
}
