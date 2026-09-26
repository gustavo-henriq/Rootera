/**
 * Rootera design tokens: "Greenhouse Glass".
 *
 * Content (plants, text, data) lives on solid, organic paper. Glass is reserved
 * for chrome that floats above content: tab bar, headers, floating controls,
 * sheets and toasts. Every text pair below is WCAG AA (≥4.5:1) on every solid
 * surface, and on glass over the worst-case backdrop at the given tint opacity.
 * Source of truth: design-system/rootera/MASTER.md.
 */

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
  amber: '#A86F12', // 'getting old' status marks · 3.9:1
  clayText: '#A1461F',
  water: '#2C6474',
  waterSoft: '#DCE9EC',
  danger: '#9E3620',
  dangerSoft: '#F6E2DA',
  successSoft: '#E1ECCF',
  soil: ['#D8C39E', '#B08A5E', '#86603D', '#5A3E27'],
  glassTint: 'rgba(250,251,245,0.86)',
  glassClear: 'rgba(250,251,245,0.55)',
  glassCallout: 'rgba(250,251,245,0.8)', // callouts over art: the plant shows through, ink stays AA
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
  amber: '#E0B052',
  clayText: '#EB9A73',
  water: '#86BCCB',
  waterSoft: '#1B2A2E',
  danger: '#F08D78',
  dangerSoft: '#3A1E17',
  successSoft: '#223018',
  soil: ['#CDB690', '#A98459', '#7F5A38', '#5A3E27'],
  glassTint: 'rgba(26,32,19,0.84)',
  glassClear: 'rgba(26,32,19,0.5)',
  glassCallout: 'rgba(26,32,19,0.8)',
  glassEdge: 'rgba(255,255,255,0.14)',
  glassRim: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(0,0,0,0.5)',
};

export const palettes = { light, dark };
export type Palette = typeof light;

/**
 * Two families: Bricolage Grotesque for titles and plant names (organic, a little
 * quirky, like the plants), Instrument Sans for everything you read or tap.
 * Latin names use Instrument Sans italic, the botanical-label convention.
 * Custom fonts pick weight by family name, so each weight has its own family.
 * `serif` keys are kept as aliases so older call sites keep working.
 */
export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  italic: 'InstrumentSans_400Regular_Italic',
  display: 'BricolageGrotesque_600SemiBold',
  displayMedium: 'BricolageGrotesque_500Medium',
  serif: 'BricolageGrotesque_500Medium',
  serifItalic: 'InstrumentSans_400Regular_Italic',
};

/** Quiet weights: 400 for reading, 500 for emphasis, 600 only for titles. */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  hero: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  section: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  latin: { fontFamily: fonts.italic, fontSize: 16, lineHeight: 21 },
  largeTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 37, letterSpacing: -0.9 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.6 },
  title2: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, letterSpacing: -0.1 },
  callout: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  subhead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  figure: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1, fontVariant: ['tabular-nums' as const] },
};
export type TypeName = keyof typeof type;

/** 4-pt grid, spacious. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 11: 44, 16: 64, gutter: 20 };

/** Radii grow with the size of the thing: inner < control < card < chrome. */
export const radius = { inner: 4, input: 6, control: 10, card: 16, chrome: 26, pill: 999 };

/** Glass levels. Text is allowed on `chrome`, `control` and short labels on `callout`. */
export const glass = {
  chrome: { blur: 28, tint: 'glassTint' as const }, // tab bar, headers, sheets
  control: { blur: 18, tint: 'glassTint' as const }, // floating buttons, segmented, toasts
  callout: { blur: 20, tint: 'glassCallout' as const }, // short labels over illustrations
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
