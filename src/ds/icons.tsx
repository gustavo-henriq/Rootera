/**
 * Rootera glyphs: one 24-pt grid, 1.75 stroke, round caps and joins.
 * Metaphors come from the domain (a clump of soil, a drop, a leaf, a pot),
 * not from generic UI kits. `filled` is used for the selected tab only.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from './theme';

export type GlyphName =
  | 'soil' | 'water' | 'leaf' | 'light' | 'pot' | 'sprout' | 'journal' | 'person' | 'today' | 'shelf'
  | 'plus' | 'back' | 'forward' | 'close' | 'check' | 'more' | 'camera' | 'photos' | 'search' | 'lock'
  | 'bell' | 'info' | 'alert' | 'trash' | 'edit' | 'rooms' | 'infinite' | 'layers' | 'spark' | 'book';

const paths: Record<GlyphName, (filled: boolean, bg: string) => React.ReactNode> = {
  // A clump of soil with grains: the soil check.
  soil: f => <><Path d="M3.5 16.5c1.2-3.6 4.1-5.6 8.5-5.6s7.3 2 8.5 5.6c.3 1-.4 2-1.5 2H5c-1.1 0-1.8-1-1.5-2Z" fill={f ? 'currentColor' : 'none'} /><Circle cx="9" cy="15.2" r=".9" fill="currentColor" stroke="none" /><Circle cx="13.5" cy="14" r=".9" fill="currentColor" stroke="none" /><Circle cx="15.6" cy="16.3" r=".9" fill="currentColor" stroke="none" /><Path d="M12 10.9V6.5m0 0c0-1.7 1.3-3 3-3 0 1.7-1.3 3-3 3Z" /></>,
  water: f => <Path d="M12 3.5c3.4 4 5.6 7.1 5.6 10a5.6 5.6 0 1 1-11.2 0c0-2.9 2.2-6 5.6-10Z" fill={f ? 'currentColor' : 'none'} />,
  leaf: f => <><Path d="M5 19c0-8.5 5-13.5 14-14 .5 9-4.5 14-12.2 14.2" fill={f ? 'currentColor' : 'none'} /><Path d="M5 19l8.5-8.5" /></>,
  light: () => <><Circle cx="12" cy="12" r="3.8" /><Path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" /></>,
  pot: f => <><Path d="M5 9.5h14l-1.6 9.1a1.8 1.8 0 0 1-1.8 1.4H8.4a1.8 1.8 0 0 1-1.8-1.4L5 9.5Z" fill={f ? 'currentColor' : 'none'} /><Path d="M4 9.5h16M12 9.5V6m0 0c0-1.7-1.3-3-3-3 0 1.7 1.3 3 3 3Zm0 0c0-1.7 1.3-3 3-3 0 1.7-1.3 3-3 3Z" /></>,
  sprout: f => <><Path d="M12 20v-8m0 0c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Zm0 0c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" fill={f ? 'currentColor' : 'none'} /><Path d="M7 20h10" /></>,
  journal: (f, bg) => <><Path d="M6 3.8h10.5A1.5 1.5 0 0 1 18 5.3v15H7.5A1.5 1.5 0 0 1 6 18.8v-15Z" fill={f ? 'currentColor' : 'none'} /><Path d="M6 17.5h12M9.5 7.5h5M9.5 10.5h3" stroke={f ? bg : 'currentColor'} /></>,
  person: f => <><Circle cx="12" cy="8.3" r="3.6" fill={f ? 'currentColor' : 'none'} /><Path d="M5 19.5c.8-3.4 3.5-5.4 7-5.4s6.2 2 7 5.4" fill={f ? 'currentColor' : 'none'} /></>,
  today: f => <><Path d="M4 17.5h16" /><Path d="M7 17.5a5 5 0 0 1 10 0" fill={f ? 'currentColor' : 'none'} /><Path d="M12 6v2.2M6.4 8.9l1.4 1.4M17.6 8.9l-1.4 1.4" /></>,
  shelf: f => <><Path d="M3.5 19.5h17" /><Path d="M6 19.5l-.8-5h5.6l-.8 5M14.5 19.5l-.8-5h5.6l-.8 5" fill={f ? 'currentColor' : 'none'} /><Path d="M8 14.5v-3.5m0 0c0-1.5-1.2-2.8-2.8-2.8 0 1.5 1.3 2.8 2.8 2.8Zm8.5 3.5V9.5m0 0c0-2 1.6-3.8 3.6-3.8 0 2-1.6 3.8-3.6 3.8Z" /></>,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  back: () => <Path d="M14.5 5.5 8 12l6.5 6.5" />,
  forward: () => <Path d="M9.5 5.5 16 12l-6.5 6.5" />,
  close: () => <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  more: () => <><Circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" /><Circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><Circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  camera: () => <><Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><Circle cx="12" cy="12.8" r="3.3" /></>,
  photos: () => <><Path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5v-11Z" /><Path d="M4.5 15.5l4-4 3.5 3.5 2.5-2.5 5 5" /><Circle cx="15.5" cy="9" r="1.3" /></>,
  search: () => <><Circle cx="10.8" cy="10.8" r="6" /><Path d="M15.3 15.3 20 20" /></>,
  lock: () => <><Path d="M6.5 11h11v8.5h-11z" /><Path d="M8.8 11V8.3a3.2 3.2 0 0 1 6.4 0V11" /></>,
  bell: () => <Path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.5h4" />,
  info: () => <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 11v5.5" /><Circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none" /></>,
  alert: () => <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V13" /><Circle cx="12" cy="16.2" r=".9" fill="currentColor" stroke="none" /></>,
  trash: () => <Path d="M5 7h14M9.5 7V5h5v2M7 7l.8 12.5h8.4L17 7" />,
  edit: () => <Path d="M5 19h3.5L18.5 9l-3.5-3.5L5 15.5V19ZM13.5 7l3.5 3.5" />,
  rooms: () => <Path d="M4 20V10l8-5.5 8 5.5v10H4Zm8 0v-6.5M4 13.5h16" />,
  infinite: () => <Path d="M8 15.5c-1.9 0-3.5-1.6-3.5-3.5S6.1 8.5 8 8.5c3.9 0 4.1 7 8 7 1.9 0 3.5-1.6 3.5-3.5S17.9 8.5 16 8.5c-3.9 0-4.1 7-8 7Z" />,
  layers: () => <Path d="M12 4.5 20 9l-8 4.5L4 9l8-4.5ZM4 13l8 4.5 8-4.5" />,
  spark: f => <Path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5Z" fill={f ? 'currentColor' : 'none'} />,
  book: () => <Path d="M12 6.5c-2-1.6-4.8-2-7.5-1.5v13c2.7-.5 5.5-.1 7.5 1.5 2-1.6 4.8-2 7.5-1.5V5c-2.7-.5-5.5-.1-7.5 1.5Zm0 0v13" />,
};

export function Glyph({ name, size = 22, tone, filled = false, label }: { name: GlyphName; size?: number; tone?: string; filled?: boolean; label?: string }) {
  const { c } = useTheme();
  const colour = tone ?? c.ink;
  // The wrapper carries accessibility (SVG props don't reach the DOM on web) and keeps the
  // glyph in its own stacking layer above glass fills.
  return <View style={{ width: size, height: size }} accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'image' : undefined}
    accessibilityElementsHidden={!label} importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour} color={colour} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {paths[name](filled, c.canvas)}
    </Svg>
  </View>;
}

export const glyphNames = Object.keys(paths) as GlyphName[];
