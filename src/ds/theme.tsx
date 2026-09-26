import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Appearance, Platform, useWindowDimensions } from 'react-native';
import { Palette, palettes, Scheme } from './tokens';

interface Theme { scheme: Scheme; c: Palette; reduceMotion: boolean; reduceTransparency: boolean }

// Web preview only: ?scheme=dark, ?reduceMotion=1, ?reduceTransparency=1 force a mode for testing.
const query = Platform.OS === 'web' && typeof location !== 'undefined' ? location.search : '';
const forced = {
  scheme: /[?&]scheme=(light|dark)/.exec(query)?.[1] as Scheme | undefined,
  motion: /[?&]reduceMotion=1/.test(query),
  transparency: /[?&]reduceTransparency=1/.test(query),
};

function webMedia(q: string) {
  return Platform.OS === 'web' && typeof matchMedia !== 'undefined' ? matchMedia(q).matches : false;
}

const Context = createContext<Theme>({ scheme: 'light', c: palettes.light, reduceMotion: false, reduceTransparency: false });

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [scheme, setScheme] = useState<Scheme>(forced.scheme ?? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'));
  const [reduceMotion, setReduceMotion] = useState(forced.motion);
  const [reduceTransparency, setReduceTransparency] = useState(forced.transparency || webMedia('(prefers-reduced-transparency: reduce)'));

  useEffect(() => {
    const subs: { remove: () => void }[] = [];
    if (!forced.scheme) subs.push(Appearance.addChangeListener(({ colorScheme }) => setScheme(colorScheme === 'dark' ? 'dark' : 'light')));
    if (!forced.motion) {
      AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
      subs.push(AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion));
    }
    if (!forced.transparency && Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency).catch(() => undefined);
      subs.push(AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency));
    }
    return () => subs.forEach(s => s.remove());
  }, []);

  const value = useMemo(() => ({ scheme, c: palettes[scheme], reduceMotion, reduceTransparency }), [scheme, reduceMotion, reduceTransparency]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useTheme = () => useContext(Context);

/**
 * Compact layouts for large text and narrow screens (Dynamic Type at 130%+, or zoom that
 * leaves less than 330 points): absolutely placed callouts and side-by-side labels give way
 * to simple stacked rows, so nothing overlaps or runs off screen (WCAG 1.4.4 / 1.4.10).
 */
export function useCompact() {
  const { width, fontScale } = useWindowDimensions();
  return fontScale >= 1.3 || width < 330;
}
