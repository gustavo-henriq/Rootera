/**
 * Rootera design tokens — "Greenhouse Glass".
 *
 * Content (plants, text, data) lives on solid, organic paper. Glass is reserved
 * for chrome that floats above content: tab bar, headers, floating controls,
 * sheets and toasts. Every text pair below is WCAG AA (≥4.5:1) on every solid
 * surface, and on glass over the worst-case backdrop at the given tint opacity.
 * Source of truth: design-system/rootera/MASTER.md.
 */
import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';

const light = {
  canvas: '#F3F5EC', // paper
  raised: '#FBFCF7', // content surfaces that need separation
  sunken: '#E8ECDD', // wells, plant stages, input fills
  ink: '#1C2314', // primary text · 11.9:1 on canvas
  ink2: '#4A533C', // secondary text · 6.9:1
  ink3: '#5C654E', // tertiary text / captions · 5.1:1
  hairline: 'rgba(28,35,20,0.12)',
  action: '#34431D', // primary controls; white on it 10.7:1
  onAction: '#FFFFFF',
  leaf: '#6DBF2E', // brand green: illustration, fills, never text
  leafText: '#386F16', // green text
  leafMark: '#4F9A1C', // green status marks · 3.2:1 non-text
  clay: '#C0582E', // terracotta marks · 4.1:1
  clayText: '#A1461F',
  water: '#2C6474',
  waterSoft: '#DCE9EC',
  danger: '#9E3620',
  dangerSoft: '#F6E2DA',
  successSoft: '#E1ECCF',
  soil: ['#D8C39E', '#B08A5E', '#86603D', '#5A3E27'],
  glassTint: 'rgba(250,251,245,0.86)',
  glassClear: 'rgba(250,251,245,0.55)',
  glassEdge: 'rgba(255,255,255,0.95)', // specular top highlight
  glassRim: 'rgba(28,35,20,0.10)', // outer hairline
  shadow: 'rgba(40,52,20,0.14)', // tinted, one light source from above
  scrim: 'rgba(15,19,11,0.28)',
};

const dark: typeof light = {
  canvas: '#0F130B',
  raised: '#171D12',
  sunken: '#1E2518',
  ink: '#EEF2E6',
  ink2: '#BFC7B1',
  ink3: '#A2AB93',
  hairline: 'rgba(238,242,230,0.12)',
  action: '#B5DE7C',
  onAction: '#0F130B',
  leaf: '#8FCB4E',
  leafText: '#A6D96A',
  leafMark: '#8FCB4E',
  clay: '#E08A63',
  clayText: '#EB9A73',
  water: '#86BCCB',
  waterSoft: '#1B2A2E',
  danger: '#F08D78',
  dangerSoft: '#3A1E17',
  successSoft: '#223018',
  soil: ['#CDB690', '#A98459', '#7F5A38', '#5A3E27'],
  glassTint: 'rgba(26,32,19,0.84)',
  glassClear: 'rgba(26,32,19,0.5)',
  glassEdge: 'rgba(255,255,255,0.14)',
  glassRim: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(0,0,0,0.5)',
};

export const palettes = { light, dark };
export type Palette = typeof light;

/** Native system UI font (SF on iOS, Roboto on Android). SF is never bundled. */
const system = Platform.select({ ios: undefined, android: undefined, default: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif' });
export const fonts = {
  system,
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
};

/** Apple-style type ramp. Serif only for plant names and editorial moments. */
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 48, letterSpacing: -0.6 },
  hero: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.4 },
  latin: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 22 },
  largeTitle: { fontFamily: fonts.system, fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontFamily: fonts.system, fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.3 },
  title2: { fontFamily: fonts.system, fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.system, fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontFamily: fonts.system, fontSize: 17, lineHeight: 24, fontWeight: '400' as const, letterSpacing: -0.2 },
  callout: { fontFamily: fonts.system, fontSize: 16, lineHeight: 21, fontWeight: '400' as const },
  subhead: { fontFamily: fonts.system, fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontFamily: fonts.system, fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontFamily: fonts.system, fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  figure: { fontFamily: fonts.system, fontSize: 34, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.8, fontVariant: ['tabular-nums' as const] },
};
export type TypeName = keyof typeof type;

/** 4-pt grid, spacious. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 11: 44, 16: 64, gutter: 20 };

/** Radii grow with the size of the thing: inner < control < card < chrome. */
export const radius = { inner: 8, input: 12, control: 16, card: 24, chrome: 30, pill: 999 };

/** Three glass levels. Text is allowed only on `chrome` and `control`. */
export const glass = {
  chrome: { blur: 28, tint: 'glassTint' as const }, // tab bar, headers, sheets
  control: { blur: 18, tint: 'glassTint' as const }, // floating buttons, segmented, toasts
  clear: { blur: 14, tint: 'glassClear' as const }, // decorative, never carries text
};

/** Springs (Reanimated `withSpring` configs). Exits use `exit` timing: faster than enters. */
export const springs = {
  snappy: { damping: 22, stiffness: 340, mass: 1 }, // press, toggle, select
  smooth: { damping: 26, stiffness: 190, mass: 1 }, // layout, sheets, morphs
  bouncy: { damping: 11, stiffness: 170, mass: 1 }, // celebrations, plant settle
  gentle: { damping: 30, stiffness: 80, mass: 1.2 }, // ambient drift
};
export const timing = { exit: 160, fade: 220, stagger: 55 };

export const elevation = {
  float: { shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  lift: { shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};
