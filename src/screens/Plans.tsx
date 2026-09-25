import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { billingEnabled, loadOffers, Offer, purchase, restore } from '../billing';
import { color, radius, space } from '../theme';
import { Banner, Button, GroundShadow, Icon, IconButton, IconName, PlantArt, Press, Screen, Txt } from '../ui';
import { LeafBurst, Pop, Reveal, Stagger } from '../motion';

const heads = {
  first: { title: 'Your first plant is in.', text: 'Rootera Free keeps up to 3 plants. Rootera+ is for a growing collection.' },
  limit: { title: 'Make room for more plants', text: 'Your free shelf holds 3 plants. Rootera+ removes the limit.' },
  rooms: { title: 'Organize plants by room', text: 'Group plants by living room, kitchen or balcony with Rootera+.' },
  default: { title: 'Rootera+', text: 'For people whose plant collection keeps growing.' },
};

const benefits: { icon: IconName; title: string; text: string }[] = [
  { icon: 'infinite-outline', title: 'Unlimited plants', text: 'Free keeps 3 at a time.' },
  { icon: 'albums-outline', title: 'Rooms', text: 'Group plants by where they live and filter your shelf.' },
  { icon: 'git-branch-outline', title: 'Same honest guidance', text: 'Every plan learns from your records the same way.' },
];

// Shown only when no store is connected, so the preview can still be walked through.
const previewPrices = { monthly: 'R$ 12,90 / month', annual: 'R$ 89,90 / year' };

export function Plans({ navigation, route }: Props<'Plans'>) {
  const { garden, setDemoPlan, syncBilling } = useStore();
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
      } else {
        await setDemoPlan('Plus', period === 'annual');
      }
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

  const close = () => navigation.goBack();

  if (done || plus) {
    return <Screen left={<IconButton name="close" label="Close" onPress={close} />} footer={<>
      <Button title="Continue" onPress={close} />
      {plus && !done && garden.plan_source === 'demo' && garden.integrations.demo && <Button title="Switch preview back to Free" variant="quiet" onPress={() => void setDemoPlan('Free', false)} />}
    </>}>
      <Reveal style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
        <View><Shelf /><LeafBurst run={done ? 1 : 0} /></View>
        <Txt v="title" center>{done ? 'Rootera+ is on' : 'You’re on Rootera+'}</Txt>
        <Txt center tone={color.inkSoft}>Unlimited plants and rooms are available.{garden.plan_source === 'demo' || (!billingEnabled && done) ? ' This is a preview activation: no payment was taken.' : ''}</Txt>
      </Reveal>
    </Screen>;
  }

  return <Screen left={<IconButton name="close" label="Close" onPress={close} />}
    footer={<>
      {!!error && <Banner tone="error" title="Not completed" text={error} />}
      <Button title={billingEnabled ? `Continue · ${price ?? '…'}` : 'Activate preview · no charge'} busy={busy || loading} disabled={billingEnabled ? !offer : !garden.integrations.demo} onPress={() => void buy()} />
      <Button title={reason === 'first' ? 'Continue with Free' : 'Not now'} variant="quiet" onPress={close} />
      {billingEnabled && <Press label="Restore purchases" onPress={() => void doRestore()} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}><Txt v="small">Restore purchases</Txt></Press>}
    </>}>
    <Shelf />
    <View style={{ gap: space.sm }}>
      <Txt v="title">{head.title}</Txt>
      <Txt tone={color.inkSoft}>{head.text}</Txt>
    </View>

    <View style={{ gap: space.lg }}>
      {benefits.map((b, i) => <Stagger key={b.title} index={i + 1} style={{ flexDirection: 'row', gap: space.md }}>
        <Icon name={b.icon} size={22} tone={color.olive} />
        <View style={{ flex: 1 }}><Txt v="bodyStrong">{b.title}</Txt><Txt v="small">{b.text}</Txt></View>
      </Stagger>)}
    </View>

    <View style={{ flexDirection: 'row', gap: space.md }}>
      {(['annual', 'monthly'] as const).map(p => {
        const on = p === period;
        const label = billingEnabled ? offers?.find(o => o.period === p)?.price ?? (loading ? '…' : 'Unavailable') : previewPrices[p];
        return <Press key={p} role="radio" selected={on} label={`${p === 'annual' ? 'Yearly' : 'Monthly'}, ${label}`} onPress={() => setPeriod(p)}
          style={{ flex: 1, padding: space.lg, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? color.olive : color.lineStrong, gap: 4, backgroundColor: on ? color.surface : 'transparent' }}>
          <Txt v="label" tone={on ? color.olive : color.inkMuted}>{p === 'annual' ? 'Yearly' : 'Monthly'}</Txt>
          <Txt v="bodyStrong">{label}</Txt>
        </Press>;
      })}
    </View>
    {!billingEnabled && <Txt v="small">Store payments aren’t connected in this preview. Prices are examples; the App Store or Google Play sets the real ones.</Txt>}
    {billingEnabled && <Txt v="small">Billed through your {'App Store or Google Play'} account. Cancel any time in your store settings.</Txt>}
    <Txt v="small" tone={color.inkMuted}>Photo identification and local weather aren’t available yet in any plan.</Txt>
  </Screen>;
}

function Shelf() {
  return <View style={{ alignItems: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {(['zz', 'monstera', 'pothos'] as const).map((k, i) => <Pop key={k} delay={[120, 0, 240][i]}><PlantArt kind={k} size={i === 1 ? 118 : 84} style={{ marginHorizontal: -6 }} /></Pop>)}
    </View>
    <GroundShadow width={230} style={{ marginTop: -14 }} />
  </View>;
}
