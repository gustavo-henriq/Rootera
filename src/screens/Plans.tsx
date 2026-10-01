import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Props } from '../navigation';
import { useStore } from '../store';
import { ApiError } from '../api';
import { billingEnabled, loadOffers, Offer, presentPaywall, purchase, restore } from '../billing';
import { useTheme } from '../ds/theme';
import { fonts, radius, space } from '../ds/tokens';
import { Btn, T, Tap, Toast } from '../ds/components';
import { Glyph, GlyphName } from '../ds/icons';
import { Page } from '../ds/Page';
import { Ground, plantArt } from '../ds/plant';
import { LeafBurst, Pop, Stagger } from '../ds/motion';
import { locale, t } from '../i18n';

const heads = {
  first: { title: 'Room to grow', text: 'Free keeps 3 plants. Rootera+ has no limit.' },
  limit: { title: 'Make room for more plants', text: 'Your free shelf holds 3 plants. Rootera+ removes the limit.' },
  rooms: { title: 'Organize plants by room', text: 'Group plants by living room, kitchen or balcony, and filter your shelf.' },
  diary: { title: 'Watch every plant grow', text: 'A dated photo timeline for each plant, on your phone.' },
  default: { title: 'Rootera+', text: 'For people whose plant collection keeps growing.' },
};
const benefits: { icon: GlyphName; title: string; text: string }[] = [
  { icon: 'infinite', title: 'Unlimited plants', text: 'Free keeps 3 at a time.' },
  { icon: 'rooms', title: 'Rooms', text: 'Group plants by where they live and filter your shelf.' },
  { icon: 'camera', title: 'Growth diary', text: 'A dated photo timeline for each plant, on your phone.' },
];
// Only when no store is connected, so the preview can still be walked through.
type Plan = 'monthly' | 'quarterly' | 'annual';
const previewAmounts: Record<Plan, number> = { monthly: 12.9, quarterly: 32.9, annual: 89.9 };
// The three plans, shortest to longest.
const PERIODS: Plan[] = ['monthly', 'quarterly', 'annual'];
const periodLabel: Record<Plan, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Yearly' };
// Formatted at render time, so the language chosen in You applies.
const money = (n: number) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BRL' }).format(n);
const previewPrice = (p: Plan) => p === 'monthly' ? t('{price} a month', { price: money(previewAmounts.monthly) }) : p === 'quarterly' ? t('{price} every 3 months', { price: money(previewAmounts.quarterly) }) : t('{price} a year', { price: money(previewAmounts.annual) });

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
  const [period, setPeriod] = useState<Plan>('annual');
  // The RevenueCat paywall is used when it can open; otherwise this screen's own picker.
  const [picker, setPicker] = useState(!billingEnabled);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [loading, setLoading] = useState(billingEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const plus = garden.plan === 'Plus';

  useEffect(() => {
    if (!billingEnabled || !garden.user_id) return;
    loadOffers(garden.user_id).then(setOffers).catch(() => setError(t('The store didn’t respond. Check your connection and try again.'))).finally(() => setLoading(false));
  }, [garden.user_id]);

  const offer = offers?.find(o => o.period === period);
  // The yearly saving, from real store amounts when connected; shown only when it is a real saving.
  const monthly = billingEnabled ? offers?.find(o => o.period === 'monthly')?.amount : previewAmounts.monthly;
  const annual = billingEnabled ? offers?.find(o => o.period === 'annual')?.amount : previewAmounts.annual;
  const saving = monthly && annual ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  const price = billingEnabled ? offer?.price : previewPrice(period);

  // The server decides who is Plus (it asks RevenueCat with its secret key); this screen only
  // says "Rootera+ is on" when the server says so.
  const confirm = async (notYet: string) => {
    let plan;
    try { plan = await syncBilling(); }
    catch (e) {
      if (e instanceof ApiError && e.status === 503) throw new Error(t('Purchase complete. The server confirms it once its RevenueCat key is set.'));
      throw e;
    }
    if (plan !== 'Plus') throw new Error(notYet);
    setDone(true);
  };
  const notConfirmed = () => t('The store hasn’t confirmed the purchase yet. Try Restore purchases in a moment.');
  const openPaywall = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const outcome = await presentPaywall(garden.user_id);
      if (outcome === 'unlocked' || outcome === 'already') await confirm(notConfirmed());
      else if (outcome === 'unavailable') setPicker(true);
    } catch (e) { setError(e instanceof Error ? e.message : t('Something went wrong.')); }
    finally { setBusy(false); }
  };
  const buy = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (billingEnabled) {
        if (!offer) throw new Error(t('This plan isn’t available in the store yet.'));
        if (!(await purchase(offer))) return;
        await confirm(notConfirmed());
      } else { await setDemoPlan('Plus', period === 'annual'); setDone(true); }
    } catch (e) { setError(e instanceof Error ? e.message : t('Something went wrong.')); }
    finally { setBusy(false); }
  };
  const doRestore = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await restore(garden.user_id); await confirm(t('Nothing to restore.')); }
    catch (e) { setError(e instanceof Error ? e.message : t('Nothing to restore.')); }
    finally { setBusy(false); }
  };

  if (done || plus) {
    return <Page close={navigation.goBack} footer={<>
      <Btn title={t("Continue")} onPress={navigation.goBack} />
      {plus && !done && garden.plan_source === 'demo' && garden.integrations.demo && <Btn kind="plain" title={t("Switch the preview back to Free")} onPress={() => void setDemoPlan('Free', false)} style={{ alignSelf: 'center' }} />}
    </>}>
      <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[8] }}>
        <View><Shelf /><LeafBurst run={done ? 1 : 0} /></View>
        <T v="hero" center>{done ? t('Rootera+ is on') : t('You’re on Rootera+')}</T>
        <T v="callout" tone="ink2" center>{t('Unlimited plants and rooms are ready.')}{garden.plan_source === 'demo' || (!billingEnabled && done) ? ` ${t('This is a preview activation, so no payment was taken.')}` : ''}</T>
      </View>
    </Page>;
  }

  return <Page close={navigation.goBack} gap={space[6]}
    footer={<>
      {!!error && <Toast tone="error" title={t("Not completed")} text={error} onClose={() => setError('')} />}
      {billingEnabled && !picker
        ? <Btn title={t('See plans')} busy={busy} onPress={() => void openPaywall()} />
        : <Btn title={billingEnabled ? t('Continue, {price}', { price: price ?? '…' }) : t('Activate the preview, no charge')} busy={busy || loading} disabled={billingEnabled ? !offer : !garden.integrations.demo} onPress={() => void buy()} />}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[6] }}>
        <Btn kind="plain" size="regular" title={t("Not now")} onPress={navigation.goBack} />
        {billingEnabled && <Btn kind="plain" size="regular" title={t("Restore purchases")} onPress={() => void doRestore()} />}
      </View>
    </>}>
    <Shelf />
    <View style={{ gap: space[2] }}>
      <T v="hero">{t(head.title)}</T>
      <T v="callout" tone="ink2">{t(head.text)}</T>
    </View>
    <View style={{ gap: space[4] }}>
      {benefits.map((b, i) => <Stagger key={b.title} index={i + 1} style={{ flexDirection: 'row', gap: space[3] }}>
        <Glyph name={b.icon} size={22} tone={c.leafText} />
        <View style={{ flex: 1 }}><T v="headline">{t(b.title)}</T><T v="subhead" tone="ink2">{t(b.text)}</T></View>
      </Stagger>)}
    </View>
    {picker && <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
      {PERIODS.filter(p => billingEnabled ? offers?.some(o => o.period === p) || loading : true).map(p => {
        const on = p === period;
        const label = billingEnabled ? offers?.find(o => o.period === p)?.price ?? (loading ? '…' : t('Unavailable')) : previewPrice(p);
        return <Tap key={p} role="radio" selected={on} label={`${t(periodLabel[p])}, ${label}${p === 'annual' && saving > 0 ? `, ${t('save {n}%', { n: saving })}` : ''}`} onPress={() => setPeriod(p)} ring={radius.control}
          style={{ flexGrow: 1, flexBasis: '45%', padding: space[4], borderRadius: radius.control, borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c.hairline, backgroundColor: on ? c.raised : 'transparent', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
            <T v="footnote" tone="ink2" style={{ fontFamily: fonts.medium }}>{t(periodLabel[p])}</T>
            {p === 'annual' && saving > 0 && <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.inner, backgroundColor: c.successSoft }}><T v="caption" tone="leafText">{t('Save {n}%', { n: saving })}</T></View>}
          </View>
          <T v="headline">{label}</T>
        </Tap>;
      })}
    </View>}
    <T v="footnote" tone="ink2">{t("Guidance, photo ID and nudges come with every plan.")}</T>
    <T v="footnote" tone="ink2">{billingEnabled ? t('Billed by the App Store or Google Play. Cancel any time.') : t('Store payments aren’t connected in this preview. Prices are examples.')}</T>
  </Page>;
}
