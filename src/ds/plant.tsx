import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { PlantKind } from '../model';
import { useTheme } from './theme';
import { radius } from './tokens';

export const plantArt: Record<PlantKind, number> = {
  aloe: require('../../assets/plants/aloe.png'),
  'peace-lily': require('../../assets/plants/peace-lily.png'),
  monstera: require('../../assets/plants/monstera.png'),
  pothos: require('../../assets/plants/pothos.png'),
  'snake-plant': require('../../assets/plants/snake-plant.png'),
  zz: require('../../assets/plants/zz.png'),
  pilea: require('../../assets/plants/pilea.png'),
  cactus: require('../../assets/plants/cactus.png'),
  other: require('../../assets/plants/other.png'),
};

/** The owner's photo when there is one, otherwise the species illustration. */
export function PlantArt({ kind, photo, size, style }: { kind: PlantKind; photo?: string | null; size: number; style?: StyleProp<ViewStyle> }) {
  if (photo) return <Image source={{ uri: photo }} accessibilityIgnoresInvertColors resizeMode="cover" style={[{ width: size * .82, height: size, borderRadius: radius.card }, style as any]} />;
  return <Image source={plantArt[kind]} resizeMode="contain" style={[{ width: size, height: size }, style as any]} />;
}

/** Soft contact shadow: squashed circles give a real ellipse; layers fake the falloff. */
export function Ground({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  const { scheme } = useTheme();
  const tone = scheme === 'dark' ? '0,0,0' : '40,52,20';
  return <View pointerEvents="none" style={[{ alignSelf: 'center', width, height: width * .16, alignItems: 'center', justifyContent: 'center' }, style]}>
    {[[1, .05], [.7, .06], [.42, .08]].map(([k, o]) => <View key={k} style={{ position: 'absolute', width: width * k, height: width * k, borderRadius: width, backgroundColor: `rgba(${tone},${o})`, transform: [{ scaleY: .16 / k * (k * .9 + .1) }] }} />)}
  </View>;
}
