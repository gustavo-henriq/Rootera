/**
 * RevenueCat purchases.
 *
 * Only the public SDK key lives in the app (EXPO_PUBLIC_REVENUECAT_IOS_KEY /
 * _ANDROID_KEY / _WEB_KEY, or a Test Store key). Whether a user is Plus is decided
 * by the backend, which checks RevenueCat with its secret key (/v1/billing/sync).
 * Without a key the paywall runs in clearly labelled preview mode.
 */
import { Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY,
}) || process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY || '';

export const billingEnabled = !!KEY;
let configuredFor: string | null = null;

export interface Offer { id: string; period: 'monthly' | 'annual'; price: string; pkg: PurchasesPackage }

export async function configure(appUserID: string) {
  if (!billingEnabled || !appUserID || configuredFor === appUserID) return;
  Purchases.configure({ apiKey: KEY, appUserID });
  configuredFor = appUserID;
}

export async function loadOffers(appUserID: string): Promise<Offer[]> {
  await configure(appUserID);
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs
    .filter(p => p.packageType === 'MONTHLY' || p.packageType === 'ANNUAL')
    .map(p => ({ id: p.identifier, period: p.packageType === 'ANNUAL' ? 'annual' : 'monthly', price: p.product.priceString, pkg: p }));
}

/** Returns false when the person cancelled the store sheet. */
export async function purchase(offer: Offer): Promise<boolean> {
  try {
    await Purchases.purchasePackage(offer.pkg);
    return true;
  } catch (error: any) {
    if (error?.userCancelled) return false;
    throw new Error(error?.message || 'The purchase could not be completed.');
  }
}

export async function restore(appUserID: string) {
  await configure(appUserID);
  await Purchases.restorePurchases();
}
