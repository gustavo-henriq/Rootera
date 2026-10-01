/**
 * RevenueCat purchases.
 *
 * Only the public SDK key lives in the app (EXPO_PUBLIC_REVENUECAT_IOS_KEY /
 * _ANDROID_KEY / _WEB_KEY, or a Test Store key, EXPO_PUBLIC_REVENUECAT_TEST_KEY). The app
 * never decides on its own that someone is Plus: after a purchase or a restore it asks the
 * backend (/v1/billing/sync), which checks RevenueCat with its secret key.
 *
 * Products (configured in the RevenueCat dashboard, not here): monthly, quarterly and yearly,
 * all attached to the entitlement "rootera" and offered in the current offering as the
 * $rc_monthly, $rc_three_month and $rc_annual packages. The paywall itself is designed in
 * RevenueCat (Paywalls) and presented with react-native-purchases-ui; where that UI cannot
 * run (Expo Go without the native module, the web preview, no paywall configured), the
 * Plans screen shows its own plan picker over the same packages.
 * Without a key, the Plans screen runs in clearly labelled preview mode.
 */
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases';
import { t } from './i18n';

export const ENTITLEMENT = 'rootera';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY,
}) || process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY || '';

export const billingEnabled = !!KEY;
let configuredFor: string | null = null;

export type Period = 'monthly' | 'quarterly' | 'annual' | 'lifetime';
export interface Offer { id: string; period: Period; price: string; amount: number; pkg: PurchasesPackage }
const PERIOD: Partial<Record<PACKAGE_TYPE, Period>> = { [PACKAGE_TYPE.MONTHLY]: 'monthly', [PACKAGE_TYPE.THREE_MONTH]: 'quarterly', [PACKAGE_TYPE.ANNUAL]: 'annual', [PACKAGE_TYPE.LIFETIME]: 'lifetime' };

/** Configures the SDK once per signed-in user (the app user id is the backend's user id). */
export async function configure(appUserID: string) {
  if (!billingEnabled || !appUserID || configuredFor === appUserID) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  if (configuredFor) await Purchases.logIn(appUserID);
  else Purchases.configure({ apiKey: KEY, appUserID });
  configuredFor = appUserID;
}

/** True when the customer has the "rootera" entitlement right now (lifetime included). */
export const isEntitled = (info: CustomerInfo) => info.entitlements.active[ENTITLEMENT] !== undefined;

export async function customerInfo(appUserID: string): Promise<CustomerInfo> {
  await configure(appUserID);
  return Purchases.getCustomerInfo();
}

/** Calls `onChange` whenever RevenueCat reports new customer info (renewals, expirations,
 *  purchases made elsewhere). Returns a function that stops listening. */
export function watchCustomerInfo(appUserID: string, onChange: (entitled: boolean) => void): () => void {
  if (!billingEnabled || !appUserID) return () => undefined;
  let stopped = false;
  const listener = (info: CustomerInfo) => { if (!stopped) onChange(isEntitled(info)); };
  void configure(appUserID).then(() => { if (!stopped) Purchases.addCustomerInfoUpdateListener(listener); });
  return () => { stopped = true; Purchases.removeCustomerInfoUpdateListener(listener); };
}

export async function loadOffers(appUserID: string): Promise<Offer[]> {
  await configure(appUserID);
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs
    .filter(p => PERIOD[p.packageType])
    .map(p => ({ id: p.identifier, period: PERIOD[p.packageType]!, price: p.product.priceString, amount: p.product.price, pkg: p }));
}

/** Returns false when the person cancelled the store sheet. */
export async function purchase(offer: Offer): Promise<boolean> {
  try {
    const { customerInfo: info } = await Purchases.purchasePackage(offer.pkg);
    return isEntitled(info);
  } catch (error: any) {
    if (error?.userCancelled) return false;
    throw new Error(error?.message || t('The purchase could not be completed.'));
  }
}

export async function restore(appUserID: string): Promise<boolean> {
  await configure(appUserID);
  return isEntitled(await Purchases.restorePurchases());
}

/**
 * The RevenueCat UI module, loaded only when needed: in Expo Go and on the web its native
 * part may be missing, and the Plans screen then falls back to its own picker.
 */
function ui(): typeof import('react-native-purchases-ui') | null {
  try { return require('react-native-purchases-ui'); } catch { return null; }
}

export type PaywallOutcome = 'unlocked' | 'already' | 'cancelled' | 'unavailable';

/** Presents the paywall designed in RevenueCat, unless the customer already has "rootera". */
export async function presentPaywall(appUserID: string): Promise<PaywallOutcome> {
  const RevenueCatUI = ui();
  if (!billingEnabled || !RevenueCatUI || Platform.OS === 'web') return 'unavailable';
  await configure(appUserID);
  try {
    const result = await RevenueCatUI.default.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT, displayCloseButton: true });
    const R = RevenueCatUI.PAYWALL_RESULT;
    return result === R.PURCHASED || result === R.RESTORED ? 'unlocked' : result === R.NOT_PRESENTED ? 'already' : result === R.ERROR ? 'unavailable' : 'cancelled';
  } catch {
    return 'unavailable';
  }
}

/** RevenueCat's Customer Center (manage, cancel, restore, get help). False when it can't open. */
export async function presentCustomerCenter(appUserID: string): Promise<boolean> {
  const RevenueCatUI = ui();
  if (!billingEnabled || !RevenueCatUI || Platform.OS === 'web') return false;
  await configure(appUserID);
  try { await RevenueCatUI.default.presentCustomerCenter(); return true; }
  catch { return false; }
}

/** The store's own subscription page, when the Customer Center isn't available. */
export async function manageInStore(appUserID: string) {
  await configure(appUserID);
  await Purchases.showManageSubscriptions();
}
