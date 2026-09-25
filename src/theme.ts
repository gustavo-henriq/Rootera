/**
 * Rootera design tokens.
 *
 * A calm specimen-catalogue look: pale leaf-green paper, olive ink, terracotta
 * from the pots, and the bright logo green used sparingly as a living accent.
 * Two voices: Instrument Serif for editorial moments (hero lines, plant names,
 * Latin names in italic as on botanical labels) and Figtree, a geometric sans
 * close to the original brand mockups, for the interface, numbers and labels.
 */
export const color = {
  paper: '#F4F6EA',
  paperDeep: '#ECEFDD',
  surface: '#FBFCF5',
  ink: '#2C3320',
  inkSoft: '#586049',
  inkMuted: '#7D846F',
  olive: '#3E4A2A',
  oliveSoft: '#E3E8D2',
  leaf: '#6DBF2E',
  leafInk: '#3F7A1A',
  clay: '#C45F36',
  claySoft: '#F5E4D8',
  water: '#3F7384',
  waterSoft: '#DFEBEC',
  line: '#DDE1CE',
  lineStrong: '#C9CEB6',
  white: '#FFFFFF',
  danger: '#A8402A',
  soil: ['#D9C4A0', '#B38E62', '#8A6440', '#5E4128'] as const,
};

export const font = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  display: 'Figtree_700Bold',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodyBold: 'Figtree_600SemiBold',
  heavy: 'Figtree_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 20 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export const type = {
  hero: { fontFamily: font.serif, fontSize: 42, lineHeight: 44, letterSpacing: -0.8, color: color.ink },
  title: { fontFamily: font.display, fontSize: 27, lineHeight: 32, letterSpacing: -0.7, color: color.ink },
  heading: { fontFamily: font.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.3, color: color.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: color.ink },
  bodyStrong: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 23, color: color.ink },
  small: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: color.inkSoft },
  smallStrong: { fontFamily: font.bodyBold, fontSize: 14, lineHeight: 20, color: color.ink },
  label: { fontFamily: font.heavy, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, color: color.inkMuted, textTransform: 'uppercase' as const },
  latin: { fontFamily: font.serifItalic, fontSize: 17, lineHeight: 21, color: color.inkSoft },
};
